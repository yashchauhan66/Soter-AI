'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'../../../..'),dir=path.join(repo,'packages/vscode-extension/src/history-hooks'),get=n=>fs.readFileSync(path.join(dir,n),'utf8'),put=(n,s)=>fs.writeFileSync(path.join(dir,n),s,{flag:'wx'}),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
let processSource=get('PreCommitGitProcess.ts');
for(const[a,b]of [['PreCommitGit','PrePushGit'],['isCheckedHookIndex','isCheckedPushRefs'],['CheckedHookIndex','CheckedPushRefs'],['PRE_COMMIT_LIMITS','PRE_PUSH_LIMITS'],['./PreCommitProtocol','./PrePushProtocol'],['index:','refs:'],['this.options.index','this.options.refs']])processSource=processSource.replaceAll(a,b);
processSource=processSource.replace('function request(value: unknown): Request | undefined {','function request(value: unknown, refs: CheckedPushRefs): Request | undefined {');
const a=processSource.indexOf('    if (exact(value, ["kind"])) {'),b=processSource.indexOf('    if (!exact(value, ["kind", "objects"])',a);assert(a>0&&b>a);
processSource=processSource.slice(0,a)+`    if (exact(value, ["kind"])) {
        if (value.kind === "version") return { args: ["--version"], cap: 4096, version: true };
        if (value.kind === "commits") {
            const tips = [...new Set(refs.updates.filter(row => !row.deletion).map(row => row.localOid))];
            if (!tips.length || tips.length > PRE_PUSH_LIMITS.refs || !tips.every(oid)) return undefined;
            return { args: ["rev-list", "--max-count=33", "--stdin", "--"], stdin: tips.join("\\n") + "\\n", cap: 4096, version: false };
        }
    }
    if (exact(value, ["kind", "oid"]) && value.kind === "tree" && oid(value.oid))
        return { args: ["ls-tree", "-r", "-z", "--full-tree", "--long", value.oid, "--"], cap: 262144, version: false };
`+processSource.slice(b);
processSource=processSource.replace('count <= PRE_PUSH_LIMITS.entries','count <= PRE_PUSH_LIMITS.blobs').replace('request(this.options.operation)','request(this.options.operation, this.options.refs)');
processSource=processSource.replace('cannot be reused as owner commit calls','cannot be reused as owner push calls').replace('owner commit invocation','owner push invocation');
put('PrePushGitProcess.ts',processSource);
let scan=get('PreCommitScan.ts');
const importsEnd=scan.indexOf('export type PreCommitScanResult');assert(importsEnd>0);
scan=`import { types } from "node:util";
import { parseHistoryBatch, parseHistoryCommitList, parseHistoryTree } from "../history/GitHistoryProtocol";
import { supportsCheckedGitVersion } from "../terminal/CheckedGitMetadata";
import { isCheckedPushRefs, type CheckedPushRefs } from "./CheckedPushRefs";
import { PrePushGitProcess, type PrePushGitOutcome } from "./PrePushGitProcess";
import { PRE_PUSH_LIMITS } from "./PrePushProtocol";
import { inspectStagedBlob } from "./StagedContent";
\n`+scan.slice(importsEnd);
for(const[a,b]of [['PreCommitScan','PrePushScan'],['PreCommitGit','PrePushGit'],['CheckedHookIndex','CheckedPushRefs'],['isCheckedHookIndex','isCheckedPushRefs'],['PRE_COMMIT_LIMITS','PRE_PUSH_LIMITS'],['index:','refs:'],['this.options.index','this.options.refs']])scan=scan.replaceAll(a,b);
const opStart=scan.indexOf('type Operation ='),opEnd=scan.indexOf('interface ProcessOptions',opStart);
scan=scan.slice(0,opStart)+`export type PrePushScanOperation = Readonly<{ kind: "version" | "commits" } | { kind: "tree"; oid: string }
    | { kind: "batch"; objects: readonly Readonly<{ oid: string; size: number }>[] }>;
type Operation = PrePushScanOperation;
`+scan.slice(opEnd);
const runStart=scan.indexOf('            const listing ='),runEnd=scan.indexOf('            if (this.#valid()) status = candidate ? "BLOCK" : "ALLOW";',runStart);assert(runStart>0&&runEnd>runStart);
scan=scan.slice(0,runStart)+`            const tips = new Set(this.options.refs.updates.filter(row => !row.deletion).map(row => row.localOid));
            if (!tips.size) { if (this.#valid()) status = "ALLOW"; return; }
            const list = await this.#step({ kind: "commits" }, 4096); if (!list) return;
            const parsed = parseHistoryCommitList(list);
            if (parsed.capped || !parsed.commits.length || [...tips].some(tip => !parsed.commits.includes(tip))) return;
            const objects = new Map<string, { oid: string; size: number }>();
            const contexts = new Map<string, { oid: string; source: string }>();
            let total = 0, entries = 0, contextualBytes = 0;
            for (const commit of parsed.commits) {
                const raw = await this.#step({ kind: "tree", oid: commit }, 262144); if (!raw) return;
                const tree = parseHistoryTree(raw); entries += tree.blobs.length + tree.skipped;
                if (tree.skipped || entries > PRE_PUSH_LIMITS.entries) return;
                for (const row of tree.blobs) {
                    if (!this.#valid() || row.size > PRE_PUSH_LIMITS.blobBytes) return;
                    const before = objects.get(row.oid);
                    if (before && before.size !== row.size) return;
                    if (!before) {
                        total += row.size;
                        if (objects.size >= PRE_PUSH_LIMITS.blobs || total > PRE_PUSH_LIMITS.totalBytes) return;
                        objects.set(row.oid, { oid: row.oid, size: row.size });
                    }
                    const key = row.oid + "\\0" + row.source;
                    if (!contexts.has(key)) {
                        contextualBytes += row.size; if (contextualBytes > PRE_PUSH_LIMITS.totalBytes) return;
                        contexts.set(key, { oid: row.oid, source: row.source });
                    }
                }
            }
            if (!objects.size) { if (this.#valid()) status = "ALLOW"; return; }
            const expected = [...objects.values()];
            const batch = await this.#step({ kind: "batch", objects: expected }, total + expected.length * 96); if (!batch) return;
            const checked = parseHistoryBatch(batch, expected); this.#buffers.push(...checked.map(row => row.bytes));
            const blobs = new Map(checked.map(row => [row.oid, row.bytes])); let candidate = false;
            for (const row of contexts.values()) {
                if (!this.#valid()) return;
                const bytes = blobs.get(row.oid); if (!bytes) return;
                const classified = inspectStagedBlob(row.source, bytes);
                if (classified.status === "UNAVAILABLE") return;
                candidate ||= classified.status === "CANDIDATE";
            }
`+scan.slice(runEnd);
scan=scan.replace('Private complete-tree scan.','Private complete pushed-history scan.').replace('commit decision','push decision').replace('owner commit calls','owner push calls');put('PrePushScan.ts',scan);
const receipt={status:'NEW_F26B_SCANNER_AND_FINITE_RUNNER_COMPONENT_TESTS_PENDING',observedAt:new Date().toISOString(),derivedFrom:['PreCommitGitProcess.ts','PreCommitScan.ts'].map(n=>({path:n,sha256:sha(get(n))})),outputs:['PrePushGitProcess.ts','PrePushScan.ts'].map(n=>({path:n,sha256:sha(get(n))})),existingSourceChanged:0};
fs.writeFileSync(path.join(__dirname,'owned-scan-source-01.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(receipt));
