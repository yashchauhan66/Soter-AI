const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const out='packages/vscode-extension/src/adapters/', input=JSON.parse(fs.readFileSync(path.join(__dirname,'installed-public-inputs-02.json'),'utf8').replace(/^\uFEFF/,''));
const strip=e=>({relative:e.relative,bytes:e.bytes,sha256:e.sha256});
const data={version:input.version,entry:input.entry,files:input.files.map(strip),dependency:{name:input.dependencies[0].name,version:input.dependencies[0].version,files:input.dependencies[0].files.map(strip)},node:{bytes:input.node.bytes,sha256:input.node.sha256,version:input.node.version}};
if(data.files.length!==463||JSON.stringify(data).includes('Users/USER'))throw Error('Pin input mismatch');
fs.writeFileSync(out+'GeminiCliPinData.ts','// Exact reviewed public runtime inputs; no user configuration or absolute paths.\nexport const GEMINI_CLI_PIN = '+JSON.stringify(data,null,2)+';\n',{flag:'wx'});
let text=fs.readFileSync(out+'CodexCliAdapter.ts','utf8');
const begin=text.indexOf('import { CODEX_CLI_PIN'),end=text.indexOf('const RECEIPT',begin);
text=text.slice(0,begin)+`import { createGeminiCliPlan, geminiCliDigest, geminiCliProfileCurrent, undoGeminiCliProfile,
    type GeminiCliDependencies, type GeminiCliReceipt, type GeminiCliProfile } from "./GeminiCliAdapterPolicy";
import { GEMINI_CLI_PIN, verifyInstalledGeminiCli, geminiStampsCurrent, type GeminiStamp } from "./GeminiCliRuntimePin";
`+text.slice(end);
text=text.replaceAll('CodexResponsesBridge','GeminiGenerateContentBridge').replaceAll('./CodexResponsesBridge','./GeminiGenerateContentBridge').replaceAll('CodexHttpBridge','GeminiHttpBridge');
text=text.replaceAll('CodexCli','GeminiCli').replaceAll('codexCli','geminiCli').replaceAll('CODEX_CLI_PIN','GEMINI_CLI_PIN').replaceAll('Codex','Gemini').replaceAll('CODEX','GEMINI').replaceAll('codex','gemini');
text=text.replace('interface Stamp { file: string; dev: number; ino: number; size: number; mtimeMs: number }','interface Stamp { file: string; dev: number; ino: number; size: number; mtimeMs: number }');
text=text.replace('#pin: Stamp[]','#pin: GeminiStamp[]');
text=text.replace('(restoring || geminiCliAdapterEnabled() && safeReadMcpEnabled() && this.reader.isEnabled())','(restoring || !!this.manager && geminiCliAdapterEnabled() && safeReadMcpEnabled() && this.reader.isEnabled())');
const a=text.indexOf('    private async artifact()'),b=text.indexOf('    private async projectEligible()',a);
text=text.slice(0,a)+`    private async artifact(): Promise<void> { this.#pin = undefined; this.#pin = await verifyInstalledGeminiCli(); }
    private async artifactCurrent(): Promise<boolean> { return !!this.#pin && await geminiStampsCurrent(this.#pin); }
`+text.slice(b);
text=text.replace('[".gemini", ".agents"]','[".gemini"]');
text=text.replace('const directory = path.dirname(file);\n        if (!this.validProfile(directory) || !["config.toml", "recovery.json"].includes(path.basename(file))\n            || !same(await verifyOutputPath(directory, file), file))',`const parent = path.dirname(file), directory = path.basename(file) === "recovery.json" ? parent : path.dirname(parent);
        if (!this.validProfile(directory) || ![path.join(directory, "recovery.json"), path.join(directory, ".gemini", "settings.json"), path.join(directory, ".gemini", ".env")].some(p => same(p, file))
            || !same(await verifyOutputPath(directory, file), file))`);
text=text.replace('if (geminiCliDigest(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) !== expected)','if (createHash("sha256").update(bytes).digest("hex") !== expected)');
const dep=text.indexOf('    private dependencies(');
text=text.slice(0,dep)+`    private async readProfile(directory: string): Promise<GeminiCliProfile | undefined> {
        const settings = await this.read(path.join(directory, ".gemini", "settings.json")), environment = await this.read(path.join(directory, ".gemini", ".env"));
        return settings === undefined && environment === undefined ? undefined : { settings, environment };
    }
    private async writeProfile(directory: string, value: GeminiCliProfile | undefined, expected?: string): Promise<void> {
        const settings = path.join(directory, ".gemini", "settings.json"), environment = path.join(directory, ".gemini", ".env");
        if (value !== undefined) {
            if (typeof value.settings !== "string" || typeof value.environment !== "string") throw Error("Unavailable");
            await this.write(settings, value.settings);
            try { await this.write(environment, value.environment); }
            catch (e) { try { await this.write(settings, undefined, createHash("sha256").update(value.settings).digest("hex")); } catch { /* Preserve uncertainty. */ } throw e; }
            return;
        }
        const current = await this.readProfile(directory);
        if (!current || geminiCliDigest(current) !== expected) throw Error("Unavailable");
        // Validate both members before removing either; each final removal also
        // binds bytes and identity synchronously. Partial failures retain receipt.
        for (const [file, content] of [[settings, current.settings], [environment, current.environment]] as const)
            if (content !== undefined && !same(await verifyOutputPath(directory, file), file)) throw Error("Unavailable");
        if (geminiCliDigest(await this.readProfile(directory)) !== expected) throw Error("Unavailable");
        for (const [file, content] of [[settings, current.settings], [environment, current.environment]] as const)
            if (content !== undefined) this.removeOwned(file, createHash("sha256").update(content).digest("hex"));
    }
`+text.slice(dep);
text=text.replace('read: () => this.read(path.join(directory, "config.toml"))','read: () => this.readProfile(directory)');
text=text.replace('return this.write(path.join(directory, "config.toml"), value, expected);','return this.writeProfile(directory, value, expected);');
text=text.replace('Dedicated GEMINI_HOME: ','Dedicated GEMINI_CLI_HOME: ');
text=text.replace('Select this dedicated home explicitly when launching Gemini.','Select this dedicated home and curated HOME/system-settings/env variables before startup; home dotenv loads late and inherited variables win.');
text=text.replaceAll('await this.read(path.join(directory, "config.toml"))','await this.readProfile(directory)');
text=text.replace('await mkdir(directory); await this.parent(directory);','await mkdir(directory); await this.parent(directory); await this.parent(path.join(directory, ".gemini"));');
text=text.replaceAll('geminiResponses','geminiGenerateContent');
text=text.replace('/v1/ai/openai-responses/responses','/v1/ai/gemini/generate-content');
text=text.replace('Dedicated text Responses and safe-read profile; output is buffered for complete inspection. Overrides, unsupported context/attachments and other profiles remain uncovered; current owner routing unverified.','Dedicated stateless text GenerateContent and safe-read profile; output is buffered for complete inspection. Explicit launch home/system-settings/env selection required; inherited/project/argv overrides, native reads, opaque signatures/media/state and other profiles remain uncovered; current owner routing unverified.');
text=text.replaceAll('separate MCP/Responses roles','separate MCP/GenerateContent roles');
if(text.includes('config.toml')||text.includes('verifyGeminiCliArtifact'))throw Error('Unconverted owner');
fs.writeFileSync(out+'GeminiCliAdapter.ts',text,{flag:'wx'});
console.log(JSON.stringify({status:'IMPLEMENTED_NOT_VERIFIED',files:['GeminiCliPinData.ts','GeminiCliAdapter.ts'],sourceSha256:crypto.createHash('sha256').update(text).digest('hex')}));
