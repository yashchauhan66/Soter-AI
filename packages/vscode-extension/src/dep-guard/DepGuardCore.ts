/**
 * Pure Dependency Guard heuristics + OSV client (no VS Code imports).
 * Safe to unit-test under plain Node / tsx.
 *
 * Protection level: DETECTION_ONLY / ADVISORY_ONLY
 * - Heuristics always run locally.
 * - CVE intelligence from public OSV when online.
 * - Not a full SCA product.
 */

const OSV_QUERY_URL = "https://api.osv.dev/v1/query";
const OSV_BATCH_URL = "https://api.osv.dev/v1/querybatch";
const OSV_TIMEOUT_MS = 8_000;
export const OSV_BATCH_LIMIT = 40;

const TYPOSQUAT_PATTERNS = [
    /expresss/,
    /lod-a-sh/,
    /requestq/,
    /colorsjs/,
    /cross-env$/,
    /mongose$/,
    /nodemon$/,
    /reactt$/,
    /axois$/,
    /lodahs$/,
    /web3\.js$/,
];

const HIGH_RISK_PATTERNS = [
    { pattern: /curl.*\|.*sh/i, label: "curl pipe to shell", risk: "critical" as const },
    { pattern: /curl.*\|.*bash/i, label: "curl pipe to bash", risk: "critical" as const },
    { pattern: /wget.*\|.*sh/i, label: "wget pipe to shell", risk: "critical" as const },
    { pattern: /postinstall/i, label: "postinstall script", risk: "medium" as const },
    { pattern: /preinstall/i, label: "preinstall script", risk: "low" as const },
];

const KNOWN_SAFE = new Set([
    "express", "lodash", "react", "react-dom", "vue", "angular", "next", "nuxt",
    "typescript", "eslint", "prettier", "jest", "mocha", "vitest", "webpack", "vite",
    "axios", "node-fetch", "chalk", "commander", "dotenv", "uuid", "moment", "dayjs",
    "mongoose", "pg", "mysql2", "sqlite3", "redis", "jsonwebtoken", "bcrypt",
    "cors", "helmet", "morgan", "body-parser", "multer",
]);

export interface DependencyRisk {
    name: string;
    version: string;
    source: string;
    risk: "low" | "medium" | "high" | "critical";
    reasons: string[];
    osvIds?: string[];
    advisorySource?: "osv" | "heuristic" | "none";
    advisoryFetchedAt?: string;
    advisoryStale?: boolean;
}

export interface OsvVulnerability {
    id: string;
    summary?: string;
    severity?: string;
}

export interface OsvLookupResult {
    packageName: string;
    version: string;
    ecosystem: string;
    vulns: OsvVulnerability[];
    fetchedAt: string;
    error?: string;
}

/** Pure heuristic package analysis (no network). */
export function analyzePackage(name: string, version: string): DependencyRisk {
    const reasons: string[] = [];
    let risk: DependencyRisk["risk"] = "low";

    if (TYPOSQUAT_PATTERNS.some((p) => p.test(name))) {
        risk = "high";
        reasons.push("Possible typosquatting — similar to known package");
    }

    if (version === "*" || version === "latest" || version === "") {
        risk = risk === "high" ? "high" : "medium";
        reasons.push("Unpinned version — may install unexpected code");
    }

    if (version.startsWith("http://") || version.startsWith("git+") || version.startsWith("git://")) {
        risk = "high";
        reasons.push("Remote URL / git install — bypasses registry integrity checks");
    }

    if (/^@[^/]+\/[^@]+@http/i.test(`${name}@${version}`)) {
        risk = "high";
        reasons.push("Scoped package resolved from HTTP URL");
    }

    if (!KNOWN_SAFE.has(name.toLowerCase()) && reasons.length === 0) {
        risk = "low";
    }

    return {
        name,
        version,
        source: "package.json",
        risk,
        reasons,
        advisorySource: "heuristic",
    };
}

/** Pure install-command analysis (no network). */
export function analyzeInstallCommand(cmd: string): DependencyRisk[] {
    const findings: DependencyRisk[] = [];

    for (const { pattern, label, risk } of HIGH_RISK_PATTERNS) {
        pattern.lastIndex = 0;
        if (pattern.test(cmd)) {
            findings.push({
                name: cmd.substring(0, 60),
                version: "unknown",
                source: "command",
                risk,
                reasons: [label],
                advisorySource: "heuristic",
            });
        }
    }

    const pkgMatch = cmd.match(/(?:npm|yarn|pnpm)\s+(?:i|install|add)\s+(?:--save-dev\s+)?(?:--save\s+)?(?:-D\s+)?([^\s]+)/i);
    if (pkgMatch) {
        const raw = pkgMatch[1];
        const { name, version } = splitNameVersion(raw);
        const pkgRisk = analyzePackage(name, version);
        if (pkgRisk.risk !== "low" || pkgRisk.reasons.length > 0) findings.push(pkgRisk);
    }

    const pipMatch = cmd.match(/pip(?:3)?\s+install\s+([^\s]+)/i);
    if (pipMatch) {
        const name = pipMatch[1];
        if (!KNOWN_SAFE.has(name.toLowerCase())) {
            findings.push({
                name,
                version: "unknown",
                source: "pip",
                risk: "medium",
                reasons: ["Unknown pip package — verify source"],
                advisorySource: "heuristic",
            });
        }
    }

    return findings;
}

export function splitNameVersion(raw: string): { name: string; version: string } {
    if (raw.startsWith("@")) {
        const at = raw.lastIndexOf("@");
        if (at > 0) return { name: raw.slice(0, at), version: raw.slice(at + 1) || "latest" };
        return { name: raw, version: "latest" };
    }
    const at = raw.indexOf("@");
    if (at > 0) return { name: raw.slice(0, at), version: raw.slice(at + 1) || "latest" };
    return { name: raw, version: "latest" };
}

/**
 * Query OSV for a single package version.
 * Fail-closed for network errors: returns empty vulns + error string.
 */
export async function queryOsv(
    packageName: string,
    version: string,
    ecosystem: string = "npm",
    fetchImpl: typeof fetch = fetch,
): Promise<OsvLookupResult> {
    const fetchedAt = new Date().toISOString();
    const cleanVersion = normalizeVersion(version);
    if (!packageName || !cleanVersion || cleanVersion === "latest" || cleanVersion === "*") {
        return {
            packageName,
            version,
            ecosystem,
            vulns: [],
            fetchedAt,
            error: "OSV requires a concrete version; unpinned packages skip advisory lookup",
        };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OSV_TIMEOUT_MS);
    try {
        const res = await fetchImpl(OSV_QUERY_URL, {
            method: "POST",
            headers: { "content-type": "application/json", accept: "application/json" },
            body: JSON.stringify({
                package: { name: packageName, ecosystem },
                version: cleanVersion,
            }),
            signal: controller.signal,
        });
        if (!res.ok) {
            return {
                packageName,
                version: cleanVersion,
                ecosystem,
                vulns: [],
                fetchedAt,
                error: `OSV HTTP ${res.status}`,
            };
        }
        const body = (await res.json()) as {
            vulns?: Array<{ id?: string; summary?: string; severity?: Array<{ type?: string; score?: string }> }>;
        };
        const vulns: OsvVulnerability[] = (body.vulns ?? [])
            .filter((v) => typeof v.id === "string")
            .map((v) => ({
                id: v.id as string,
                summary: typeof v.summary === "string" ? v.summary.slice(0, 200) : undefined,
                severity: Array.isArray(v.severity) && v.severity[0]?.score ? String(v.severity[0].score) : undefined,
            }));
        return { packageName, version: cleanVersion, ecosystem, vulns, fetchedAt };
    } catch (err) {
        return {
            packageName,
            version: cleanVersion,
            ecosystem,
            vulns: [],
            fetchedAt,
            error: err instanceof Error ? err.message : "OSV request failed",
        };
    } finally {
        clearTimeout(timer);
    }
}

/** Batch OSV query (up to OSV_BATCH_LIMIT packages). */
export async function queryOsvBatch(
    packages: Array<{ name: string; version: string; ecosystem?: string }>,
    fetchImpl: typeof fetch = fetch,
): Promise<OsvLookupResult[]> {
    const fetchedAt = new Date().toISOString();
    const limited = packages.slice(0, OSV_BATCH_LIMIT);
    const queries = limited.map((p) => ({
        package: { name: p.name, ecosystem: p.ecosystem ?? "npm" },
        version: normalizeVersion(p.version),
    })).filter((q) => q.version && q.version !== "latest" && q.version !== "*");

    if (queries.length === 0) {
        return limited.map((p) => ({
            packageName: p.name,
            version: p.version,
            ecosystem: p.ecosystem ?? "npm",
            vulns: [],
            fetchedAt,
            error: "No concrete versions for OSV batch",
        }));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OSV_TIMEOUT_MS);
    try {
        const res = await fetchImpl(OSV_BATCH_URL, {
            method: "POST",
            headers: { "content-type": "application/json", accept: "application/json" },
            body: JSON.stringify({ queries }),
            signal: controller.signal,
        });
        if (!res.ok) {
            return queries.map((q) => ({
                packageName: q.package.name,
                version: q.version,
                ecosystem: q.package.ecosystem,
                vulns: [],
                fetchedAt,
                error: `OSV batch HTTP ${res.status}`,
            }));
        }
        const body = (await res.json()) as {
            results?: Array<{ vulns?: Array<{ id?: string; summary?: string }> }>;
        };
        const results = body.results ?? [];
        return queries.map((q, i) => {
            const vulns = (results[i]?.vulns ?? [])
                .filter((v) => typeof v.id === "string")
                .map((v) => ({
                    id: v.id as string,
                    summary: typeof v.summary === "string" ? v.summary.slice(0, 200) : undefined,
                }));
            return {
                packageName: q.package.name,
                version: q.version,
                ecosystem: q.package.ecosystem,
                vulns,
                fetchedAt,
            };
        });
    } catch (err) {
        return queries.map((q) => ({
            packageName: q.package.name,
            version: q.version,
            ecosystem: q.package.ecosystem,
            vulns: [],
            fetchedAt,
            error: err instanceof Error ? err.message : "OSV batch failed",
        }));
    } finally {
        clearTimeout(timer);
    }
}

export function normalizeVersion(version: string): string {
    return version.replace(/^[\^~>=<\s]+/, "").split(/\s+/)[0] ?? version;
}

export function mergeOsvIntoRisk(risk: DependencyRisk, osv: OsvLookupResult): DependencyRisk {
    if (osv.error && osv.vulns.length === 0) {
        return {
            ...risk,
            advisorySource: risk.advisorySource ?? "heuristic",
            advisoryFetchedAt: osv.fetchedAt,
            reasons: osv.error.includes("concrete version")
                ? risk.reasons
                : [...risk.reasons, `OSV lookup unavailable: ${osv.error}`],
        };
    }
    if (osv.vulns.length === 0) {
        return {
            ...risk,
            advisorySource: "osv",
            advisoryFetchedAt: osv.fetchedAt,
            osvIds: [],
        };
    }
    const ids = osv.vulns.map((v) => v.id);
    const elevated: DependencyRisk["risk"] =
        risk.risk === "critical" ? "critical" : osv.vulns.length >= 3 ? "critical" : "high";
    return {
        ...risk,
        risk: elevated,
        reasons: [
            ...risk.reasons,
            `OSV: ${ids.slice(0, 5).join(", ")}${ids.length > 5 ? ` (+${ids.length - 5} more)` : ""}`,
        ],
        osvIds: ids,
        advisorySource: "osv",
        advisoryFetchedAt: osv.fetchedAt,
    };
}
