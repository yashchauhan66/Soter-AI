import assert from "node:assert/strict";
import test from "node:test";

import { soterGuardBaseDescription } from "../shared/description";
import { SoterGuardV2 } from "../nodes/SoterGuard/v2/SoterGuardV2";

/**
 * The canvas subtitle and the node hints are n8n expression strings, evaluated
 * at render time from `$parameter` alone — they never run through execute(), so
 * the rest of the suite cannot see them. These tests evaluate the *actual*
 * shipped expression string (not a reimplementation of the logic) against a
 * parameter state, which is the only way to prove what the author sees.
 *
 * Both cases here are the same bug: Detection Engine is hidden for the audit and
 * passport-lifecycle actions (the hide list in properties.ts), and a value saved
 * before switching action lingers in `$parameter`. The subtitle and the
 * "Reduced protection" hint both used to read that stale value and advertise a
 * local engine on an action that never runs locally — and the hint collided
 * head-on with the lifecycle hint that says these actions never fall back.
 */

const node = new SoterGuardV2(soterGuardBaseDescription);
const SUBTITLE = String(node.description.subtitle);
const HINTS = node.description.hints ?? [];

/** Evaluate a real n8n `={{ ... }}` expression against a `$parameter` object. */
function evalExpr(expr: string, parameters: Record<string, unknown>): unknown {
  const inner = String(expr)
    .replace(/^=\{\{/, "")
    .replace(/\}\}$/, "");
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  return new Function("$parameter", `"use strict"; return ( ${inner} );`)(parameters);
}

const subtitle = (parameters: Record<string, unknown>): string => String(evalExpr(SUBTITLE, parameters));

function hintBy(substring: string) {
  const found = HINTS.find((h) => String(h.message).includes(substring));
  assert.ok(found, `no hint found containing: ${substring}`);
  return found!;
}
const condition = (h: { displayCondition?: string }, parameters: Record<string, unknown>): boolean =>
  evalExpr(String(h.displayCondition), parameters) === true;

// The five actions that hide Detection Engine and never touch the local engine.
const ENGINE_LESS = ["workflowAudit", "enrollIdentity", "issuePassport", "validatePassport", "revokePassport"];

// ---------------------------------------------------------------------------
// Subtitle
// ---------------------------------------------------------------------------

test("subtitle never appends an engine suffix on an action that hides the engine", () => {
  for (const action of ENGINE_LESS) {
    // LOCAL is the stale value the bug fed on: chosen for a guard, left behind
    // when the author switched to a passport action.
    const label = subtitle({ action, detectionEngine: "LOCAL" });
    assert.doesNotMatch(label, /·\s*local/i, `${action} advertised the local engine on the canvas`);
    assert.doesNotMatch(label, /·\s*cloud/i, `${action} advertised the cloud engine on the canvas`);
  }
});

test("agent-access subtitles read as their plain human label", () => {
  assert.equal(subtitle({ action: "enrollIdentity", detectionEngine: "LOCAL" }), "Register Agent");
  assert.equal(subtitle({ action: "validatePassport", detectionEngine: "CLOUD" }), "Validate Access");
  assert.equal(subtitle({ action: "revokePassport", detectionEngine: "LOCAL" }), "Revoke Access");
});

test("audit still shows no engine, as it always did", () => {
  assert.equal(subtitle({ action: "workflowAudit", detectionEngine: "LOCAL" }), "Audit Workflow Security");
});

test("the guard actions still show a non-default engine — the useful case is untouched", () => {
  assert.equal(subtitle({ action: "inputGuard", detectionEngine: "LOCAL", onThreat: "BLOCK" }), "Guard Input (block) · local");
  assert.equal(subtitle({ action: "piiRedactor", detectionEngine: "LOCAL" }), "Redact PII and Secrets · local");
});

test("AUTO stays silent and sensitivity still shows, in the right order", () => {
  assert.equal(subtitle({ action: "inputGuard", detectionEngine: "AUTO", onThreat: "BLOCK" }), "Guard Input (block)");
  assert.equal(
    subtitle({ action: "inputGuard", detectionEngine: "CLOUD", onThreat: "BLOCK", sensitivity: "STRICT" }),
    "Guard Input (block) · strict · cloud",
  );
});

// ---------------------------------------------------------------------------
// "Reduced protection" hint
// ---------------------------------------------------------------------------

test("the reduced-protection warning stays silent on actions that hide the engine", () => {
  const reduced = hintBy("Reduced protection");
  for (const action of ENGINE_LESS) {
    assert.equal(
      condition(reduced, { action, detectionEngine: "LOCAL" }),
      false,
      `reduced-protection warning fired on ${action}, which never uses the local engine`,
    );
  }
});

test("the reduced-protection warning still fires on the guard/scan actions in Local", () => {
  const reduced = hintBy("Reduced protection");
  for (const action of ["analyzeText", "inputGuard", "outputGuard", "piiRedactor", "ragScanner", "universalGuard"]) {
    assert.equal(condition(reduced, { action, detectionEngine: "LOCAL" }), true, `reduced-protection warning missing on ${action}`);
    assert.equal(condition(reduced, { action, detectionEngine: "AUTO" }), false, `reduced-protection warning wrongly fired on ${action} in Auto`);
  }
});

test("on a passport action the two engine hints no longer contradict each other", () => {
  const reduced = hintBy("Reduced protection");
  const lifecycle = hintBy("never fall back to Local");
  const state = { action: "validatePassport", detectionEngine: "LOCAL" };
  // Before the fix both were true at once: "you are on the weak local engine"
  // and "this action never uses the local engine".
  assert.equal(condition(reduced, state), false);
  assert.equal(condition(lifecycle, state), true);
});
