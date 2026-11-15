import assert from "node:assert/strict";
import { test } from "node:test";
import { ProjectJourney, JOURNEY_STEPS, JOURNEY_TOOLS } from "../project-journey/ProjectJourney";
test("journey connects existing commands but never marks opening a workflow as protected", async () => {
    const calls: string[] = [], journey = new ProjectJourney({ binding: () => "current", execute: async command => { calls.push(command); return { status: "OPENED" }; },
        scan: async () => ({ status: "clean", scannedFiles: 3, findings: [] }), chooseTool: async () => JOURNEY_TOOLS[0] });
    assert.equal((await journey.run("context")).status, "REVIEWED"); assert.deepEqual(calls, ["soterai.chooseReviewedContext"]);
    assert.ok(!journey.rows().some(row => row.description.includes("Protected")));
    await journey.run("scan"); assert.match(journey.rows()[0].description, /3 admitted saved files/);
});
test("drift while choosing a tool cannot execute a stale or injected command", async () => {
    let binding = "before", calls = 0;
    const journey = new ProjectJourney({ binding: () => binding, execute: async () => { calls++; }, scan: async () => ({ status: "incomplete", scannedFiles: 0, findings: [] }),
        chooseTool: async () => { binding = "after"; return JOURNEY_TOOLS[0]; } });
    assert.equal((await journey.run("tool")).status, "UNAVAILABLE"); assert.equal(calls, 0);
    assert.equal((await journey.run({ id: "tool" })).status, "UNAVAILABLE");
});
test("cancelled, incomplete and disposed journeys retain honest states", async () => {
    const journey = new ProjectJourney({ binding: () => "current", execute: async () => ({ status: "CANCELLED" }), scan: async () => ({ status: "incomplete", scannedFiles: 0, findings: [] }), chooseTool: async () => undefined });
    assert.equal((await journey.run("tool")).status, "CANCELLED"); assert.equal((await journey.run("vault")).status, "CANCELLED");
    assert.equal((await journey.run("scan")).status, "INCOMPLETE"); journey.invalidate(); assert.ok(journey.rows().every(r => r.description === "Not verified"));
    journey.dispose(); assert.equal((await journey.run("scan")).status, "UNAVAILABLE");
});
test("every fixed workflow has a distinct action and no arbitrary host command", () => {
    assert.equal(new Set(JOURNEY_STEPS.map(step => step.id)).size, JOURNEY_STEPS.length);
    assert.ok(JOURNEY_STEPS.every(step => !("command" in step) || step.command.startsWith("soterai.")));
});
test("guided recommendations react to findings, cancellation and workspace drift", async () => {
    const journey = new ProjectJourney({ binding: () => "current", execute: async () => ({ status: "CANCELLED" }),
        scan: async () => ({ status: "findings", scannedFiles: 2, findings: [{}] }), chooseTool: async () => undefined });
    assert.equal(journey.recommended(), "scan"); await journey.run("scan"); assert.equal(journey.recommended(), "vault");
    await journey.run("vault"); assert.equal(journey.recommended(), "vault"); journey.invalidate(); assert.equal(journey.recommended(), "scan");
});
test("local verification shows real check counts and never becomes live-route protection", async () => {
    const stamp = new Date().toISOString(), hash = "a".repeat(64);
    const report = { schemaVersion: 1, binding: hash, extensionSha256: hash, brokerSha256: hash, verifiedAt: stamp,
        checks: [{ id: "secret-matching", status: "PASS", passed: 3, total: 3 }, { id: "output-redactor", status: "PASS", passed: 10, total: 10 }, { id: "gateway-loopback", status: "NOT_TESTED", passed: 0, total: 6 }] };
    const journey = new ProjectJourney({ binding: () => "current", execute: async () => ({ status: "OPENED", report: { state: "CURRENT", report } }),
        scan: async () => ({ status: "clean", scannedFiles: 1, findings: [] }), chooseTool: async () => undefined });
    assert.equal((await journey.run("verify")).status, "INCOMPLETE");
    const row = journey.rows().find(row => row.id === "verify")!;
    assert.match(row.description, /2 local checks passed; 0 failed; 1 untested/);
    assert.match(row.description, /Live AI route unverified/);
});
