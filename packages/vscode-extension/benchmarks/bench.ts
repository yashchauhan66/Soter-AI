/**
 * SoterAI IDE Guard -- VS Code Extension Benchmark
 *
 * Benchmarks the core operations the extension performs without requiring a
 * live VS Code host.  Run with:
 *
 *   npx tsx packages/vscode-extension/benchmarks/bench.ts
 */

import { performance } from "node:perf_hooks";
import * as fs from "node:fs";
import * as path from "node:path";

// ── guard-core import (resolves to ../../guard-core/src/index) ──────────────
import { DecisionEngine, PolicyEvaluator, HashCache } from "../../guard-core/src/index";

// ── helpers ─────────────────────────────────────────────────────────────────

const EXT_ROOT = path.resolve(__dirname, "..");

function fmtMs(ms: number): string {
    return ms < 1000 ? `${ms.toFixed(2)} ms` : `${(ms / 1000).toFixed(2)} s`;
}

function fmtSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    return kb < 1024 ? `${kb.toFixed(1)} KB` : `${(kb / 1024).toFixed(2)} MB`;
}

function generateContent(sizeBytes: number): string {
    // Produce realistic-looking source code content at the requested size.
    const line = "const secret = process.env.DATABASE_URL; // TODO: remove\n";
    const repeats = Math.max(1, Math.ceil(sizeBytes / Buffer.byteLength(line)));
    return line.repeat(repeats).slice(0, sizeBytes);
}

type Result = {
    name: string;
    value: string;
    target: string;
    pass: boolean;
    critical: boolean;
};

const results: Result[] = [];

function record(name: string, value: string, target: string, pass: boolean, critical = true): void {
    results.push({ name, value, target, pass, critical });
}

// ── 1. Engine construction ──────────────────────────────────────────────────

async function benchConstruction(): Promise<DecisionEngine> {
    const start = performance.now();
    const evaluator = new PolicyEvaluator({ mode: "local" });
    const cache = new HashCache();
    const engine = new DecisionEngine({ policyEvaluator: evaluator, hashCache: cache });
    const elapsed = performance.now() - start;

    const TARGET_MS = 50;
    record(
        "Engine construction",
        fmtMs(elapsed),
        `< ${TARGET_MS} ms`,
        elapsed < TARGET_MS,
    );
    return engine;
}

// ── 2. Single-file scan (various sizes) ─────────────────────────────────────

async function benchSingleFileScan(engine: DecisionEngine): Promise<void> {
    const sizes: Array<{ label: string; bytes: number; targetMs: number; critical: boolean }> = [
        { label: "1 KB",   bytes: 1_024,     targetMs: 10,  critical: false },
        { label: "10 KB",  bytes: 10_240,    targetMs: 20,  critical: true },
        { label: "100 KB", bytes: 102_400,   targetMs: 100, critical: false },
    ];

    for (const { label, bytes, targetMs, critical } of sizes) {
        const content = generateContent(bytes);
        const ITERATIONS = 50;
        const times: number[] = [];

        for (let i = 0; i < ITERATIONS; i++) {
            // Bypass cache so every iteration does real work.
            const start = performance.now();
            await engine.scan(content, { skipCache: true, context: "file" });
            times.push(performance.now() - start);
        }

        times.sort((a, b) => a - b);
        const p50 = times[Math.floor(ITERATIONS * 0.5)];
        const p95 = times[Math.floor(ITERATIONS * 0.95)];

        record(
            `Single scan ${label} (p50)`,
            fmtMs(p50),
            `info`,
            true,
            false,
        );
        record(
            `Single scan ${label} (p95)`,
            fmtMs(p95),
            `< ${targetMs} ms`,
            p95 < targetMs,
            critical,
        );
    }
}

// ── 3. Workspace scan simulation ────────────────────────────────────────────

async function benchWorkspaceScan(engine: DecisionEngine): Promise<void> {
    const CONCURRENCY = 8;
    const FILE_SIZE = 10_240; // 10 KB average

    async function simulateWorkspace(fileCount: number): Promise<number> {
        const content = generateContent(FILE_SIZE);
        const start = performance.now();
        let idx = 0;

        while (idx < fileCount) {
            const batch = Math.min(CONCURRENCY, fileCount - idx);
            const promises: Promise<unknown>[] = [];
            for (let j = 0; j < batch; j++) {
                promises.push(engine.scan(content, { skipCache: true, context: "workspace" }));
            }
            await Promise.all(promises);
            idx += batch;
        }

        return performance.now() - start;
    }

    // 100 files
    const elapsed100 = await simulateWorkspace(100);
    const TARGET_100 = 5_000;
    record(
        "Workspace scan 100 files",
        fmtMs(elapsed100),
        `< ${TARGET_100 / 1000}s`,
        elapsed100 < TARGET_100,
    );

    // 1000 files
    const elapsed1000 = await simulateWorkspace(1_000);
    const TARGET_1000 = 30_000;
    record(
        "Workspace scan 1000 files",
        fmtMs(elapsed1000),
        `< ${TARGET_1000 / 1000}s`,
        elapsed1000 < TARGET_1000,
    );
}

// ── 4. Bundle size checks ───────────────────────────────────────────────────

function benchBundleSize(): void {
    const bundles: Array<{ file: string; label: string; maxKB: number; critical: boolean }> = [
        { file: "dist/extension.js",       label: "extension.js bundle",       maxKB: 200, critical: true },
        { file: "dist/local-ai-broker.js", label: "local-ai-broker.js bundle", maxKB: 200, critical: false },
    ];

    for (const { file, label, maxKB, critical } of bundles) {
        const fullPath = path.join(EXT_ROOT, file);
        if (!fs.existsSync(fullPath)) {
            record(label, "NOT FOUND", `< ${maxKB} KB`, false, critical);
            continue;
        }
        const bytes = fs.statSync(fullPath).size;
        record(label, fmtSize(bytes), `< ${maxKB} KB`, bytes < maxKB * 1024, critical);
    }
}

// ── 5. VSIX size check ─────────────────────────────────────────────────────

function benchVsixSize(): void {
    const MAX_KB = 200;
    const vsixPattern = /\.vsix$/;
    const files = fs.readdirSync(EXT_ROOT).filter((f) => vsixPattern.test(f));

    if (files.length === 0) {
        record("VSIX package", "NOT FOUND", `< ${MAX_KB} KB`, false, true);
        return;
    }

    for (const file of files) {
        const fullPath = path.join(EXT_ROOT, file);
        const bytes = fs.statSync(fullPath).size;
        record(`VSIX (${file})`, fmtSize(bytes), `< ${MAX_KB} KB`, bytes < MAX_KB * 1024, true);
    }
}

// ── main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
    console.log("=".repeat(70));
    console.log("  SoterAI IDE Guard -- Extension Benchmark");
    console.log("=".repeat(70));
    console.log();

    const engine = await benchConstruction();
    await benchSingleFileScan(engine);
    await benchWorkspaceScan(engine);
    benchBundleSize();
    benchVsixSize();

    // ── report ──────────────────────────────────────────────────────────────
    console.log();
    const nameWidth = Math.max(...results.map((r) => r.name.length)) + 2;
    const valWidth = Math.max(...results.map((r) => r.value.length)) + 2;

    console.log(
        "Name".padEnd(nameWidth) +
        "Result".padEnd(valWidth) +
        "Target".padEnd(16) +
        "Status",
    );
    console.log("-".repeat(nameWidth + valWidth + 16 + 6));

    for (const r of results) {
        const status = r.pass ? "PASS" : r.critical ? "FAIL" : "WARN";
        const icon = r.pass ? "[OK]" : r.critical ? "[!!]" : "[??]";
        console.log(
            r.name.padEnd(nameWidth) +
            r.value.padEnd(valWidth) +
            r.target.padEnd(16) +
            `${icon} ${status}`,
        );
    }

    console.log();

    const criticalFails = results.filter((r) => !r.pass && r.critical);
    if (criticalFails.length > 0) {
        console.log(`BENCHMARK FAILED -- ${criticalFails.length} critical target(s) missed:`);
        for (const f of criticalFails) {
            console.log(`  - ${f.name}: ${f.value} (target: ${f.target})`);
        }
        process.exit(1);
    }

    const warns = results.filter((r) => !r.pass && !r.critical);
    if (warns.length > 0) {
        console.log(`Benchmark passed with ${warns.length} warning(s).`);
    } else {
        console.log("All benchmarks passed.");
    }
}

main().catch((err) => {
    console.error("Benchmark crashed:", err);
    process.exit(2);
});
