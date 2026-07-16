import type { GuardFinding } from "./types";

export function redactText(text: string, findings: GuardFinding[]) {
  const ranges = findings
    .filter((finding) => finding.redactionToken && finding.start !== undefined && finding.end !== undefined)
    .map((finding) => ({ start: finding.start!, end: finding.end!, token: finding.redactionToken! }))
    .sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

  const selected: typeof ranges = [];
  for (const range of ranges) {
    if (selected.some((chosen) => rangesOverlap(range, chosen))) continue;
    selected.push(range);
  }

  let redacted = text;
  let lastStart = Number.POSITIVE_INFINITY;
  for (const range of selected.sort((a, b) => b.start - a.start)) {
    if (range.end > lastStart) continue;
    redacted = `${redacted.slice(0, range.start)}${range.token}${redacted.slice(range.end)}`;
    lastStart = range.start;
  }
  return redacted;
}

function rangesOverlap(a: { start: number; end: number }, b: { start: number; end: number }) {
  return a.start < b.end && b.start < a.end;
}
