'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');const base=__dirname,repo=path.resolve(base,'../../../..'),adapter=path.join(repo,'packages/vscode-extension/src/adapters'),sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const mcpSource=fs.readFileSync(path.join(adapter,'CodexHttpBridge.ts'),'utf8'),providerSource=fs.readFileSync(path.join(adapter,'CodexResponsesBridge.ts'),'utf8');let mcp=mcpSource,provider=providerSource;
function replace(source,before,after){assert(source.includes(before),before.slice(0,100));return source.replace(before,after);}
mcp=mcp.replaceAll('CodexHttpDependencies','GeminiHttpDependencies').replaceAll('CodexHttpBridge','GeminiHttpBridge').replaceAll('CodexCliConnection','SafeReadConnection').replaceAll('"./CodexCliAdapterPolicy"','"../agent/SafeReadProtocol"').replaceAll('/codex/mcp','/gemini/mcp').replaceAll('Codex','Gemini CLI');
const start=mcp.indexOf('function turnMetadata('),end=mcp.indexOf('/** One private HTTP MCP role');assert(start>0&&end>start);mcp=mcp.slice(0,start)+`function metadata(v: unknown): boolean {
    if (v === undefined) return true;
    return record(v) && exact(v, ["progressToken"]) && Object.values(v).every(value => typeof value === "number"
        ? Number.isSafeInteger(value) && value >= 0 : label(value));
}
`+mcp.slice(end);
mcp=replace(mcp,'const duplicate = ["authorization", "host", "content-type"].some(key => req.rawHeaders.filter((_v, i) => i % 2 === 0 && req.rawHeaders[i].toLowerCase() === key).length !== 1);',`const duplicate = ["authorization", "host"].some(key => req.rawHeaders.filter((_v, i) => i % 2 === 0 && req.rawHeaders[i].toLowerCase() === key).length !== 1)
                || req.rawHeaders.filter((_v, i) => i % 2 === 0 && req.rawHeaders[i].toLowerCase() === "content-type").length > 1
                || req.method === "POST" && req.rawHeaders.filter((_v, i) => i % 2 === 0 && req.rawHeaders[i].toLowerCase() === "content-type").length !== 1;`);
mcp=replace(mcp,'req.method !== "POST" || req.url !== "/gemini/mcp"','!["POST", "GET", "DELETE"].includes(req.method ?? "") || req.url !== "/gemini/mcp"');
mcp=replace(mcp,'|| req.headers["content-type"] !== "application/json"','|| req.method === "POST" && req.headers["content-type"] !== "application/json"');
mcp=replace(mcp,'const session = this.#session, frame = await this.body(req);',`// Stateless MCP supports POST only. The pinned client treats405 as the
            // documented absence of an optional GET notification stream.
            if (req.method === "GET" || req.method === "DELETE") { req.resume(); res.writeHead(405, { allow: "POST", "cache-control": "no-store", connection: "close" }); res.end(); return; }
            const session = this.#session, frame = await this.body(req);`);
provider=provider.replaceAll('CodexResponsesBridge','GeminiGenerateContentBridge').replaceAll('CodexCliConnection','SafeReadConnection').replaceAll('"./CodexCliAdapterPolicy"','"../agent/SafeReadProtocol"').replaceAll('codex_route_unavailable','gemini_route_unavailable').replaceAll('/codex','/gemini').replaceAll('/v1/ai/openai-responses/responses','/v1/ai/gemini/generate-content');
provider=replace(provider,'interface Dependencies {','import { validGeminiModel, validateGeminiRequest } from "../../../../apps/local-ai-broker/src/GeminiGenerateContentSchema";\ninterface Dependencies {');
provider=replace(provider,'private body(req: IncomingMessage, signal: AbortSignal): Promise<string>','private body(req: IncomingMessage, signal: AbortSignal, model: string): Promise<string>');
provider=replace(provider,'const canonical = decodeBoundedJson(Buffer.concat(chunks), { maxBytes: 131072 }).canonical;',`const native = decodeBoundedJson(Buffer.concat(chunks), { maxBytes: 131072 }).body;
                    if (Object.hasOwn(native, "model") || Object.hasOwn(native, "stream")) throw Error("Unavailable");
                    const envelope = { ...native, model, stream: true }; validateGeminiRequest(envelope);
                    const canonical = JSON.stringify(envelope);`);
provider=replace(provider,'const expected = "Bearer " + this.#token, auth = req.headers.authorization;',`const expected = this.#token, auth = req.headers["x-goog-api-key"];
            const matched = /^\\/gemini\\/v1beta\\/models\\/([A-Za-z0-9][A-Za-z0-9._-]{0,63}):streamGenerateContent\\?alt=sse$/.exec(req.url ?? "");`);
provider=replace(provider,'["authorization", "host", "content-type"]','["x-goog-api-key", "host", "content-type"]');
provider=replace(provider,'req.url !== "/gemini/responses"','!matched || !validGeminiModel(matched[1]) || req.headers.authorization !== undefined');
provider=replace(provider,'const session = this.#session, controller = new AbortController();','const model = matched[1];\n            const session = this.#session, controller = new AbortController();');
provider=replace(provider,'this.body(req, controller.signal)','this.body(req, controller.signal, model)');
assert(!mcp.includes('Codex'));assert(!provider.includes('Codex'));assert(!provider.includes('/openai-responses'));assert(!provider.includes('req.url !== "/gemini/responses"'));
const files=[['GeminiHttpBridge.ts',mcp],['GeminiGenerateContentBridge.ts',provider]];for(const[name]of files)assert(!fs.existsSync(path.join(adapter,name)));for(const[name,value]of files)fs.writeFileSync(path.join(adapter,name),value,{flag:'wx'});
const result={status:'IMPLEMENTED_NOT_VERIFIED',scope:'Separate Gemini endpoint/lifecycle plumbing derived from established Codex transport mechanics; existing Codex files unchanged. Strict native body parser reuses Gemini schema, all secret decisions remain in owned broker/F04.',inputs:[{name:'CodexHttpBridge.ts',sha256:sha(mcpSource)},{name:'CodexResponsesBridge.ts',sha256:sha(providerSource)}],files:files.map(([name,value])=>({name,bytes:Buffer.byteLength(value),sha256:sha(value)})),time:new Date().toISOString()};fs.writeFileSync(path.join(base,'bridge-implementation-01.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));
