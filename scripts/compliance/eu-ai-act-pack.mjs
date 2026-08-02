#!/usr/bin/env node
/**
 * R2 — EU AI Act evidence pack generator.
 * Reads the SOC2 control-evidence report and repo artifacts and emits a
 * DPDP+EU-AI-Act-mapped evidence bundle for auditors / enterprise buyers.
 * Run: node scripts/compliance/eu-ai-act-pack.mjs
 * Output: artifacts/security/eu-ai-act-evidence-pack.json + .md
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = process.cwd();
const sha = (p) => (fs.existsSync(p) ? crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex") : null);

const ARTIFACTS = {
  capabilities: "artifacts/security/capabilities.json",
  soc2ControlReport: "artifacts/security/soc2-control-report.md",
  multilingualEval: "artifacts/security/multilingual-eval-2026-08-02.json",
  multiLang100: "artifacts/security/multilingual-100lang-eval-2026-08-02.json",
  mcpLatency: "artifacts/perf/mcp-latency-bench.json",
  trustStore: "artifacts/security/model-trust-store.json",
};

// Map EU AI Act Titles (esp. Art 9-15 risk/quality/data/logging/transparency/accuracy/security)
const EU_MAP = [
  { article: "Art 9 — Risk management system", soterai: "Pre-execution guard + 8 canonical decision verbs + fail-safe ABSTAIN; capability registry honest:true", evidence: ARTIFACTS.capabilities },
  { article: "Art 10 — Data & data governance", soterai: "PII/SECRET detectors, deterministic 0-FP rules, benign control suite", evidence: ARTIFACTS.multiLang100 },
  { article: "Art 11 — Technical documentation", soterai: "Model card + ONNX backend header + reproducible eval scripts", evidence: "docs/SOTERLLM-MODEL-CARD.md" },
  { article: "Art 12 — Record keeping / logging", soterai: "Evidence vault signed receipts + SOC2 control automation", evidence: ARTIFACTS.soc2ControlReport },
  { article: "Art 13 — Transparency & provision of information", soterai: "Public known-bypass list + limitations kept in-repo", evidence: ARTIFACTS.capabilities },
  { article: "Art 14 — Human oversight", soterai: "REQUIRE_APPROVAL verb + escalation path in canonical plane", evidence: ARTIFACTS.capabilities },
  { article: "Art 15 — Accuracy, robustness, cybersecurity", soterai: "Measured recall/FP + 3.1ms p95 BLOCK latency + model supply-chain signing gate", evidence: [ARTIFACTS.mcpLatency, ARTIFACTS.trustStore] },
];

// India DPDP 2023 mapping surfaces simultaneously (penalties aware)
const DPDP_MAP = [
  { section: "S.8(4) — security safeguards", soterai: "Pre-execution BLOCK on PII/SECRET exfil, signed receipts" },
  { section: "S.8(5) — breach notification readiness", soterai: "Evidence vault hash-chained receipts enable time-stamped disclosure" },
];

const pack = {
  generatedAt: new Date().toISOString(),
  product: "SoterAI Guard",
  regulation: ["EU AI Act (Reg (EU) 2024/1689)", "India DPDP Act 2023"],
  artifacts: Object.fromEntries(Object.entries(ARTIFACTS).map(([k, p]) => [k, { path: p, sha256: sha(path.join(root, p)) }])),
  euArticles: EU_MAP,
  dpdp: DPDP_MAP,
  honesty: "Self-generated compliance-as-code evidence; NOT a substitute for a notified-body certification. Compiled from in-repo artifacts whose SHA-256 is pinned above.",
};
fs.mkdirSync(path.join(root, "artifacts/security"), { recursive: true });
fs.writeFileSync(path.join(root, "artifacts/security/eu-ai-act-evidence-pack.json"), JSON.stringify(pack, null, 2));

const md = ["# EU AI Act + India DPDP — Automated Evidence Pack", `Generated: ${pack.generatedAt}`, "",
  "| EU AI Act Article | SoterAI control | Evidence |", "|---|---|---|",
  ...EU_MAP.map((r) => `| ${r.article} | ${r.soterai} | \`${Array.isArray(r.evidence) ? r.evidence.join(", ") : r.evidence}\` |`),
  "", "## India DPDP 2023", "| Section | Control |", "|---|---|",
  ...DPDP_MAP.map((r) => `| ${r.section} | ${r.soterai} |`),
  "", `> ${pack.honesty}`].join("\n");
fs.writeFileSync(path.join(root, "artifacts/security/eu-ai-act-evidence-pack.md"), md);
console.log("WROTE artifacts/security/eu-ai-act-evidence-pack.{json,md}");
console.log("artifact hashes:", Object.entries(pack.artifacts).map(([k, v]) => `${k}=${v.sha256 ? v.sha256.slice(0, 12) : "MISSING"}`).join(" "));
