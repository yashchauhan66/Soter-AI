import { ImageResponse } from "next/og";
import { OgShell } from "@/lib/og/OgShell";

export const alt = "SoterAI compared with other AI security and guardrail tools";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

/**
 * Comparison Open Graph card.
 *
 * Rebuilt on `OgShell` in the light theme. The copy deliberately does **not**
 * name competitors or claim to beat them: a link preview is the one place a
 * comparison claim travels without its methodology attached, so this card states
 * what SoterAI covers and lets the page do the comparing.
 */
export default function Image() {
  return new ImageResponse(
    (
      <OgShell
        eyebrow="Comparison"
        title="One control layer,"
        titleAccent="not four point tools"
        description="Input and output guarding, agent action approval, RAG authorization, and India-specific PII — in one policy, with one audit trail."
        stats={[
          ["4", "Surfaces covered by one policy"],
          ["1", "Audit trail across all of them"],
          ["Self-host", "Available on every plan"],
        ]}
        chips={["Input + output guard", "Agent firewall", "RAG security", "India PII", "Self-hosting"]}
        footerLeft="soterai.in/comparison"
        footerRight="Feature comparison with sources · Updated with each release"
      />
    ),
    { ...size },
  );
}
