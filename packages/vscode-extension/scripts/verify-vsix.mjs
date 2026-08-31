import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const vscePackage = require.resolve("@vscode/vsce/package.json");
const yauzl = createRequire(vscePackage)("yauzl");
const extensionRoot = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(join(extensionRoot, "package.json"), "utf8"));
const defaultArtifact = join(extensionRoot, `${manifest.name}-${manifest.version}.vsix`);
const artifact = resolve(process.argv[2] ?? defaultArtifact);

if (!existsSync(artifact)) {
    throw new Error(`VSIX not found: ${artifact}. Run npm run package first.`);
}

const REQUIRED = new Set([
    "extension.vsixmanifest",
    "[Content_Types].xml",
    "extension/package.json",
    "extension/dist/extension.js",
    "extension/dist/local-ai-broker.js",
    "extension/dist/soterai-mcp-server.js",
]);
const FORBIDDEN = /(^|\/)(src|node_modules|__tests__|coverage|dist-test)(\/|$)|\.map$|\.log$|(^|\/)\.env($|\.)|FINAL-MASTER-PROMPT|vsix-integrity\.json$|\.ts$|\.vsix$/i;
const MAX_ENTRY_COUNT = 100;
const MAX_UNCOMPRESSED_BYTES = 15 * 1024 * 1024;

function inspectEntries(file) {
    return new Promise((resolveEntries, reject) => {
        yauzl.open(file, { lazyEntries: true, validateEntrySizes: true }, (openError, zip) => {
            if (openError || !zip) return reject(openError ?? new Error("Could not open VSIX"));
            const entries = [];
            zip.on("entry", (entry) => {
                if (entry.fileName.endsWith("/")) {
                    entries.push({ name: entry.fileName, bytes: entry.uncompressedSize, sha256: createHash("sha256").digest("hex") });
                    zip.readEntry();
                    return;
                }
                zip.openReadStream(entry, (streamError, stream) => {
                    if (streamError || !stream) return reject(streamError ?? new Error(`Could not read ${entry.fileName}`));
                    const hash = createHash("sha256");
                    let actualBytes = 0;
                    stream.on("data", (chunk) => { actualBytes += chunk.length; hash.update(chunk); });
                    stream.once("error", reject);
                    stream.once("end", () => {
                        if (actualBytes !== entry.uncompressedSize) {
                            reject(new Error(`Entry size mismatch for ${entry.fileName}`));
                            return;
                        }
                        entries.push({ name: entry.fileName, bytes: actualBytes, sha256: hash.digest("hex") });
                        zip.readEntry();
                    });
                });
            });
            zip.once("error", reject);
            zip.once("end", () => resolveEntries(entries));
            zip.readEntry();
        });
    });
}

function fileRef(name) {
    return `urn:soterai:vsix-file:${encodeURIComponent(name)}`;
}

function buildCycloneDx(entries, artifactHash) {
    const appRef = `pkg:vscode/${manifest.publisher}/${manifest.name}@${manifest.version}`;
    const files = entries
        .filter((entry) => !entry.name.endsWith("/"))
        .sort((a, b) => a.name.localeCompare(b.name));
    return {
        bomFormat: "CycloneDX",
        specVersion: "1.6",
        version: 1,
        metadata: {
            tools: { components: [{ type: "application", name: "soterai-vsix-verifier", version: "1" }] },
            component: {
                type: "application",
                "bom-ref": appRef,
                group: manifest.publisher,
                name: manifest.name,
                version: manifest.version,
                hashes: [{ alg: "SHA-256", content: artifactHash }],
                properties: [
                    { name: "soterai:artifact-kind", value: "vsix" },
                    { name: "soterai:runtime-dependency-model", value: "bundled-no-node_modules" },
                ],
            },
        },
        components: files.map((entry) => ({
            type: "file",
            "bom-ref": fileRef(entry.name),
            name: entry.name,
            hashes: [{ alg: "SHA-256", content: entry.sha256 }],
            properties: [{ name: "soterai:uncompressed-bytes", value: String(entry.bytes) }],
        })),
        dependencies: [
            { ref: appRef, dependsOn: files.map((entry) => fileRef(entry.name)) },
            ...files.map((entry) => ({ ref: fileRef(entry.name), dependsOn: [] })),
        ],
    };
}

function validateCycloneDx(bom, entries, artifactHash) {
    const errors = [];
    if (bom.bomFormat !== "CycloneDX" || bom.specVersion !== "1.6" || bom.version !== 1) errors.push("invalid CycloneDX document header");
    if (bom.metadata?.component?.hashes?.[0]?.content !== artifactHash) errors.push("top-level component is not bound to the VSIX hash");
    const files = entries.filter((entry) => !entry.name.endsWith("/"));
    if (bom.components?.length !== files.length) errors.push("component count does not match archive file count");
    const byName = new Map((bom.components ?? []).map((component) => [component.name, component]));
    for (const entry of files) {
        const component = byName.get(entry.name);
        if (!component || component.type !== "file") errors.push(`missing file component: ${entry.name}`);
        else if (component.hashes?.[0]?.content !== entry.sha256) errors.push(`hash mismatch in SBOM: ${entry.name}`);
    }
    const refs = new Set([bom.metadata?.component?.["bom-ref"], ...(bom.components ?? []).map((component) => component["bom-ref"])]);
    for (const dependency of bom.dependencies ?? []) {
        if (!refs.has(dependency.ref) || dependency.dependsOn.some((ref) => !refs.has(ref))) errors.push("dependency graph contains an unknown bom-ref");
    }
    if (errors.length) throw new Error(`CycloneDX validation failed:\n- ${errors.join("\n- ")}`);
}

function sha256(file) {
    return new Promise((resolveHash, reject) => {
        const hash = createHash("sha256");
        const stream = createReadStream(file);
        stream.on("data", (chunk) => hash.update(chunk));
        stream.once("error", reject);
        stream.once("end", () => resolveHash(hash.digest("hex")));
    });
}

const entries = await inspectEntries(artifact);
const names = new Set(entries.map((entry) => entry.name));
const missing = [...REQUIRED].filter((name) => !names.has(name));
const forbidden = entries.filter((entry) => FORBIDDEN.test(entry.name)).map((entry) => entry.name);
const duplicates = entries.map((entry) => entry.name).filter((name, index, all) => all.indexOf(name) !== index);
const unsafePaths = entries.map((entry) => entry.name).filter((name) =>
    name.startsWith("/") || name.includes("\\") || name.split("/").includes(".."),
);
const totalBytes = entries.reduce((sum, entry) => sum + entry.bytes, 0);
const failures = [];
if (missing.length) failures.push(`missing required entries: ${missing.join(", ")}`);
if (forbidden.length) failures.push(`forbidden entries: ${forbidden.join(", ")}`);
if (duplicates.length) failures.push(`duplicate entries: ${duplicates.join(", ")}`);
if (unsafePaths.length) failures.push(`unsafe archive paths: ${unsafePaths.join(", ")}`);
if (entries.length > MAX_ENTRY_COUNT) failures.push(`entry count ${entries.length} exceeds ${MAX_ENTRY_COUNT}`);
if (totalBytes > MAX_UNCOMPRESSED_BYTES) failures.push(`uncompressed size ${totalBytes} exceeds ${MAX_UNCOMPRESSED_BYTES}`);
if (failures.length) throw new Error(`VSIX integrity verification failed:\n- ${failures.join("\n- ")}`);

const artifactHash = await sha256(artifact);
const evidence = {
    schemaVersion: 1,
    artifact: basename(artifact),
    sha256: artifactHash,
    entryCount: entries.length,
    uncompressedBytes: totalBytes,
    requiredEntries: [...REQUIRED].sort(),
    entries: entries.sort((a, b) => a.name.localeCompare(b.name)),
    claimBoundary: "Artifact integrity inventory only; this is not a standards-compliant SBOM or a signature.",
};
const output = process.env.SOTERAI_VSIX_EVIDENCE
    ? resolve(process.env.SOTERAI_VSIX_EVIDENCE)
    : join(extensionRoot, "..", "..", "artifacts", "security", "vsix-integrity.json");
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
const cyclonedx = buildCycloneDx(entries, artifactHash);
validateCycloneDx(cyclonedx, entries, artifactHash);
const cyclonedxOutput = process.env.SOTERAI_CYCLONEDX_OUTPUT
    ? resolve(process.env.SOTERAI_CYCLONEDX_OUTPUT)
    : join(extensionRoot, "..", "..", "artifacts", "security", "vscode-extension.cdx.json");
mkdirSync(dirname(cyclonedxOutput), { recursive: true });
writeFileSync(cyclonedxOutput, `${JSON.stringify(cyclonedx, null, 2)}\n`, "utf8");
console.log(`VSIX verified: ${entries.length} entries, ${totalBytes} uncompressed bytes`);
console.log(`SHA-256: ${evidence.sha256}`);
console.log(`Evidence: ${output}`);
console.log(`CycloneDX 1.6 SBOM: ${cyclonedxOutput}`);