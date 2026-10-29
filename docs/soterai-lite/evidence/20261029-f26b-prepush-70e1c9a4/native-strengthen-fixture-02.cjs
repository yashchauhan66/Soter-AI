"use strict";
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const sourceFile = path.join(__dirname, "native-prepush-01.host.ts.txt"), before = fs.readFileSync(sourceFile, "utf8");
let after = before;
function once(a, b) { if (after.split(a).length !== 2) throw Error("Expected one source-only fixture admission location"); after = after.replace(a, b); }
once('const stores = { signing: 0, backupKey: 0, record: 0, recovery: 0, unrelated: 0 };',
    'const stores = { signing: 0, backupKey: 0, record: 0, recovery: 0, unrelated: 0 };\nconst ownerListeners: Array<{ listened: boolean; loopback: boolean; closed: boolean }> = [];');
once('driverSha256: string; policy: Fact };', 'driverSha256: string; policy: Array<{ relative: string; fact: Fact }> };');
once('function fileHash(file: string, expected: string): void {',
    'async function ownerClosed(): Promise<void> { await until(() => ownerListeners.every(row => row.closed), "Actual owner listeners did not close after withdrawal."); }\n'
    + 'async function policyFacts(): Promise<Array<{ relative: string; fact: Fact }>> { const result = []; for (const name of [".aiignore", ".soterai/policy.json", ".soterai/team-policy.json", ".soterai-policy.json"]) result.push({ relative: name, fact: await fact(join(root, ...name.split("/"))) }); return result; }\n'
    + 'function fileHash(file: string, expected: string): void {');
once('if ((values[0] as { maxHeaderSize?: number })?.maxHeaderSize === 4096) ownerServers++; return Reflect.apply(nativeCreateServer, http, args); });',
    'const server = Reflect.apply(nativeCreateServer, http, args) as http.Server;\n'
    + '        if ((values[0] as { maxHeaderSize?: number })?.maxHeaderSize === 4096) { ownerServers++; const row = { listened: false, loopback: false, closed: false }; ownerListeners.push(row);\n'
    + '            server.once("listening", () => { row.listened = true; const address = server.address(); row.loopback = !!address && typeof address === "object" && address.address === "127.0.0.1" && address.port > 0; if (!row.loopback) halted = true; });\n'
    + '            server.once("close", () => row.closed = true); } return server; });');
once('const initialPolicy = await fact(join(root, ".soterai-policy.json"));', 'const initialPolicy = await policyFacts();');
once('await setFlag(false); await status("UNAVAILABLE"); await componentHook(', 'await setFlag(false); await status("UNAVAILABLE"); await ownerClosed(); await componentHook(');
once('"Config drift must withdraw owner."); await idle(); await componentHook(', '"Config drift must withdraw owner."); await idle(); await ownerClosed(); await componentHook(');
once('assert.deepEqual(await fact(join(root, ".soterai-policy.json")), initialPolicy);', 'assert.deepEqual(await policyFacts(), initialPolicy); assert(ownerListeners.every(row => row.listened && row.loopback));');
once('await setFlag(prior.oldFlag); await Promise.all(pendingChildren);', 'await setFlag(prior.oldFlag); await ownerClosed(); await Promise.all(pendingChildren);');
once('assert.deepEqual(await fact(join(root, ".soterai-policy.json")), prior.policy);', 'assert.deepEqual(await policyFacts(), prior.policy);');
once('children, requests: wires, reviews, secretStores: stores, ownerServers, sourceDocuments,', 'children, requests: wires, reviews, secretStores: stores, ownerServers, ownerListeners, sourceDocuments,');
fs.writeFileSync(path.join(__dirname, "native-prepush-02.host.ts.txt"), after, { flag: "wx" });
let checker = fs.readFileSync(path.join(__dirname, "native-fixture-static-01.cjs"), "utf8");
checker = checker.replaceAll('native-prepush-01.host.ts.txt', 'native-prepush-02.host.ts.txt').replaceAll('native-fixture-static-result-01.json', 'native-fixture-static-result-02.json');
fs.writeFileSync(path.join(__dirname, "native-fixture-static-02.cjs"), checker, { flag: "wx" });
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
fs.writeFileSync(path.join(__dirname, "native-fixture-strengthening-02.json"), JSON.stringify({ status: "SOURCE_ONLY_NOT_EXECUTED", previousSha256: sha(before), currentSha256: sha(after),
    changes: ["Observe actual owner listener listening/loopback/close events without replacing responses", "Wait actual owner listener close before config/flag absence checks; no signal, forced close or retries", "Preserve exact .aiignore/.soterai/policy.json/.soterai/team-policy.json and legacy policy facts"],
    cases: "UNCHANGED_30_PRIMARY_6_RESTART", executableEmitted: false, guiLaunched: false, gitPush: false }, null, 2) + "\n", { flag: "wx" });
process.stdout.write(JSON.stringify({ source: "native-prepush-02.host.ts.txt", bytes: Buffer.byteLength(after), sha256: sha(after), sourceOnly: true }) + "\n");
