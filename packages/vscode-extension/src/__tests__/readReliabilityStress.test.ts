import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { readBoundaryFile } from "../ai-boundary/readFile";
import { ReadReliability, installReadReliabilityOwner } from "../security/ReadReliability";

test("F28-S01: bounded reads remain usable in a 4096-file synthetic repo and two independent roots", { timeout: 60000 }, async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), "soterai-f28-stress-"));
    const a = path.join(base, "a"), b = path.join(base, "b"), owner = new ReadReliability({ enabled: () => true });
    installReadReliabilityOwner(owner);
    try {
        await fs.mkdir(a); await fs.mkdir(b);
        for (let start = 0; start < 4096; start += 32) await Promise.all(Array.from({ length: 32 }, (_, j) =>
            fs.writeFile(path.join(a, "public-" + (start + j) + ".txt"), "Public synthetic context " + (start + j))));
        await fs.writeFile(path.join(b, "public.txt"), "Second independent public project");
        const started = performance.now(); let bytes = 0;
        // A measured bounded selected-file workload, not a claim that all4096
        // files were scanned or that the VS Code discovery double is native.
        for (let index = 0; index < 128; index++) {
            const text = await readBoundaryFile(a, path.join(a, "public-" + index + ".txt"));
            assert.equal(text, "Public synthetic context " + index); bytes += Buffer.byteLength(text);
        }
        assert.equal(await readBoundaryFile(b, path.join(b, "public.txt")), "Second independent public project");
        await assert.rejects(readBoundaryFile(a, path.join(b, "public.txt")));
        const elapsed = performance.now() - started; assert(elapsed < 60000); assert(bytes < 1048576);
        assert.equal(owner.status().activeReads, 0);
        console.log(JSON.stringify({ scope: "COMPONENT_SELECTED128_OF_SYNTHETIC4096_NOT_NATIVE_DISCOVERY", files: 4096,
            selectedReads: 128, secondRootPublic: true, crossRootWithheld: true, bytes, elapsedMilliseconds: elapsed }));
    } finally {
        owner.dispose(); installReadReliabilityOwner(new ReadReliability({ enabled: () => true }));
        assert.equal(path.dirname(path.resolve(base)), path.resolve(os.tmpdir())); assert(path.basename(base).startsWith("soterai-f28-stress-"));
        await fs.rm(base, { recursive: true, force: true });
    }
});
