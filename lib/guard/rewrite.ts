import type { GuardFinding } from "./types";

const REWRITABLE_TYPES = new Set(["PROMPT_INJECTION", "JAILBREAK", "UNSAFE_OUTPUT"]);

export function rewriteRiskyText(text: string, findings: GuardFinding[]) {
  const ranges = findings
    .filter(
      (finding) =>
        REWRITABLE_TYPES.has(finding.type) &&
        finding.start !== undefined &&
        finding.end !== undefined,
    )
    .map((finding) => ({ start: finding.start!, end: finding.end! }))
    .sort((a, b) => b.start - a.start);

  let rewritten = text;
  let lastStart = Number.POSITIVE_INFINITY;
  for (const range of ranges) {
    if (range.end > lastStart) continue;
    rewritten = `${rewritten.slice(0, range.start)}[REMOVED_RISKY_INSTRUCTION]${rewritten.slice(range.end)}`;
    lastStart = range.start;
  }

  return rewritten.replace(/\s{2,}/g, " ").trim();
}
