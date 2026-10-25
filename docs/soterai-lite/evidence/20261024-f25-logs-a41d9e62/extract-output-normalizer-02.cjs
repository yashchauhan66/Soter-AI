'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),file=path.join(repo,'packages/core/src/StreamingOutputRedactor.ts');
let original=fs.readFileSync(file,'utf8');let source=original.replaceAll('\r\n','\n');
fs.writeFileSync(path.join(__dirname,'StreamingOutputRedactor-before-normalizer-extract-02.ts'),original,{flag:'wx'});
const start=source.indexOf('export const STREAM_OUTPUT_LIMITS'),end=source.indexOf('export type OutputChannel');
assert(start>0&&end>start);const limits=source.slice(start,end);
const states=source.slice(source.indexOf('type ChannelState'),source.indexOf('const MASK'));
const methods=source.slice(source.indexOf('    #append('),source.lastIndexOf('\n}'));
assert(methods.includes('#normalize(state: ChannelState'));
const normalizer=`import { TextDecoder } from "node:util";
import type { OutputChannel } from "./StreamingOutputRedactor";
${limits}
${states}
/** Internal completed normalization only; deliberately omitted from index.ts.
 * The two guarded consumers own the original normalized bytes privately.
 * No UI, command, progress callback or failed-analysis fallback accepts them. */
export class StreamingOutputNormalizer {
    #states: Record<OutputChannel, ChannelState> | undefined = { stdout: channelState(), stderr: channelState() };
    #pieces: Array<{ channel: OutputChannel; text: string }> = [];
    #rawBytes = 0; #normalizedBytes = 0; #chunks = 0; #closed = false;
    push(channel: OutputChannel, bytes: Uint8Array): void {
        try {
            if (this.#closed || channel !== "stdout" && channel !== "stderr" || !(bytes instanceof Uint8Array)) throw Error();
            if (++this.#chunks > STREAM_OUTPUT_LIMITS.maxChunks) throw Error();
            this.#rawBytes += bytes.byteLength;
            if (this.#rawBytes > STREAM_OUTPUT_LIMITS.maxInputBytes) throw Error();
            const state = this.#states![channel];
            this.#append(channel, this.#normalize(state, state.decoder.decode(Buffer.from(bytes), { stream: true })));
        } catch { this.dispose(); throw Error("Completed output normalization unavailable."); }
    }
    finish(): Readonly<{ stdout: string; stderr: string; arrival: string; inputBytes: number }> {
        try {
            if (this.#closed) throw Error();
            for (const channel of ["stdout", "stderr"] as const) {
                const state = this.#states![channel];
                this.#append(channel, this.#normalize(state, state.decoder.decode()));
                if (state.mode !== "text") throw Error();
            }
            const result = Object.freeze({
                stdout: this.#pieces.filter(piece => piece.channel === "stdout").map(piece => piece.text).join(""),
                stderr: this.#pieces.filter(piece => piece.channel === "stderr").map(piece => piece.text).join(""),
                arrival: this.#pieces.map(piece => piece.text).join(""), inputBytes: this.#rawBytes,
            });
            this.dispose(); return result;
        } catch { this.dispose(); throw Error("Completed output normalization unavailable."); }
    }
    dispose(): void {
        this.#closed = true; this.#pieces = []; this.#states = undefined;
        this.#rawBytes = 0; this.#normalizedBytes = 0; this.#chunks = 0;
    }
${methods}
}
`;
function replace(before,after){assert.equal(source.split(before).length,2,'Exact extraction match required');source=source.replace(before,after);}
replace('import { TextDecoder } from "node:util";','import { StreamingOutputNormalizer, STREAM_OUTPUT_LIMITS } from "./StreamingOutputNormalizer";\nexport { STREAM_OUTPUT_LIMITS } from "./StreamingOutputNormalizer";');
replace(limits,'');replace(states,'');
replace('    #states: Record<OutputChannel, ChannelState> | undefined = { stdout: channelState(), stderr: channelState() };\n    #pieces: Array<{ channel: OutputChannel; text: string }> = [];','    #normalizer: StreamingOutputNormalizer | undefined = new StreamingOutputNormalizer();');
replace('    #rawBytes = 0;\n    #normalizedBytes = 0;\n    #chunks = 0;\n','');
const pushStart=source.indexOf('            if (channel !=='),pushEnd=source.indexOf('            return Object.freeze({ status: "BUFFERED" });',pushStart);
assert(pushStart>0&&pushEnd>pushStart);source=source.slice(0,pushStart)+'            this.#normalizer!.push(channel, bytes);\n'+source.slice(pushEnd);
const finishStart=source.indexOf('            for (const channel of ["stdout", "stderr"] as const)'),finishEnd=source.indexOf('            let redacted = false;',finishStart);
assert(finishStart>0&&finishEnd>finishStart);source=source.slice(0,finishStart)+'            const normalized = this.#normalizer!.finish();\n            let { stdout, stderr } = normalized;\n            const arrival = normalized.arrival;\n'+source.slice(finishEnd);
replace('this.#rawBytes * STREAM_OUTPUT_LIMITS.maxExpansion','normalized.inputBytes * STREAM_OUTPUT_LIMITS.maxExpansion');
replace('this.#pieces = []; this.#states = undefined; this.#matcher = undefined;\n        this.#rawBytes = 0; this.#normalizedBytes = 0; this.#chunks = 0;','this.#normalizer?.dispose(); this.#normalizer = undefined; this.#matcher = undefined;');
replace(methods,'');
assert(!/#(?:rawBytes|normalizedBytes|chunks|states|pieces|append|normalize)\b/.test(source));
fs.writeFileSync(path.join(repo,'packages/core/src/StreamingOutputNormalizer.ts'),normalizer,{flag:'wx'});fs.writeFileSync(file,source);
const collector=path.join(repo,'packages/vscode-extension/src/logs/ManagedLogCollector.ts');let text=fs.readFileSync(collector,'utf8').replaceAll('\r\n','\n');
fs.writeFileSync(path.join(__dirname,'ManagedLogCollector-before-normalizer-extract-02.ts'),text,{flag:'wx'});
function alter(before,after){assert.equal(text.split(before).length,2);text=text.replace(before,after);}
alter('import { completedLogParts }','import { StreamingOutputNormalizer } from "../../../core/src/StreamingOutputNormalizer";\nimport { completedLogParts }');
alter('#semantic?: StreamingOutputRedactor;','#semantic?: StreamingOutputNormalizer;');
alter('this.#semantic = new StreamingOutputRedactor([], { enabled: () => this.available() });','this.#semantic = new StreamingOutputNormalizer();');
alter('if (this.#redactor!.push(channel, bytes).status !== "BUFFERED" || this.#semantic!.push(channel, bytes).status !== "BUFFERED"\n                || !this.available()) throw Error();','if (this.#redactor!.push(channel, bytes).status !== "BUFFERED") throw Error();\n            this.#semantic!.push(channel, bytes); if (!this.available()) throw Error();');
alter('const privateNormalized = this.#semantic!.finish(exitCode);\n            if (privateNormalized.status !== "COMPLETE" || !this.available()) throw Error();','const privateNormalized = this.#semantic!.finish();\n            if (!this.available()) throw Error();');
alter('/** Owned finite output only. Both private F08 instances share exactly the same\n * bounds/normalization. The empty-registration instance supplies completed\n * semantic input privately; it is never a UI sink or a fallback release. */','/** Owned finite output only. The canonical internal F08 normalizer supplies\n * original completed semantic input privately, before heuristic replacement.\n * Its limits and control decoder are shared; no raw fallback reaches a sink. */');
fs.writeFileSync(collector,text);
console.log(JSON.stringify({status:'INTERNAL_SHARED_NORMALIZER_EXTRACTED_PENDING_TESTS',copiedNormalizeBytes:methods.length,barrelChanged:false}));
