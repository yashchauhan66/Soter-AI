import './phase2/register.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as stub from './phase2/vscode-stub';
import { PolicyStore } from '../firewall/PolicyStore';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('unknown policy versions cannot appear loaded and withdrawal preserves unavailable state',async()=>{
    const root=await mkdtemp(join(tmpdir(),'phase5-policy-status-'));
    try {
        stub.resetState(root); await mkdir(join(root,'.soterai'));
        for(const version of [2,0,1.5,'1',null]) {
            await writeFile(join(root,'.soterai/policy.json'),JSON.stringify({version,protectedFiles:['private.txt']}));
            assert.equal(await PolicyStore.status(),'invalid');
            const policy=await PolicyStore.load();
            assert.deepEqual(policy.protectedFiles,['**']);
        }
        await writeFile(join(root,'.soterai/policy.json'),JSON.stringify({version:1,protectedFiles:['private.txt']}));
        assert.equal(await PolicyStore.status(),'loaded');
        assert.ok((await PolicyStore.load()).protectedFiles.includes('private.txt'));
        stub.state.config.set('soterai.hardening.addOnlyPolicy',false);
        assert.equal(await PolicyStore.status(),'unavailable');
    } finally {stub.resetState();await rm(root,{recursive:true,force:true});}
});
