const fs = require('node:fs');
const path = require('node:path');
const testRoot = 'packages/vscode-extension/src/__tests__';
let source = fs.readFileSync(path.join(testRoot, 'preCommitOwnerService.test.ts'), 'utf8');
source = source.replaceAll('CheckedHookIndex', 'CheckedPushRefs').replaceAll('CheckedHookIndex', 'CheckedPushRefs');
source = source.replaceAll('../history-hooks/CheckedHookIndex', '../history-hooks/CheckedPushRefs');
source = source.replaceAll('PreCommitOwnerService', 'PrePushOwnerService').replaceAll('PreCommitWire', 'PrePushWire');
source = source.replaceAll('F26a', 'F26b').replaceAll('F26A', 'F26B').replaceAll('f26a', 'f26b');
source = source.replaceAll('prepareIndex', 'prepareRefs').replaceAll('syntheticIndex', 'syntheticRefs');
source = source.replaceAll('/pre-commit', '/pre-push').replaceAll('/%70re-commit', '/%70re-push');
source = source.replaceAll('indexSha256', 'transcriptSha256').replaceAll('indexIdentity', 'rootIdentity');
source = source.replaceAll('index', 'refs').replaceAll('Index', 'Refs');
source = source.replace('function refsBytes(): Buffer {', 'function obsoleteRefsBytes(): Buffer {');
const start = source.indexOf('function obsoleteRefsBytes(): Buffer {');
const end = source.indexOf('class FakeScan', start);
if(start < 0 || end < 0) throw Error('Expected source range');
source = source.slice(0,start) + `const TRANSCRIPT = Buffer.from("refs/heads/main " + "1".repeat(40) + " refs/heads/main " + "0".repeat(40) + "\\n");
async function syntheticRefs(): Promise<CheckedPushRefs> {
    const root = await mkdtemp(join(tmpdir(), "soter-f26b-owner-"));
    for (const relative of ["objects/info", "objects/pack", "refs/heads"]) await mkdir(join(root, ".git", ...relative.split("/")), { recursive: true });
    await writeFile(join(root, ".git", "config"), CONFIG, { flag: "wx" });
    await writeFile(join(root, ".git", "HEAD"), "ref: refs/heads/main\\n", { flag: "wx" });
    const { prepareCheckedPushRefs } = await import("../history-hooks/CheckedPushRefs");
    const value = await prepareCheckedPushRefs(root, TRANSCRIPT, { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, COMSPEC: process.env.COMSPEC }, () => true);
    assert(value, "Manual synthetic fixture must acquire genuine root-bound refs without a child."); return value;
}
` + source.slice(end);
source = source.replaceAll('refsFile: unknown', 'rawTranscript: Buffer').replaceAll('refsFile', 'transcript');
source = source.replaceAll('prepareRefs: async (root, transcript, environment, valid)', 'prepareRefs: async (root, transcript, environment, valid)');
source = source.replace('transcript: ".git/refs"', 'transcript: TRANSCRIPT.toString("base64url")');
source = source.replace('transcript: f.refs.transcript', 'transcript: TRANSCRIPT.toString("base64url")');
source = source.replace('request.transcript === f.refs.transcript', 'Buffer.isBuffer(request.transcript) && request.transcript.equals(TRANSCRIPT)');
source = source.replaceAll('rawTranscript: Buffer', 'transcript: Buffer');
source = source.replaceAll('beyond4096 bytes', 'beyond49152 bytes').replaceAll('Buffer.alloc(4097, 32)', 'Buffer.alloc(49153, 32)');
source = source.replaceAll('index', 'transcript');
source = source.replaceAll('DIRC roots', 'transcript/root metadata').replaceAll('selected-index', 'pushed-transcript');
source = source.replaceAll('effective-refs', 'exact transcript').replaceAll('effective refs', 'exact transcript');
// Root-directory identity, not an index byte stream, is the final metadata gate.
source = source.replace('const changed = refsBytes(); changed[40] ^= 1; await writeFile(f.refs.transcript, changed); gate.resolve(f.key);',
    'await writeFile(join(f.refs.root, ".git", "config"), CONFIG + "[alias]\\n unsafe = status\\n"); gate.resolve(f.key);');
const target = path.join(testRoot, 'prePushOwnerService.test.ts');
fs.writeFileSync(target, source, {flag:'wx'});
fs.writeFileSync(path.join(__dirname, 'client-owner-test-derivation-01.json'), JSON.stringify({
    source: path.join(testRoot, 'preCommitOwnerService.test.ts'), target,
    scope:'Real loopback HTTP and Ed25519; explicit fake scanner and genuine physical metadata; no child or Git push',
    transforms:'Separate route/wire, complete canonical push transcript instead of effective index, root/metadata final drift, request body cap49152'
},null,2)+'\n',{flag:'wx'});
