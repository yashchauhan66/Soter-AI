import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
const Module=require('node:module'),originalLoad=Module._load;
Module._load=function(request:string,parent:unknown,isMain:boolean){return request==='vscode'?{workspace:{workspaceFolders:[]}}:originalLoad.call(this,request,parent,isMain);};
const {runtimeStoreUnchanged}=require('../vault-runtime/RuntimeBinding') as typeof import('../vault-runtime/RuntimeBinding');
Module._load=originalLoad;
test('live runtime and gateway cipher guards withdraw while any portable import state exists', async()=>{
 const root=await fs.mkdtemp(path.join(tmpdir(),'soterai-portable-lease-'));const cipher='synthetic-encrypted-ciphertext';
 await fs.writeFile(path.join(root,'soterai-vault.enc'),cipher);assert.equal(runtimeStoreUnchanged(root,cipher),true);
 for(const name of ['vault-portable-import.json','vault-portable-import.enc','vault-portable-'+'a'.repeat(64)+'-12345678-1234-4234-8234-123456789012.tmp']){
  const file=path.join(root,name);await fs.writeFile(file,'synthetic recovery state');assert.equal(runtimeStoreUnchanged(root,cipher),false);await fs.unlink(file);
 }
 assert.equal(runtimeStoreUnchanged(root,cipher),true);
});
