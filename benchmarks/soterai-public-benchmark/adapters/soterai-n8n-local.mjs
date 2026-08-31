// Adapter: the LOCAL (offline) rule tier bundled inside the n8n community node.
//
// This is deliberately the weakest engine SoterAI ships, and it is the one wired
// up by default here, because it is the only one a third party can run without
// an API key. A reviewer who wants the cloud numbers has to be given an account;
// a reviewer who wants *reproducible* numbers can run this.
//
// Requires the node package to be built (`npm run build` in
// packages/integrations/n8n`). Falls back to the checked-in `dist` if present.
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));

const candidates = [
  resolve(here, "../../../packages/integrations/n8n/dist/nodes/SoterGuard/shared/localEngine.js"),
  resolve(here, "../../../packages/integrations/n8n/test-build/nodes/SoterGuard/shared/localEngine.js"),
];

const found = candidates.find((p) => existsSync(p));
if (!found) {
  throw new Error(
    `Could not find the built local engine. Run \`npm run build\` in packages/integrations/n8n first.\nLooked in:\n  ${candidates.join("\n  ")}`,
  );
}

const { analyzeLocal, LOCAL_ENGINE_VERSION } = require(found);

export const adapterInfo = {
  name: "soterai-n8n-local",
  engine: "local-rule-tier",
  version: LOCAL_ENGINE_VERSION,
  note: "Pattern/heuristic tier only. No ML classifier, no multi-turn state, no reputation.",
};

/**
 * The one function every adapter implements.
 *
 * `flagged` is the only field the harness reads for the confusion matrix. It is
 * true when the engine would not have let the text through untouched — which is
 * the same bar the node's Safe/Flagged routing uses, so the benchmark measures
 * the behaviour a workflow actually gets rather than an internal score.
 */
export function detect(text) {
  const result = analyzeLocal(text, "INPUT");
  return {
    flagged: result.action !== "ALLOW",
    block: result.action === "BLOCK",
    riskType: result.primaryRiskType,
    riskScore: result.riskScore,
  };
}
