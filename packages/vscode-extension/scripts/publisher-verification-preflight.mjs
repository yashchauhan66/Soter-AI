#!/usr/bin/env node
// Publisher-domain verification preflight for soterai.in.
//
// The blue verified-publisher check on the Marketplace is a manual review the
// publisher requests; the eligibility gates below are what the reviewer
// checks. This script measures every gate that is measurable from a machine,
// prints a GO / NO-GO, and stores machine-readable evidence in
// artifacts/marketplace/ for the request.
//
//   node scripts/publisher-verification-preflight.mjs          # live checks
//   node scripts/publisher-verification-preflight.mjs --offline
//
// Current state (measured 2026-08-11): the two six-month clocks are the only
// red gates. The extension has shipped since 2026-07-06 and soterai.in has
// been registered since 2026-07-03, so the earliest eligible submission is
// 2027-01-06. TXT verification is possible now (the DNS is ours), but the
// reviewer will not act on a request that fails the clocks.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OFFLINE = process.argv.includes("--offline");

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const pkgPath = join(root, "packages", "vscode-extension", "package.json");
const manifest = JSON.parse(readFileSync(pkgPath, "utf8"));

const PUBLISHER_ID = manifest.publisher; // verified on the marketplace.visualstudio.com page
const PUBLISHER_DISPLAY = manifest.displayName;
const EXTENSION_VERSION = manifest.version;
const DOMAIN = "soterai.in";
const VERIFY_HOST = `_visual-studio-marketplace-${PUBLISHER_ID}.${DOMAIN}`;
const APEX = `https://${DOMAIN}/`;
const HEADERS = { "user-agent": "soterai-publisher-preflight" };

// Gate names are the keys in the evidence JSON, so offline and live runs must
// use the same strings — otherwise the two modes produce incomparable evidence.
const GATE_APEX = "apex https reachable (200, no redirect)";
const GATE_TXT = `TXT record present: ${VERIFY_HOST}`;

/** First Marketplace publish of soterai.soterai-ide-guard. Starts clock one. */
const FIRST_PUBLISHED = "2026-07-06";
/**
 * Clock two normally comes from RDAP. This is only used when RDAP is
 * unreachable, and the gate says so when it falls back, so a stale constant
 * can never quietly become the basis of a GO.
 */
const DOMAIN_REGISTERED_FALLBACK = "2026-07-03";

const results = [];
const add = (name, pass, detail) => {
    results.push({ name, pass, detail, checkedAt: new Date().toISOString() });
    console.log(`${pass ? "PASS" : "FAIL"}  ${name}\n       ${detail}`);
};

const now = Date.now();

async function probe(url) {
    const res = await fetch(url, { method: "HEAD", redirect: "manual", headers: HEADERS });
    if (res.status === 405 || res.status === 403) {
        const get = await fetch(url, { redirect: "manual", headers: HEADERS });
        return get;
    }
    return res;
}

async function dnsTxt(host) {
    // Resolve the TXT record without depending on a local `dig`/`nslookup`:
    // Google's DNS-over-HTTPS answers the same question the reviewer's DNS
    // lookup will.
    const res = await fetch(`https://dns.google/resolve?name=${host}&type=TXT`, {
        headers: HEADERS,
    });
    const body = await res.json();
    return body?.Answer?.map((a) => a.data.replace(/^"|"$/g, "")) ?? [];
}

async function domainRegisteredAt(domain) {
    // Registration date comes from RDAP. None of the public RDAP servers are
    // guaranteed to answer, so a failure here must not fail the whole run.
    try {
        const res = await fetch(`https://www.rdap.net/domain/${domain}`, {
            headers: HEADERS,
            signal: AbortSignal.timeout(20_000),
        });
        if (!res.ok) return null;
        const body = await res.json();
        return body?.events?.find((e) => e.eventAction === "registration")?.eventDate ?? null;
    } catch {
        return null;
    }
}

/**
 * "Six months" means six calendar months, not 182 days. Adding a fixed number
 * of days lands two days early and would have us submit before the reviewer
 * considers the clock met.
 */
function addMonths(date, months) {
    const out = new Date(date.getTime());
    out.setUTCMonth(out.getUTCMonth() + months);
    return out;
}

function earliestOf({ clockName, liveSince, monthsRequired, source }) {
    const eligibleAt = addMonths(liveSince, monthsRequired);
    const eligible = eligibleAt.toISOString().slice(0, 10);
    add(
        clockName,
        now >= eligibleAt.getTime(),
        `live since ${liveSince.toISOString().slice(0, 10)} (${source}); ` +
            `${monthsRequired} calendar months required; earliest eligible ${eligible}`,
    );
    return eligibleAt;
}

async function main() {
    console.log(`Publisher: ${PUBLISHER_DISPLAY} (${PUBLISHER_ID})\n`);

    // ── Network-independent gates (matter even offline) ─────────────────────
    add("manifest publisher id", /^[a-z0-9][a-z0-9-]*$/.test(PUBLISHER_ID),
        `publisher = "${PUBLISHER_ID}"`);

    add("extension version", /^\d+\.\d+\.\d+$/.test(EXTENSION_VERSION),
        `version = ${EXTENSION_VERSION}`);

    // Measure the registration date before the clock that depends on it, so the
    // verdict rests on what RDAP reports rather than on a date typed in here.
    const registeredAt = OFFLINE ? null : await domainRegisteredAt(DOMAIN);
    if (!OFFLINE) {
        add(
            "domain registration date (RDAP)",
            registeredAt !== null,
            registeredAt ?? "unavailable — RDAP servers are flaky; retry before submitting",
        );
    }

    const earliestClocks = [
        earliestOf({
            clockName: "extension live >= 6 months",
            liveSince: new Date(FIRST_PUBLISHED),
            monthsRequired: 6,
            source: "first Marketplace publish",
        }),
        earliestOf({
            clockName: "domain registered >= 6 months",
            liveSince: new Date(registeredAt ?? DOMAIN_REGISTERED_FALLBACK),
            monthsRequired: 6,
            source: registeredAt ? "RDAP" : "recorded fallback, RDAP unavailable",
        }),
    ];
    const earliest = new Date(Math.max(...earliestClocks.map((d) => d.getTime())));

    if (OFFLINE) {
        add(GATE_APEX, false, "offline; reachability check skipped");
        add(GATE_TXT, false, "offline; DNS check skipped");
    } else {
        // ── Live gates ────────────────────────────────────────────────────────
        try {
            // `redirect: "manual"`, so a redirect arrives as a 3xx rather than
            // being followed. The reviewer checks the apex itself: a 301 to www
            // or to another host is not the apex serving HTTPS.
            const apex = await probe(APEX);
            const location = apex.headers.get("location");
            add(
                GATE_APEX,
                apex.status === 200,
                `${apex.status}${location ? ` -> ${location}` : ""} at ${APEX}`,
            );
        } catch (error) {
            add(GATE_APEX, false, String(error));
        }

        try {
            const records = await dnsTxt(VERIFY_HOST);
            add(
                GATE_TXT,
                records.length > 0,
                records.length ? `found ${records.length}: ${records.join(", ")}` : "NXDOMAIN — DNS is ours (Cloudflare), add via the control panel",
            );
        } catch (error) {
            add(GATE_TXT, false, `DNS query failed: ${String(error)}`);
        }
    }

    // ── Verdict ─────────────────────────────────────────────────────────────
    const gated = results.filter((r) => r.name.startsWith("extension live") || r.name.startsWith("domain registered"));
    const red = gated.filter((r) => !r.pass);
    const green = results.filter((r) => r.pass).length;
    const total = results.length;

    // Only the two clocks block a submission; the other gates are prep work the
    // publisher controls. Name what is actually red rather than assuming.
    const redNames = red.length ? red.map((r) => r.name).join("; ") : "none";
    console.log(`\n${green}/${total} gates pass — blocking gates red: ${redNames}`);
    if (red.length === 0) {
        console.log(`\nGO — submit the domain-verification request now (https://marketplace.visualstudio.com/manage → Details → Verified domain).`);
    } else {
        console.log(`\nNO-GO — earliest eligible submission: ${earliest.toISOString().slice(0, 10)}.`);
        console.log("You can add the TXT record today — the DNS is ours — so the moment the");
        console.log("clocks clear, verification is one button click away.");
    }

    // ── Evidence ────────────────────────────────────────────────────────────
    const outDir = join(root, "artifacts", "marketplace");
    mkdirSync(outDir, { recursive: true });
    const evidencePath = join(outDir, "publisher-verification-evidence.json");
    const evidence = {
        generatedAt: new Date().toISOString(),
        offline: OFFLINE,
        publisher: PUBLISHER_ID,
        displayName: PUBLISHER_DISPLAY,
        domain: DOMAIN,
        verificationTxtHost: VERIFY_HOST,
        gates: results,
        earliestEligibleSubmission: earliest.toISOString().slice(0, 10),
        goNoGo: red.length === 0 ? "GO" : "NO-GO",
    };
    writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));
    console.log(`\nEvidence written to ${evidencePath}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
