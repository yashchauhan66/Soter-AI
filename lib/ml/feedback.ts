// Phase 6: helper that converts existing detection feedback into ML dataset
// examples. Feedback is already user-curated and tied to redacted log text.

import { db } from "../db";
import { appendExamples } from "./datasets";
import type { MLLabel } from "@prisma/client";

const FEEDBACK_TO_LABEL: Record<string, MLLabel> = {
  PROMPT_INJECTION: "PROMPT_INJECTION",
  JAILBREAK: "JAILBREAK",
  SYSTEM_PROMPT_LEAK_ATTEMPT: "SYSTEM_PROMPT_LEAK_ATTEMPT",
  PII: "PII",
  SECRET: "SECRET",
  UNSAFE_OUTPUT: "UNSAFE_OUTPUT",
  RAG_POISONING: "RAG_POISONING",
  DATA_EXFILTRATION_ATTEMPT: "DATA_EXFILTRATION_ATTEMPT",
};

export async function importFeedbackIntoDataset(input: {
  organizationId: string;
  datasetId: string;
  limit?: number;
}) {
  const feedback = await db.detectionFeedback.findMany({
    where: { organizationId: input.organizationId },
    include: { guardLog: true },
    orderBy: { createdAt: "desc" },
    take: input.limit ?? 100,
  });
  const examples = feedback
    .map((item) => {
      const log = item.guardLog;
      const text = log?.redactedText ?? log?.safeText ?? null;
      if (!text) return null;
      const riskType = (log?.riskTypes ?? [])[0];
      // FALSE_POSITIVE → original detection was wrong, so the example is SAFE.
      let label: MLLabel = "SAFE";
      if (item.feedback === "FALSE_NEGATIVE" && riskType && FEEDBACK_TO_LABEL[riskType]) label = FEEDBACK_TO_LABEL[riskType];
      else if (item.feedback === "CORRECT" && riskType && FEEDBACK_TO_LABEL[riskType]) label = FEEDBACK_TO_LABEL[riskType];
      return {
        text,
        label,
        language: "en",
        source: "feedback",
        metadata: { feedbackId: item.id, feedback: item.feedback },
      };
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value));
  if (!examples.length) return { added: 0 };
  const added = await appendExamples(input.datasetId, examples);
  return { added };
}
