import assert from "node:assert/strict";
import test from "node:test";
import {
  applyAttackerReputation,
  applyObservation,
  assessAttackerReputation,
  attackerFingerprint,
  recordAndAssessAttacker,
  type AttackerHistory,
  type AttackerObservation,
} from "../../lib/guard/attackerReputation";
import type { GuardResult, RiskType } from "../../lib/guard/types";

function history(partial: Partial<AttackerHistory>): AttackerHistory {
  return {
    attempts: 0,
    blocks: 0,
    reviews: 0,
    securityHits: 0,
    crescendo: 0,
    maxRiskScore: 0,
    firstAt: 0,
    lastAt: 0,
    ...partial,
  };
}

function result(partial: Partial<GuardResult>): GuardResult {
  return {
    allowed: true,
    action: "ALLOW",
    riskScore: 0,
    riskTypes: ["LOW_RISK"],
    reason: "ok",
    findings: [],
    metadata: {},
    ...partial,
  } as GuardResult;
}

test("fingerprint is stable, hashed, and key/IP sensitive", () => {
  const a = attackerFingerprint({ apiKeyId: "key1", clientIp: "1.2.3.4" });
  const b = attackerFingerprint({ apiKeyId: "key1", clientIp: "1.2.3.4" });
  const c = attackerFingerprint({ apiKeyId: "key1", clientIp: "9.9.9.9" });
  const d = attackerFingerprint({ apiKeyId: "key2", clientIp: "1.2.3.4" });
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.notEqual(a, d);
  assert.match(a, /^[a-f0-9]{32}$/);
  assert.doesNotMatch(a, /1\.2\.3\.4/); // raw IP is never present
});

test("clean history has no reputation", () => {
  const rep = assessAttackerReputation(history({ attempts: 3, blocks: 0 }));
  assert.equal(rep.level, "NONE");
  assert.equal(rep.score, 0);
});

test("repeated blocks escalate toward ABUSIVE / BANNED", () => {
  const suspect = assessAttackerReputation(history({ attempts: 2, blocks: 2, securityHits: 1 }));
  assert.equal(suspect.level, "SUSPECT");

  const abusive = assessAttackerReputation(
    history({ attempts: 4, blocks: 3, securityHits: 3 }),
  );
  assert.ok(abusive.score >= 60, `expected abusive score, got ${abusive.score}`);
  assert.equal(abusive.level, "ABUSIVE");

  const banned = assessAttackerReputation(
    history({ attempts: 8, blocks: 6, securityHits: 5, crescendo: 1 }),
  );
  assert.equal(banned.level, "BANNED");
  assert.ok(banned.signals.some((s) => s.startsWith("repeated-blocks")));
});

test("applyObservation folds guard outcomes into counters", () => {
  let h = history({ firstAt: 1000, lastAt: 1000 });
  const injection: AttackerObservation = {
    action: "BLOCK",
    riskScore: 85,
    riskTypes: ["PROMPT_INJECTION", "JAILBREAK"] as RiskType[],
    crescendoEscalated: true,
  };
  h = applyObservation(h, injection, 2000);
  assert.equal(h.attempts, 1);
  assert.equal(h.blocks, 1);
  assert.equal(h.securityHits, 1);
  assert.equal(h.crescendo, 1);
  assert.equal(h.maxRiskScore, 85);
  assert.equal(h.lastAt, 2000);
});

test("SUSPECT attaches metadata but does not change the decision", () => {
  const rep = assessAttackerReputation(history({ attempts: 2, blocks: 2 }));
  assert.equal(rep.level, "SUSPECT");
  const original = result({ action: "ALLOW", allowed: true });
  const applied = applyAttackerReputation(original, rep);
  assert.equal(applied.action, "ALLOW");
  assert.equal(applied.allowed, true);
  assert.equal((applied.metadata as { attacker?: { level?: string } }).attacker?.level, "SUSPECT");
});

test("ABUSIVE promotes HUMAN_REVIEW to BLOCK", () => {
  const rep = assessAttackerReputation(history({ attempts: 4, blocks: 3, securityHits: 3 }));
  assert.equal(rep.level, "ABUSIVE");
  const applied = applyAttackerReputation(result({ action: "HUMAN_REVIEW", allowed: false }), rep);
  assert.equal(applied.action, "BLOCK");
  assert.equal(applied.allowed, false);
  assert.ok(applied.riskTypes.includes("RATE_LIMIT"));
});

test("ABUSIVE does NOT punish a fully benign interleaved request", () => {
  const rep = assessAttackerReputation(history({ attempts: 4, blocks: 3, securityHits: 3 }));
  const applied = applyAttackerReputation(
    result({ action: "ALLOW", allowed: true, riskScore: 0, riskTypes: ["LOW_RISK"] }),
    rep,
  );
  assert.equal(applied.action, "ALLOW");
  assert.equal(applied.allowed, true);
});

// Reputation is fingerprint-wide, not per-feature. Three blocked injection
// probes reach ABUSIVE (blocks 3x15 = 45 + securityHits 3x8 = 24 = 69), and the
// next PII-redaction call on a different feature used to come back as a hard
// BLOCK carrying a RATE_LIMIT finding — the caller lost their redacted text
// while the identifiers had already been stripped either way.
test("ABUSIVE does NOT block a redaction-only privacy turn", () => {
  const rep = assessAttackerReputation(history({ attempts: 4, blocks: 3, securityHits: 3 }));
  assert.equal(rep.level, "ABUSIVE");
  for (const riskTypes of [["PII_DETECTED"], ["INDIA_PII_DETECTED"], ["PII_DETECTED", "INDIA_PII_DETECTED"]] as RiskType[][]) {
    for (const action of ["ALLOW_WITH_REDACTION", "REWRITE"] as const) {
      // riskScore is above ESCALATION_MIN_RISK: a real Aadhaar + email payload
      // scores well past 25, which is precisely why it used to be escalated.
      const applied = applyAttackerReputation(result({ action, allowed: true, riskScore: 55, riskTypes }), rep);
      assert.equal(applied.action, action, action + " " + riskTypes.join("+"));
      assert.equal(applied.allowed, true);
      assert.ok(!applied.riskTypes.includes("RATE_LIMIT"));
      assert.ok(!applied.findings.some((f) => f.label === "Adaptive abuse escalation"));
      // The reputation is still reported, so the caller can see the state they
      // are in; it simply does not overturn the verdict.
      assert.equal((applied.metadata as { attacker?: { level?: string } }).attacker?.level, "ABUSIVE");
    }
  }
});

test("the redaction carve-out does not extend to attack or credential signals", () => {
  // The carve-out is about turns the guard has already remediated, not about
  // the action name. A redaction verdict that also carries an injection or a
  // secret is still a probe and still escalates.
  const rep = assessAttackerReputation(history({ attempts: 4, blocks: 3, securityHits: 3 }));
  for (const riskTypes of [
    ["PII_DETECTED", "PROMPT_INJECTION"],
    ["PII_DETECTED", "SECRET_DETECTED"],
    ["SECRET_DETECTED"],
  ] as RiskType[][]) {
    const applied = applyAttackerReputation(
      result({ action: "ALLOW_WITH_REDACTION", allowed: true, riskScore: 55, riskTypes }),
      rep,
    );
    assert.equal(applied.action, "BLOCK", riskTypes.join("+"));
    assert.equal(applied.allowed, false);
  }
});

test("BANNED still blocks a redaction-only privacy turn", () => {
  // Past 85 the documented contract is to block regardless of this turn's
  // content. The carve-out above is scoped to ABUSIVE only.
  const rep = assessAttackerReputation(history({ attempts: 8, blocks: 6, securityHits: 5, crescendo: 1 }));
  assert.equal(rep.level, "BANNED");
  const applied = applyAttackerReputation(
    result({ action: "ALLOW_WITH_REDACTION", allowed: true, riskScore: 55, riskTypes: ["PII_DETECTED"] }),
    rep,
  );
  assert.equal(applied.action, "BLOCK");
});

test("BANNED hard-blocks even a benign request", () => {
  const rep = assessAttackerReputation(
    history({ attempts: 8, blocks: 6, securityHits: 5, crescendo: 1 }),
  );
  assert.equal(rep.level, "BANNED");
  const applied = applyAttackerReputation(
    result({ action: "ALLOW", allowed: true, riskScore: 0, riskTypes: ["LOW_RISK"] }),
    rep,
  );
  assert.equal(applied.action, "BLOCK");
  assert.equal(applied.allowed, false);
  assert.match(applied.reason, /temporarily restricted/i);
});

test("Crescendo escalations accelerate a fingerprint's reputation", () => {
  // Two fingerprints with the same raw block/probe counts: the one whose blocks
  // came from multi-turn Crescendo escalation should carry more abuse pressure,
  // linking the session-level detector to the cross-request reputation store.
  const withoutCrescendo = assessAttackerReputation(
    history({ attempts: 3, blocks: 2, securityHits: 2 }),
  );
  const withCrescendo = assessAttackerReputation(
    history({ attempts: 3, blocks: 2, securityHits: 2, crescendo: 2 }),
  );
  assert.ok(
    withCrescendo.score > withoutCrescendo.score,
    `crescendo score ${withCrescendo.score} should exceed ${withoutCrescendo.score}`,
  );
  assert.ok(withCrescendo.signals.some((s) => s.startsWith("crescendo-escalations")));
});

test("recordAndAssessAttacker accumulates across calls and escalates", async () => {
  const fingerprint = attackerFingerprint({ apiKeyId: "abuse-key", clientIp: "5.5.5.5" });
  const observation: AttackerObservation = {
    action: "BLOCK",
    riskScore: 85,
    riskTypes: ["PROMPT_INJECTION", "JAILBREAK"] as RiskType[],
  };
  let last;
  for (let i = 0; i < 5; i += 1) {
    last = await recordAndAssessAttacker({
      projectId: "proj-rep-test",
      fingerprint,
      observation,
      now: 1_000_000 + i * 1000,
    });
  }
  assert.ok(last);
  assert.ok(last.history.attempts >= 5);
  assert.ok(["ABUSIVE", "BANNED"].includes(last.level), `expected escalation, got ${last.level}`);
});
