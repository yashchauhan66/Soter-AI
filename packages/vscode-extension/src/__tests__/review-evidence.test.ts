import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { writeReviewEvidence } from "../security/ReviewEvidence";

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
