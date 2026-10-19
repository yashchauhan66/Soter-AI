'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');const repo=path.resolve(__dirname,'../../../..'),tests=path.join(repo,'packages/vscode-extension/src/__tests__'),file=path.join(tests,'codexResponsesOwner.test.ts'),before=fs.readFileSync(file);
fs.writeFileSync(path.join(__dirname,'codexResponsesOwner-original-01.ts'),before,{flag:'wx'});
let text=before.toString('utf8').replace('const session=','const session=');
text=text.replace('endpoint="http://127.0.0.1:49155/v1/ai/openai-responses"','endpoint="http://127.0.0.1:49155/codex"');
text=text.replace('assert.match(config,/store/);','assert.match(config,/wire_api = "responses"/);');
text=text.replace('assert.ok(config.includes(endpoint));assert.ok(config.includes(credential));','assert.match(config,/base_url = "http:\/\/127\.0\.0\.1:\d+\/codex"/);assert.ok(!config.includes(credential));');
// Keep the literal regex escapes in the generated TS source.
text=text.replace('assert.match(config,/base_url = "http://127.0.0.1:d+/codex"/);','assert.match(config,/base_url = "http:\\/\\/127\\.0\\.0\\.1:\\d+\\/codex"/);');
fs.writeFileSync(file,text);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');fs.writeFileSync(path.join(__dirname,'owner-contract-review-01.json'),JSON.stringify({status:'FROZEN_BEFORE_PROXY_OR_OWNER_IMPLEMENTATION',original:sha(before),current:sha(Buffer.from(text)),bridgeTest:sha(fs.readFileSync(path.join(tests,'codexResponsesBridge.test.ts'))),reason:'Use a distinct revocable native capability rather than serializing the shared internal broker token. Renderer tests still check explicit local capability; owner config must omit internal token and select dynamic /codex proxy. Replace unsupported config store assertion with exact wire_api responses; actual body store=false remains enforced in frozen schema tests.',assertionsRemoved:0},null,2)+'\n',{flag:'wx'});
