import { performance } from "node:perf_hooks";

import { advancedUnicodeSmugglingDetector } from "../lib/guard/detectors/advancedUnicodeSmugglingDetector";
import { adversarialCyberDetector } from "../lib/guard/detectors/adversarialCyberDetector";
import { behavioralAnomalyDetector } from "../lib/guard/detectors/behavioralAnomalyDetector";
import { broadHarmfulContentDetector } from "../lib/guard/detectors/broadHarmfulContentDetector";
import { competitiveIntelDetector } from "../lib/guard/detectors/competitiveIntelDetector";
import { dataExfiltrationInputDetector } from "../lib/guard/detectors/dataExfiltrationInputDetector";
import { embeddingPoisoningDetector } from "../lib/guard/detectors/embeddingPoisoningDetector";
import { generalizedIntentDetector } from "../lib/guard/detectors/generalizedIntentDetector";
import { harmfulContentRequestDetector } from "../lib/guard/detectors/harmfulContentRequestDetector";
import { indiaPiiDetector } from "../lib/guard/detectors/indiaPiiDetector";
import { insecureDeserializationDetector } from "../lib/guard/detectors/insecureDeserializationDetector";
import { jailbreakDetector } from "../lib/guard/detectors/jailbreakDetector";
import { mcpToolPoisoningDetector } from "../lib/guard/detectors/mcpToolPoisoningDetector";
import { memoryPoisoningDetector } from "../lib/guard/detectors/memoryPoisoningDetector";
import { modelSupplyChainDetector } from "../lib/guard/detectors/modelSupplyChainDetector";
import { multimodalAttackDetector } from "../lib/guard/detectors/multimodalAttackDetector";
import { multilingualAttackDetector } from "../lib/guard/detectors/multilingualAttackDetector";
import { piiDetector } from "../lib/guard/detectors/piiDetector";
import { promptInjectionDetector } from "../lib/guard/detectors/promptInjectionDetector";
import { recursiveInjectionDetector } from "../lib/guard/detectors/recursiveInjectionDetector";
import { replyChannelExfilDetector } from "../lib/guard/detectors/replyChannelExfilDetector";
import { secretsDetector } from "../lib/guard/detectors/secretsDetector";
import { socialEngineeringDetector } from "../lib/guard/detectors/socialEngineeringDetector";
import { ssrfDetector } from "../lib/guard/detectors/ssrfDetector";
import { systemPromptLeakAttemptDetector } from "../lib/guard/detectors/systemPromptLeakDetector";
import { toxicityDetector } from "../lib/guard/detectors/toxicityDetector";
import { withDetectionVariantScope } from "../lib/guard/detectors/helpers";

const detectors = {
  advancedUnicodeSmugglingDetector,
  adversarialCyberDetector,
  behavioralAnomalyDetector,
  broadHarmfulContentDetector,
  competitiveIntelDetector,
  dataExfiltrationInputDetector,
  embeddingPoisoningDetector,
  generalizedIntentDetector,
  harmfulContentRequestDetector,
  indiaPiiDetector,
  insecureDeserializationDetector,
  jailbreakDetector,
  mcpToolPoisoningDetector,
  memoryPoisoningDetector,
  modelSupplyChainDetector,
  multimodalAttackDetector,
  multilingualAttackDetector,
  piiDetector,
  promptInjectionDetector,
  recursiveInjectionDetector,
  replyChannelExfilDetector,
  secretsDetector,
  socialEngineeringDetector,
  ssrfDetector,
  systemPromptLeakAttemptDetector,
  toxicityDetector,
};

const iterations = Number(process.argv[2] ?? 100);
const text = JSON.stringify({
  text: "The quarterly onboarding checklist item. ".repeat(200),
});

const samplesByDetector = new Map<string, number[]>(
  Object.keys(detectors).map((name) => [name, []]),
);
for (let i = 0; i < iterations + 5; i += 1) {
  withDetectionVariantScope(text, () => {
    for (const [name, detector] of Object.entries(detectors)) {
      const start = performance.now();
      detector(text);
      if (i >= 5) samplesByDetector.get(name)!.push(performance.now() - start);
    }
  });
}
const results = [...samplesByDetector].map(([name, samples]) => {
  samples.sort((a, b) => a - b);
  return {
    name,
    p50Ms: samples[Math.floor(samples.length * 0.5)],
    p95Ms: samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.95))],
  };
}).sort((a, b) => b.p95Ms - a.p95Ms);

console.log(JSON.stringify({ iterations, bytes: Buffer.byteLength(text), results }, null, 2));
