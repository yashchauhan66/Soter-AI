import assert from "node:assert/strict";
import {test} from "node:test";
import * as fs from "node:fs/promises";
import path from "node:path";
import {tmpdir} from "node:os";
import {generateKeyPairSync,sign} from "node:crypto";
import {ACCEPTANCE_GATES,assessAcceptance} from "../acceptance/assess";
import {canonicalJson} from "../operations/ecs";
import {digest} from "../security/bounded";
const candidate="a".repeat(64);
test("source tests and scripted profiles cannot satisfy independent acceptance",async()=>{
    const report=await assessAcceptance(await fs.mkdtemp(path.join(tmpdir(),"soterai-acceptance-")),{schemaVersion:1,entries:[]},{schemaVersion:1,keys:[]},candidate);
    assert.equal(report.releaseReady,false);assert.equal(report.evidenceBindingsComplete,false);assert.deepEqual(report.missing,[...ACCEPTANCE_GATES]);
});
test("signed exact bytes count once per distinct reviewer and remain subject to owner review",async()=>{
    const root=await fs.mkdtemp(path.join(tmpdir(),"soterai-review-")),bytes=Buffer.from('Synthetic test evidence; not an actual human review.');await fs.writeFile(path.join(root,"evidence.txt"),bytes);
    const keys=generateKeyPairSync("ed25519"),reviewerId="b".repeat(64),reviewers={schemaVersion:1,keys:[{reviewerId,publicKey:keys.publicKey.export({type:"spki",format:"pem"}).toString(),human:true,independent:true}]};
    const payload={schemaVersion:1,gate:"human-pilot",candidateSha256:candidate,reviewerId,evidencePath:"evidence.txt",evidenceSha256:digest(bytes),observedAt:Date.now(),result:"PASS"};
    const entry={payload,signature:sign(null,Buffer.from(canonicalJson(payload)),keys.privateKey).toString("base64")};
    let report=await assessAcceptance(root,{schemaVersion:1,entries:[entry,entry]},reviewers,candidate);assert.equal(report.accepted["human-pilot"],1);assert.equal(report.rejectedEvidence,1);assert.ok(report.missing.includes("human-pilot"));assert.equal(report.releaseReady,false);
    await fs.appendFile(path.join(root,"evidence.txt"),"altered");report=await assessAcceptance(root,{schemaVersion:1,entries:[entry]},reviewers,candidate);assert.equal(report.rejectedEvidence,1);
});
test("one signer cannot become five independent pilots through reviewer aliases", async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), "soterai-review-alias-"));
    const bytes = Buffer.from("Synthetic pilot evidence, not an actual independent review.");
    await fs.writeFile(path.join(root, "evidence.txt"), bytes);
    const pair = generateKeyPairSync("ed25519"), pem = pair.publicKey.export({ type: "spki", format: "pem" }).toString();
    const keys = Array.from({ length: 5 }, (_, i) => ({ reviewerId: String(i + 1).repeat(64),
        publicKey: i % 2 ? pem.replaceAll("\n", "\r\n") : pem, human: true, independent: true }));
    const entries = keys.map(({ reviewerId }) => {
        const payload = { schemaVersion: 1, gate: "human-pilot", candidateSha256: candidate, reviewerId,
            evidencePath: "evidence.txt", evidenceSha256: digest(bytes), observedAt: Date.now(), result: "PASS" };
        return { payload, signature: sign(null, Buffer.from(canonicalJson(payload)), pair.privateKey).toString("base64") };
    });
    await assert.rejects(assessAcceptance(root, { schemaVersion: 1, entries }, { schemaVersion: 1, keys }, candidate));
});
test("reviewer registry requires actual public Ed25519 keys before accepting evidence", async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), "soterai-review-keys-"));
    const ed = generateKeyPairSync("ed25519"), ec = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    for (const publicKey of ["malformed", ed.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
        ec.publicKey.export({ type: "spki", format: "pem" }).toString()]) {
        await assert.rejects(assessAcceptance(root, { schemaVersion: 1, entries: [] }, { schemaVersion: 1,
            keys: [{ reviewerId: "b".repeat(64), publicKey, human: true, independent: true }] }, candidate));
    }
});
test("five distinct owner-trusted signer keys can satisfy the pilot evidence threshold", async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), "soterai-review-distinct-")), keys = [], entries = [];
    for (let i = 0; i < 5; i++) {
        const pair = generateKeyPairSync("ed25519"), reviewerId = String(i + 1).repeat(64), evidencePath = `pilot-${i}.txt`;
        const bytes = Buffer.from(`Synthetic distinct signer fixture ${i}; actual human identity is owner-reviewed.`);
        await fs.writeFile(path.join(root, evidencePath), bytes);
        keys.push({ reviewerId, publicKey: pair.publicKey.export({ type: "spki", format: "pem" }).toString(), human: true, independent: true });
        const payload = { schemaVersion: 1, gate: "human-pilot", candidateSha256: candidate, reviewerId,
            evidencePath, evidenceSha256: digest(bytes), observedAt: Date.now(), result: "PASS" };
        entries.push({ payload, signature: sign(null, Buffer.from(canonicalJson(payload)), pair.privateKey).toString("base64") });
    }
    const report = await assessAcceptance(root, { schemaVersion: 1, entries }, { schemaVersion: 1, keys }, candidate);
    assert.equal(report.accepted["human-pilot"], 5);
    assert.ok(!report.missing.includes("human-pilot"));
    assert.equal(report.rejectedEvidence, 0); assert.equal(report.releaseReady, false);
});
