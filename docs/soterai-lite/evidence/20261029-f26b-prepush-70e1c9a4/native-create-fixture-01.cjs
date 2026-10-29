"use strict";
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const root = process.cwd();
const reference = fs.readFileSync(path.join(root, "packages/vscode-extension/src/__tests__/host/litePreCommitGuard.host.ts"), "utf8");
const fragment = fs.readFileSync(path.join(__dirname, "native-prepush-body-01.ts.txt"), "utf8");
function between(a, b) { const start = reference.indexOf(a), end = reference.indexOf(b, start); if (start < 0 || end < start) throw Error("Exact retained native helper boundary absent"); return reference.slice(start, end); }
let helpers = between("function safeMetadata", "async function setupGit");
helpers = helpers.slice(0, helpers.indexOf("function ownerEnv")) + helpers.slice(helpers.indexOf("function assertDiscovery"));
helpers += between("async function runtimeFacts", "async function call");
helpers = helpers.replaceAll("pre-commit", "pre-push").replaceAll("PreCommit", "PrePush").replaceAll("preCommit", "prePush")
    .replaceAll('"pre-push-client.js"', '"pre-commit-client.js"')
    .replaceAll('!["sizes", "batch"].includes(operation)', '!["commits", "batch"].includes(operation)')
    .replaceAll('JSON.stringify(process.env) === parentEnvironment', 'environmentDigest() === parentEnvironment');
const source = fragment.replace("/* INHERITED_CLOSED_EOF_HELPERS */", helpers);
if (source === fragment || source.includes("/* INHERITED_CLOSED_EOF_HELPERS */")) throw Error("Missing unique native utility insertion");
const target = path.join(__dirname, "native-prepush-01.host.ts.txt");
fs.writeFileSync(target, source, { flag: "wx" });
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
fs.writeFileSync(path.join(__dirname, "native-fixture-derivation-01.json"), JSON.stringify({ status: "PREPARED_SOURCE_ONLY_NO_DRIVER_EMIT_NO_LAUNCH", reference: "packages/vscode-extension/src/__tests__/host/litePreCommitGuard.host.ts", referenceSha256: sha(reference),
    fragment: path.basename(__filename).replace("create-fixture", "prepush-body").replace(".cjs", ".ts.txt"), fragmentSha256: sha(fragment), source: path.basename(target), sourceSha256: sha(source), bytes: Buffer.byteLength(source),
    inherited: "Bounded direct child observation, actual close+bothEOF/no-signals, read-only artifact facts, real signed envelope checking and encrypted-backup witnesses", modified: "Separate F26b domains/request shape/process operations/manual object histories/direct wrapper component route; environment comparison digest-only",
    pushes: "NOT_AUTHORIZED_NOT_RUN; direct shell hook invocation is explicitly component native route only", native09: "USER_DEFERRED_NOT_RUN", sourceOnly: true }, null, 2) + "\n", { flag: "wx" });
process.stdout.write(JSON.stringify({ source: path.basename(target), bytes: Buffer.byteLength(source), sha256: sha(source), status: "PREPARED_SOURCE_ONLY_NOT_EXECUTED" }) + "\n");
