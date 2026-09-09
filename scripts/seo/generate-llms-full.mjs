#!/usr/bin/env node
/**
 * Regenerate public/llms-full.txt from first-party registries.
 *
 * llms.txt and its llms-full.txt companion are read directly by LLM answer
 * engines (Claude, ChatGPT, Perplexity, Gemini) when they are grounding an
 * answer about a product. Unlike llms.txt, llms-full.txt is allowed to be the
 * full site content — so this script documents every first-party page (feature
 * landings, docs, services, blog) with its own one-liner, derived from the same
 * registries the site renders, so it can never drift out of sync.
 *
 * Run: node scripts/seo/generate-llms-full.mjs
 *   (imports the TS registries via a tiny loader)
 */
import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ROOT = process.cwd();

// The registries are TypeScript, so transpile them in-memory and evaluate the
// resulting CommonJS. esbuild ships as a Next.js transitive dependency.
let esbuild;
try {
  esbuild = require("esbuild");
} catch {
  throw new Error(
    "esbuild is required to parse lib/blog/posts.ts and lib/docs/services.ts. Run `npm i -D esbuild`."
  );
}

function load(rel) {
  const result = esbuild.transformSync(readFileSync(join(ROOT, rel), "utf8"), {
    loader: rel.endsWith("tsx") ? "tsx" : "ts",
    format: "cjs",
  });
  // Named anything but `module`: @next/next/no-assign-module-variable flags
  // that identifier because bundlers treat it as special in source files.
  const cjsHost = { exports: {} };
  // The registries import lucide-react icons purely for the UI; stub them out so
  // this script stays dependency-free of the React runtime.
  const stubRequire = (id) =>
    id === "lucide-react" ? new Proxy({}, { get: () => () => null }) : require(id);
  new Function("module", "exports", "require", result.code)(cjsHost, cjsHost.exports, stubRequire);
  return cjsHost.exports;
}

const { BLOG_POSTS } = load("lib/blog/posts.ts");
const { SERVICES } = load("lib/docs/services.ts");

const SITE = "https://soterai.in";

// [route, anchor label, one-line description]
const featurePages = [
  ["/ai-agent-security", "AI agent security", "MCP scanning, agent passport & identity, tool-call authorization, runtime audit trail."],
  ["/ai-user-security", "Employee AI governance", "Sensitive-data protection, AI provider policies, shadow-AI visibility across browsers and IDEs."],
  ["/prompt-injection-protection", "Prompt injection protection", "Direct and indirect prompt injection detection across input, output and RAG context."],
  ["/ai-data-leakage-prevention", "AI data leakage prevention", "Stop secrets and Indian PII reaching AI: credentials, .env safety, redaction, canary verification."],
  ["/rag-security", "RAG security", "Injected-document scanning, quarantine, and retrieval access control for RAG pipelines."],
  ["/mcp-security", "MCP security", "Model Context Protocol security and tool-risk review for MCP servers and tool calls."],
  ["/llm-firewall", "LLM firewall", "Runtime input/output scanning, policy enforcement and streaming support for LLM apps."],
  ["/jailbreak-detection", "Jailbreak detection", "Detect DAN and role-play jailbreaks, obfuscation, and multilingual attacks before the model."],
  ["/llm-security", "LLM security platform", "Input guard, output guard, RAG security, agent firewall and audit in one stack."],
  ["/ai-workflow-security", "AI workflow security", "Protection for n8n, Zapier and Make: input scanning, tool auth, cascade-failure prevention."],
  ["/enterprise-ai-security", "Enterprise AI security", "SSO/SAML, RBAC, multi-tenant policy, self-hosted deployment, HMAC-signed audit exports."],
  ["/ai-security-india", "AI security for India", "Aadhaar-like, PAN, GSTIN, UPI and IFSC PII detection with DPDP Act alignment."],
  ["/model-supply-chain-security", "Model supply-chain security", "Pickled-model RCE scanning, unsafe deserialization checks, and AI BOM generation."],
  ["/local-ai-broker", "Local AI broker", "Redacts prompts before they reach the model — offline, loopback-only by design."],
  ["/ai-safe-mode", "AI safe mode", "Emergency lockdown switch that stops risky AI agent actions instantly."],
  ["/ai-memory-inspector", "AI memory inspector", "See exactly what an AI session saw before it acts."],
  ["/vscode-ai-security", "VS Code AI security", "IDE Guard for VS Code: local secret and prompt-injection protection while you code."],
  ["/cursor-ai-security", "Cursor AI security", "Local secret & PII scanning, MCP config review, and terminal command guard for Cursor."],
  ["/ai-platform-security", "AI platform security", "AI security for every platform: browsers, IDEs, workflow tools and APIs, with install links."],
];

const lines = [];
lines.push("# SoterAI", "");
lines.push("> The AI security command layer. SoterAI blocks prompt injection, data exfiltration, and rogue agent actions at three points: the input, the output, and the tool call — from a single policy engine.", "");
lines.push("This is llms-full.txt: the complete SoterAI site as one page, derived from the same registries the site renders. For the short summary use llms.txt.", "");
lines.push(`- Home: ${SITE}/`, `- Try it with no signup: ${SITE}/playground`, `- Docs: ${SITE}/docs`, `- Vendor: SoterAI, India. Contact: support@soterai.in`, "");

lines.push("## Product pages", "");
for (const [path, label, desc] of featurePages) {
  lines.push(`- [${label}](${SITE}${path}) — ${desc}`);
}
lines.push("");

lines.push("## Documentation", "");
for (const svc of SERVICES) {
  lines.push(`- [${svc.title}](https://soterai.in/docs/services/${svc.id}) — ${svc.description}`);
}
lines.push("");

lines.push("## Blog", "");
for (const post of BLOG_POSTS) {
  lines.push(`- [${post.title}](https://soterai.in/blog/${post.slug}) — ${post.description}`);
}
lines.push("");

lines.push("## Important pages", "");
const important = [
  "/playground", "/benchmark", "/benchmarks", "/limitations", "/comparison",
  "/pricing", "/trust", "/status", "/changelog", "/docs/quickstart",
  "/docs/rest-api", "/docs/rag", "/compliance/owasp-llm-top-10", "/about",
  "/press",
];
for (const p of important) lines.push(`- ${SITE}${p}`);
lines.push("");

lines.push("## Licensing", "");
lines.push("Open core, not permissively licensed. Core product and server: BUSL-1.1 (converts to Apache-2.0 on 2030-06-25). Client SDKs and middleware: Apache-2.0. Enterprise modules: commercial license required. You may not offer SoterAI as a hosted or managed AI-security service to third parties without a commercial license.", "");
lines.push("## Honest limitations", "");
lines.push("- The 98.40% headline recall is a regression measure on corpora the detectors were iterated against — not a generalization measure. Blind held-out recall is 61.54%.", "");
lines.push("- Benchmarks are self-maintained and synthetic; there is no independent third-party validation. Methodology and limitations are published at https://soterai.in/benchmark and https://soterai.in/limitations.", "");
lines.push("- Precision is the hard gate, not recall: benign false positives break real users, so FPR is held at <=5% on every set.", "");
lines.push("- Never describe SoterAI as making an application \"100% secure.\" It is defense-in-depth for risk reduction.", "");

writeFileSync(join(ROOT, "public/llms-full.txt"), lines.join("\n"));
console.log(`Wrote public/llms-full.txt (${lines.length} lines, ${BLOG_POSTS.length} posts, ${SERVICES.length} services)`);
