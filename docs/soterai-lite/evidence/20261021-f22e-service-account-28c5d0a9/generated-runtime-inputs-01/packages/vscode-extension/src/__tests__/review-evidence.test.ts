import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { observeReviewCanary, writeReviewEvidence } from "../security/ReviewEvidence";

test("review evidence refuses overwrite and preserves earlier bytes", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "soter-review-record-"));
    try {
        const filename = path.join(root, "result.json");
        await writeReviewEvidence(filename, { status: "UNTESTED" }, true);
        const original = await readFile(filename, "utf8");
        await assert.rejects(writeReviewEvidence(filename, { status: "PASS" }, true), { code: "EEXIST" });
        assert.equal(await readFile(filename, "utf8"), original);
    } finally { await rm(root, { recursive: true, force: true }); }
});

test("disabled recording cannot fall back to legacy shared output", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "soter-review-disabled-"));
    try {
        const filename = path.join(root, "result.json");
        await writeFile(filename, "historical evidence");
        await assert.rejects(writeReviewEvidence(filename, {}, false), /disabled/);
        assert.equal(await readFile(filename, "utf8"), "historical evidence");
        await assert.rejects(writeReviewEvidence("shared.json", {}, true), /absolute/);
    } finally { await rm(root, { recursive: true, force: true }); }
});

test("existing review observation records either outcome; a prior expected leak is not required",()=>{
    assert.equal(observeReviewCanary('public synthetic result','synthetic private note',true),false);
    assert.equal(observeReviewCanary('synthetic private note','synthetic private note',true),true);
    assert.throws(()=>observeReviewCanary('public','synthetic',false),/disabled/);
    assert.throws(()=>observeReviewCanary('public','',true),/required/);
});
