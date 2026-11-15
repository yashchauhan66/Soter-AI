import { ImageResponse } from "next/og";
import type { OgCard } from "@/lib/og/cards";
import { og } from "@/lib/og/theme";

/**
 * Draws a 1200x630 SoterAI share card: warm paper, ink type, one rust
 * accent, the wordmark. No logo mark, no statistic.
 *
 * Satori (the engine behind next/og) cannot read the stylesheet, so the colours come
 * from lib/og/theme.ts as literals that match components/sa/tokens.css. It uses the bundled sans-serif, because loading a web font
 * here needs a TTF or WOFF file, and Newsreader is shipped as WOFF2 only.
 */
export const OG_SIZE = { width: 1200, height: 630 } as const;

const PAPER = og.paper;
const INK = og.ink;
const MUTED = og.inkMuted;
const BRAND = og.brand;
const RULE = og.rule;

/** Long titles shrink so they stay inside the card. */
function titleSize(title: string): number {
  if (title.length <= 40) return 84;
  if (title.length <= 60) return 72;
  if (title.length <= 80) return 62;
  return 54;
}

export function renderOgCard(card: OgCard) {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: PAPER, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", height: 10, background: BRAND }} />
        <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "center", padding: "0 80px" }}>
          <div style={{ display: "flex", fontSize: 26, letterSpacing: 4, textTransform: "uppercase", color: MUTED }}>{card.kicker}</div>
          <div
            style={{
              display: "flex",
              marginTop: 24,
              fontSize: titleSize(card.title),
              fontWeight: 700,
              lineHeight: 1.08,
              letterSpacing: -2,
              color: INK,
              maxWidth: 1040,
            }}
          >
            {card.title}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "26px 80px", borderTop: `2px solid ${RULE}` }}>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: INK }}>
            Soter<span style={{ color: BRAND }}>AI</span>
          </div>
          <div style={{ display: "flex", fontSize: 22, color: MUTED }}>Numbers come with their limits</div>
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
