import assert from "node:assert/strict";
import test from "node:test";
import { run } from "../../../packages/integrations/n8n/test/helpers.ts";

/**
 * Phase 1 boundary reproduction, not a live API/model benchmark.
 * The repository's helper replaces HTTP transport; the actual n8n v3 request
 * builder, literal-restoration code and final verdict logic execute unchanged.
 * This captures the requested effective-policy contract. Raw detector evidence
 * may retain PII, but an exact authorized sole PII value must not remain an
 * effective PII finding or a claim that data was redacted.
 * Intentionally RED until the policy reconciliation phase; no production fix
 * or learned-parameter change is made during recon.
 */
test("exact authorized sole phone does not remain an effective PII finding", async () => {
  const phone = "+91 98765 43210";
  const text = `Contact ${phone}`;
  const { safe, flagged, calls } = await run({
    action: "inputGuard",
    layout: "v3",
    params: {
      inputText: text,
      onThreat: "BLOCK",
      enforceOnSensitiveData: true,
      options: { detectionEngine: "CLOUD", ignoredWords: phone },
    },
    respond: () => ({
      body: {
        allowed: true,
        action: "ALLOW_WITH_REDACTION",
        riskScore: 25,
        riskTypes: ["PII_DETECTED"],
        reason: "Phone detected; redacted.",
        findings: [{ type: "PII_DETECTED", label: "Phone number", message: "Phone detected", severity: "MEDIUM", score: 25 }],
        safeText: "Contact [REDACTED_PHONE]",
        redactedText: "Contact [REDACTED_PHONE]",
      },
    }),
  });
  const item = (safe[0] ?? flagged[0])?.json;
  assert.ok(item, "the actual postprocessor must return a verdict");
  assert.equal(item.engine, "cloud");
  assert.equal(item.safeText, text, "control: authorized phone is already restored");
  assert.equal((item.ignoredWords as Record<string, unknown>).effect, "APPLIED");
  const verdict = item.contentVerdict as Record<string, unknown>;
  const effectiveRisks = verdict.riskTypes as string[];
  console.log(JSON.stringify({
    evidenceScope: "OFFLINE_N8N_POSTPROCESSING_TRANSPORT_FIXTURE_NOT_LIVE_API",
    requestPath: calls[0]?.path,
    requestBodyKeys: Object.keys(calls[0]?.body ?? {}),
    safeCount: safe.length,
    flaggedCount: flagged.length,
    safeText: item.safeText,
    ignoredWords: item.ignoredWords,
    effectiveVerdict: verdict,
    userMessage: item.userMessage,
  }));
  assert.equal(effectiveRisks.includes("PII_DETECTED"), false,
    "restoring an exact authorized sole PII value must reconcile the effective PII finding, not only the text");
  assert.equal(verdict.decision, "ALLOW");
});
