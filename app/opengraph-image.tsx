import { DEFAULT_CARD } from "@/lib/og/cards";
import { OG_SIZE, renderOgCard } from "@/lib/og/renderCard";

export const alt = "SoterAI, the AI security command layer";
export const size = OG_SIZE;
export const contentType = "image/png";

/**
 * Root share card, served at /opengraph-image. It draws the same default card as
 * /og-card/default.png.
 *
 * The earlier root card showed "100% recall", "0.00% false positives" and a latency figure
 * as tiles. A share preview is read in a second and cannot carry the test behind a number,
 * so the new cards state no statistic. Per-page cards are in lib/og/cards.ts.
 */
export default function Image() {
  return renderOgCard(DEFAULT_CARD);
}
