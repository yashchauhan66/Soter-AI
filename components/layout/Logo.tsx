import Image from "next/image";

/**
 * The SoterAI lockup: circular mark + wordmark.
 *
 * ## Why the wordmark is text, not part of the image
 *
 * `public/logo.png` was a 448 KB raster of the mark *and* the words, rendered at
 * 114x40 CSS px — around 99% of those bytes were decoded and thrown away, on the
 * critical path, on every page. Worse, the words were baked in at a fixed colour,
 * so the whole file had to be regenerated to change the theme.
 *
 * Splitting them fixes both: the mark is a 6.8 kB indexed PNG (see
 * `scripts/make-brand-assets.mjs`) and the wordmark is live text, so it inherits
 * the type scale, stays crisp at any zoom, sub-pixel-renders like the rest of the
 * page, and is selectable and searchable.
 *
 * ## Why the mark keeps its orange disc
 *
 * The source glyph is white. Knocking the disc out would leave a white shield
 * that is invisible on a white page, so the disc *is* the mark on this theme —
 * which also makes it the one place the full-saturation `#f96403` appears at
 * size. That is deliberate: 3.06:1 on white clears the 3:1 that WCAG 1.4.11 asks
 * of a graphic, and would fail the 4.5:1 that text needs — so the brand colour is
 * at its most vivid here and one step darker everywhere else (`--brand`,
 * `#b23b0b`, 5.96:1) where it has to carry words.
 */
export function Logo({
  /** Mark diameter in px. The wordmark scales from this. */
  size = 30,
  /** Set false in tight spots (mobile drawer trigger, favicon-like contexts). */
  showWordmark = true,
  /**
   * `priority` on the header instance only. The footer mark is far below the
   * fold, and preloading both makes them compete for the same connection during
   * LCP.
   */
  priority = false,
  className,
}: {
  size?: number;
  showWordmark?: boolean;
  priority?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <Image
        src="/logo-mark@2x.png"
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        priority={priority}
        // The 256px source is deliberate even though it renders at ~30px: Next's
        // optimizer emits a 1x and a 2x from it and converts to AVIF/WebP, so a
        // retina screen gets a sharp mark and the browser downloads exactly one
        // file. Pointing this at the 128px asset would cap 2x at 64px and blur it.
        className="shrink-0"
      />
      {showWordmark && (
        // `tracking-[-0.02em]` because Inter at semibold sets a touch loose for a
        // wordmark; a logotype should be tighter than running text.
        <span
          className="text-[1.0625rem] font-bold leading-none tracking-[-0.02em] text-slate-100"
          style={{ fontSize: size * 0.6 }}
        >
          SoterAI
        </span>
      )}
    </span>
  );
}
