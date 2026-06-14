import type { GuardFinding } from "./types";

export function redactText(text: string, findings: GuardFinding[]) {
  const ranges = findings
    .filter((finding) => finding.redactionToken && finding.start !== undefined && finding.end !== undefined)
    .map((finding) => ({ start: finding.start!, end: finding.end!, token: finding.redactionToken! }))
    .sort((a, b) => b.start - a.start);

  let redacted = text;
  let lastStart = Number.POSITIVE_INFINITY;
  for (const range of ranges) {
    if (range.end > lastStart) continue;
    redacted = `${redacted.slice(0, range.start)}${range.token}${redacted.slice(range.end)}`;
    lastStart = range.start;
  }
  return redacted;
}
