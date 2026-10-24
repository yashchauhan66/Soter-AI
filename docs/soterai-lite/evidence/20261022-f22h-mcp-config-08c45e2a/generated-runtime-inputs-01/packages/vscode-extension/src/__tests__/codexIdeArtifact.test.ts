import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const load=()=>import('../adapters/CodexIdeAdapterPolicy');
const fixture=(name:string)=>readFileSync(join(__dirname,'fixtures/codex-ide-26.51007.21434-'+name+'.json'));
const js='a8069de80c8f8141481d033f94c3a95e1b59f399143cb2554d3f68469dfbe5b8',native='f5521b058ca08e249afd3b25b4681e81100181d92e73aa6b94bb8e75c2aa487b';
test('F20B exact distinct IDE manifest/runtime/native pin accepted',async()=>{const p=await load();assert.equal(p.CODEX_IDE_PIN.version,'26.51007.21434');assert.equal(p.CODEX_IDE_PIN.runtimeVersion,'0.162.0-alpha.17.2');assert.equal(p.verifyCodexIdeArtifact(fixture('manifest'),js,fixture('runtime-package'),native),true);});
for(const kind of['manifest','javascript','runtime-package','native'])test('F20B independent pin component drift refused '+kind,async()=>{const p=await load();assert.equal(p.verifyCodexIdeArtifact(kind==='manifest'?Buffer.from('{}'):fixture('manifest'),kind==='javascript'?'0'.repeat(64):js,kind==='runtime-package'?Buffer.from('{}'):fixture('runtime-package'),kind==='native'?'0'.repeat(64):native),false);});
