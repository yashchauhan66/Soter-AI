import { ImageResponse } from "next/og";
import { OgShell } from "@/lib/og/OgShell";

export const alt = "SoterAI public benchmark — synthetic adversarial dataset results";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

/**
 * Benchmark Open Graph card.
 *
 * Rebuilt on `OgShell` in the light theme. Two content fixes alongside the
 * recolour:
 *
 * - The old card led with "Phase 9 public benchmark". An internal phase number
 *   means nothing to someone seeing the link in a feed, and it dates the card the
 *   moment Phase 10 ships.
 * - "&lt;50ms Latency" was vaguer than the figure the page actually publishes.
 *   The real p95 is quoted instead, which is both stronger and checkable.
 *
 * Claims mirror /benchmark exactly, including that the dataset is self-maintained
 * rather than independently audited.
 */
export default function Image() {
  return new ImageResponse(
    (
      <OgShell
        eyebrow="Public benchmark"
        title="Measured against"
        titleAccent="3,200 adversarial cases"
        description="Synthetic prompt-injection, jailbreak, obfuscation, and PII corpora — with the methodology and the limitations published alongside the numbers."
        stats={[
          ["100%", "Recall on the published attack set"],
          ["0.00%", "False positives across 1,000 benign controls"],
          ["17.8ms", "p95 analyzer latency, latest local run"],
        ]}
        chips={[
          "Prompt injection",
          "Jailbreak / DAN",
          "Obfuscation",
          "Multilingual",
          "Indirect injection",
          "PII & secrets",
        ]}
        footerLeft="soterai.in/benchmarks"
        footerRight="OWASP LLM Top 10 aligned · Self-maintained synthetic dataset"
      />
    ),
    { ...size },
  );
}
