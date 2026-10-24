import assert from "node:assert/strict";
import test from "node:test";
import { assertWindowsAcl, validateWindowsPrivatePath, type AclMetadata } from "../WindowsAcl";
import { createTokenStorage } from "../auth";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname, basename } from "node:path";

const owner = "S-1-5-21-1-2-3-1001";
const safe = (): AclMetadata => ({ owner, currentUser: owner, protected: true, rules: [owner,"S-1-5-18","S-1-5-32-544"].map(sid => ({ sid, type: "Allow", rights: 0x1f01ff, inherited: false })) });
test("Windows metadata denies inherited/group access, foreign ownership, missing owner rights and deny ACEs", () => {
    assert.doesNotThrow(() => assertWindowsAcl(safe()));
    for (const mutate of [
        (a: AclMetadata) => { a.protected = false; },
        (a: AclMetadata) => { a.rules[0].inherited = true; },
        (a: AclMetadata) => { a.owner = "S-1-5-18"; },
        (a: AclMetadata) => { a.rules[0].rights = 0x120089; },
        (a: AclMetadata) => { a.rules[0].type = "Deny"; },
        (a: AclMetadata) => { a.rules.push({ sid: "S-1-5-21-1-2-3-1007", type: "Allow", rights: 0x1200a9, inherited: false }); },
    ]) { const a=safe(); mutate(a); assert.throws(() => assertWindowsAcl(a)); }
});
test("parent read-only foreign ACE allowed; foreign replacement/write authority denied", () => {
    const a=safe(); a.protected=false; a.rules.push({sid:"S-1-5-21-1-2-3-1007",type:"Allow",rights:0x1200a9,inherited:true});
    assert.doesNotThrow(() => assertWindowsAcl(a,true));
    a.rules[3].rights=0x1f01ff; assert.throws(() => assertWindowsAcl(a,true), /foreign write/);
});
test("metadata failure occurs before reading even an invalid synthetic token", { skip: process.platform !== "win32" }, async () => {
    const root=await mkdtemp(join(tmpdir(),"soterai-acl-unit-"));
    try {
        await writeFile(join(root,"auth-token"),"intentionally-invalid-synthetic");
        const load=createTokenStorage({ validate: async () => { throw new Error("synthetic ACL denied"); }, protectNew: async () => {} });
        await assert.rejects(load(root), /synthetic ACL denied/);
    } finally {
        assert.equal(dirname(resolve(root)),resolve(tmpdir())); assert.ok(basename(root).startsWith("soterai-acl-unit-"));
        await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:100});
    }
});
test("ACL flag off withdraws file authentication", async () => {
    const old=process.env.SOTERAI_BROKER_WIN32_ACL_VALIDATE;
    process.env.SOTERAI_BROKER_WIN32_ACL_VALIDATE="0";
    try { await assert.rejects(validateWindowsPrivatePath("synthetic-never-inspected"), /unavailable/); }
    finally { if (old === undefined) delete process.env.SOTERAI_BROKER_WIN32_ACL_VALIDATE; else process.env.SOTERAI_BROKER_WIN32_ACL_VALIDATE=old; }
});
