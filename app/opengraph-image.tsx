import { ImageResponse } from "next/og";
import { og } from "@/lib/og/theme";

export const alt = "SoterAI — AI security command layer for agents, RAG, and chatbots";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

/**
 * Root Open Graph card.
 *
 * ## Why this was rewritten rather than recoloured
 *
 * Two things were wrong beyond the palette.
 *
 * 1. **It advertised the wrong product.** The card was a dark teal gradient with
 *    `#00c8c8` accents — a theme the site no longer has. A link preview is the
 *    first impression for every share on X, Slack, LinkedIn, and WhatsApp, so a
 *    stale card means the page a user lands on looks like a different company.
 * 2. **Two elements rendered as noise.** A stat tile paired the *value*
 *    "Phase 9 benchmark" with the *label* "Benchmark", and the feature chips
 *    emitted a literal `OK ` prefix, presumably where an emoji was stripped and
 *    never replaced. Both were visible in production previews.
 *
 * Colours come from `lib/og/theme.ts`: Satori cannot read the stylesheet, so OG
 * cards are the one place a hex has to be inline, and centralising them is what
 * keeps this file from drifting away from the site again.
 *
 * Claims stay conservative and match /benchmark — a self-maintained synthetic
 * dataset, labelled as such.
 */

const CAPABILITIES = ["Prompt injection", "Data leakage", "Agent actions", "RAG poisoning", "India PII"];

const PROOF: Array<[string, string]> = [
  ["100%", "Recall on the published attack set"],
  ["0.00%", "False positives across 1,000 controls"],
  ["17.8ms", "p95 analyzer latency"],
];

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: og.bg,
          fontFamily: "sans-serif",
        }}
      >
        {/* Brand rule. The only place the logo's full-saturation #f96403 appears:
            a 6px graphic, never text. */}
        <div style={{ display: "flex", height: 6, background: og.brandMark }} />

        <div
          style={{
            display: "flex",
            flexGrow: 1,
            flexDirection: "column",
            justifyContent: "center",
            padding: "44px 64px 36px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 44,
                height: 44,
                borderRadius: 999,
                background: og.brandMark,
                color: "#ffffff",
                fontSize: 24,
                fontWeight: 700,
              }}
            >
              S
            </div>
            <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: og.heading }}>SoterAI</div>
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 56,
              fontWeight: 700,
              color: og.heading,
              letterSpacing: "-0.035em",
              lineHeight: 1.08,
              marginTop: 28,
              maxWidth: 900,
            }}
          >
            The control layer for AI agents in production
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 23,
              lineHeight: 1.45,
              color: og.body,
              marginTop: 16,
              maxWidth: 830,
            }}
          >
            Stop prompt injection, data leakage, and risky agent actions across browsers, IDEs, workflows, and APIs.
          </div>

          <div style={{ display: "flex", gap: 40, marginTop: 32 }}>
            {PROOF.map(([value, label]) => (
              <div key={label} style={{ display: "flex", flexDirection: "column", maxWidth: 250 }}>
                <div style={{ display: "flex", fontSize: 38, fontWeight: 700, color: og.brand }}>{value}</div>
                <div style={{ display: "flex", fontSize: 16, color: og.faint, marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 32 }}>
            {CAPABILITIES.map((item) => (
              <div
                key={item}
                style={{
                  display: "flex",
                  padding: "8px 15px",
                  borderRadius: 6,
                  border: `1px solid ${og.hairline}`,
                  background: og.bgSubtle,
                  fontSize: 17,
                  fontWeight: 500,
                  color: og.body,
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "18px 64px",
            borderTop: `1px solid ${og.hairline}`,
            background: og.bgSubtle,
          }}
        >
          <div style={{ display: "flex", fontSize: 17, fontWeight: 600, color: og.muted }}>soterai.in</div>
          <div style={{ display: "flex", fontSize: 15, color: og.faint }}>
            OWASP LLM Top 10 aligned · Self-maintained synthetic benchmark · Free tier
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
