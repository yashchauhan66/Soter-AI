const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const dir=path.resolve(__dirname,'../../../../packages/vscode-extension/src/history-hooks');
let s=fs.readFileSync(path.join(dir,'PreCommitWire.ts'),'utf8');
for(const[a,b]of [['PreCommit','PrePush'],['pre-commit','pre-push'],['indexSha256','transcriptSha256'],['indexIdentity','rootIdentity'],['indexFile','transcript']])s=s.replaceAll(a,b);
s='import { parsePrePushTranscript } from "./PrePushProtocol";\n'+s;
const before='typeof value.transcript !== "string" || !value.transcript || Buffer.byteLength(value.transcript, "utf8") > 2048\n            || /[\\x00-\\x1f\\x7f-\\x9f]/.test(value.transcript)';
assert(s.includes(before));s=s.replace(before,'!validTranscript(value.transcript)');
s=s.replace('const value = frame(raw, 4096);','const value = frame(raw, 49152);');
const helper=`function validTranscript(value: unknown): boolean {
    if (typeof value !== "string" || value.length > 43691 || !/^[A-Za-z0-9_-]*$/.test(value)) return false;
    const bytes = Buffer.from(value, "base64url");
    return bytes.toString("base64url") === value && parsePrePushTranscript(bytes) !== undefined;
}
`;
const at=s.indexOf('export function parseHookRequest(');assert(at>0);s=s.slice(0,at)+helper+s.slice(at);
s=s.replace('Signed metadata is not a commit capability until live owner and exact index','Signed metadata is not a push capability until live owner and exact transcript/root');
fs.writeFileSync(path.join(dir,'PrePushWire.ts'),s,{flag:'wx'});
