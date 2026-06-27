import assert from "node:assert/strict";
import test from "node:test";
import { guardRedTeamBenchmark } from "../lib/classifiers/datasets/guardRedTeamBenchmark";
import { runGuardRedTeamBenchmark } from "../lib/classifiers/guardRedTeamEvaluation";

test("guard red-team benchmark covers modern attack categories", () => {
  const categories = new Set(guardRedTeamBenchmark.map((example) => example.category));
  for (const category of [
    "DIRECT_OVERRIDE",
    "INDIRECT_INJECTION",
    "AGENT_TOOL_MISUSE",
    "RAG_POISONING",
    "MEMORY_POISONING",
    "PROMPT_LEAKAGE",
    "JAILBREAK",
    "OBFUSCATION",
    "CONNECTOR_ESCALATION",
    "DATA_EXFILTRATION",
    "DUAL_USE_EVASION",
    "UNSAFE_OUTPUT",
    "ADVERSARIAL_SUFFIX",
    "MULTILINGUAL_TROJAN",
    "TOKEN_SMUGGLING",
    "ASCII_ART",
    "EVOLUTIONARY_JAILBREAK",
    "FUNCTION_CALL_EXPLOIT",
    "COGNITIVE_OVERLOAD",
    "CROSS_MODAL_PAYLOAD",
    "DATASET_POISONING",
    "AUTOMATED_CHAIN_ATTACK",
    "MULTI_AGENT_COMPROMISE",
    "ADVERSARIAL_NLP",
    "UNSAFE_FINE_TUNING",
    "BACKDOOR_DATA_POISONING",
    "TRAINING_DATA_EXTRACTION",
    "DATA_RECONSTRUCTION",
    "RESOURCE_EXHAUSTION",
    "ESCALATION_RCE",
    "MALICIOUS_CODE_SUPPLY_CHAIN",
    "BROWSER_XSS_CSRF",
    "MULTIMODAL_ADVERSARIAL",
    "MODEL_THEFT",
    "ATTACK_AUTOMATION",
    "DETECTOR_EVASION",
    "UNSAFE_OUTPUT_HANDLING",
    "SAFE_BASELINE",
  ]) {
    assert.ok(categories.has(category as never), `missing category ${category}`);
  }
});

test("guard red-team benchmark has perfect recall against current SoterAI rules", () => {
  const metrics = runGuardRedTeamBenchmark(guardRedTeamBenchmark);
  assert.equal(metrics.missed.length, 0, JSON.stringify(metrics.missed, null, 2));
  assert.equal(metrics.recall, 1);
  assert.equal(metrics.falsePositiveRate, 0);
});

test("guard red-team benchmark examples include expected risk contracts", () => {
  for (const example of guardRedTeamBenchmark) {
    assert.ok(example.id.length > 0);
    assert.ok(example.prompt.length > 10);
    assert.ok(example.expectedRiskTypes.length > 0);
    if (example.category !== "SAFE_BASELINE") assert.ok(example.owasp.length > 0, example.id);
  }
});
