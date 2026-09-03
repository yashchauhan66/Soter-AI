/**
 * Brand colours as literals, for contexts that cannot read CSS.
 *
 * Most of the product gets its colours from Tailwind, which resolves through
 * `tailwind.config.ts` — that indirection is what let the whole site switch from
 * dark to light by editing one file. Four contexts have no access to it:
 *
 *   - **Email HTML** (`app/api/admin/queries/reply`). Mail clients strip
 *     `<style>` and none support CSS variables, so every colour has to be an
 *     inline literal.
 *   - **The embeddable badge** (`app/badge.js`). It runs on a *customer's* page,
 *     where our stylesheet does not exist.
 *   - **`next/og` cards.** Satori never loads the stylesheet. See `lib/og/theme.ts`.
 *   - **PDF and report generation**, which paints via a drawing API.
 *
 * Those four kept the old dark teal (`#31d7c8`) for exactly as long as nobody
 * noticed, because no config change can reach a literal. Naming them here makes
 * the next palette change one file instead of a search, and lets
 * `scripts/audit-hardcoded-colors.mjs` treat every *other* literal as a defect.
 *
 * Keep in sync with `:root` in app/globals.css.
 */

/** Sampled from `public/logo_circle_whiter.png`. Graphic use only — 3.06:1 on white. */
export const BRAND_MARK = "#f96403";

/**
 * The accessible brand step: 5.96:1 on white, and white-on-it is also 5.96:1.
 *
 * One notch darker than the obvious orange-700 (#c2410c) — see the note in
 * tailwind.config.ts. Brand text is frequently drawn on a brand *tint*, and that
 * tint stacks when a chip nests inside a tinted panel, which put #c2410c under
 * 4.5:1 on the real DOM.
 */
export const BRAND = "#b23b0b";
export const BRAND_DARK = "#9a3412";

/** Neutral ramp, matching the mirrored `slate` scale in tailwind.config.ts. */
export const INK = {
  /** Headings. */
  heading: "#0f172a",
  /** Body copy. */
  body: "#334155",
  /** Secondary copy. */
  muted: "#475569",
  /** Least prominent legible text. */
  faint: "#64748b",
  hairline: "#e2e8f0",
  surface: "#f8fafc",
  page: "#ffffff",
} as const;

/**
 * Severity ramp for reports and scan results.
 *
 * Every step clears 4.5:1 on white, so a severity label is legible as plain text
 * and does not depend on a coloured chip behind it. The old values were the
 * Tailwind 500/600 steps, which fail as text on a light background.
 */
export const SEVERITY = {
  critical: "#be123c",
  high: "#b23b0b",
  medium: "#b45309",
  low: "#4d7c0f",
  safe: "#15803d",
} as const;
