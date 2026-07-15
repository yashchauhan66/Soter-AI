import assert from "node:assert/strict";
import test from "node:test";
import { buildPilotEvent, privacySafePilotProperties } from "../lib/pilot/events";
import { forbiddenClaims, heroCopy, productStatus } from "../lib/marketing/launchStatus";

test("pilot telemetry strips raw prompt, secret, token, and output-like fields", () => {
  const safe = privacySafePilotProperties({
    source: "vscode",
    scans: 3,
    prompt: "raw user prompt",
    apiKey: "sk-test",
    output: "raw model output",
    blocked: true,
  });

  assert.equal(safe.source, "vscode");
  assert.equal(safe.scans, 3);
  assert.equal(safe.blocked, true);
  assert.equal("prompt" in safe, false);
  assert.equal("apiKey" in safe, false);
  assert.equal("output" in safe, false);
});

test("pilot telemetry uses prefixed product events", () => {
  const event = buildPilotEvent({ eventType: "first_scan_completed", properties: { surface: "api" } });
  assert.equal(event.eventType, "pilot.first_scan_completed");
  assert.equal(event.properties.surface, "api");
});

test("positioning exposes required hero copy and honest status labels", () => {
  assert.match(heroCopy.headline, /Stop sensitive company data/);
  assert.ok(productStatus.some((product) => product.name === "API Guard" && product.status === "Stable"));
  assert.ok(productStatus.some((product) => product.status === "Beta"));
  assert.ok(productStatus.some((product) => product.status === "Labs"));
  assert.equal(forbiddenClaims["100% secure"], false);
  assert.equal(forbiddenClaims["SOC2 compliant"], false);
});
