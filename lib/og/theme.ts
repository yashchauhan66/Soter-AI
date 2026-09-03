/**
 * Palette for `next/og` images.
 *
 * ## Why these are literals and not theme tokens
 *
 * `ImageResponse` renders in Satori, a standalone layout engine that never loads
 * the stylesheet: no Tailwind classes, no CSS variables, no `rgb(var(--brand))`.
 * Every colour in an OG card has to be an inline literal.
 *
 * That is exactly how the three cards drifted. They were written against the old
 * dark teal theme and kept `#00c8c8` / `#00dc82` / `#0f1117` long after the
 * product moved on — so the link preview a user saw on X or Slack advertised a
 * different product than the one behind the click. Centralising the values here
 * means the next theme change is one file, and a mismatch is visible in a diff.
 *
 * Keep in sync with `:root` in app/globals.css.
 */
export const og = {
  /** Page. The cards are white now, like the site. */
  bg: "#ffffff",
  /** Sunken band, for the footer strip and inset chips. */
  bgSubtle: "#f8fafc",

  /** Brand text/graphic steps. `brand` is legible; `brandMark` is the logo hue. */
  brand: "#b23b0b",
  brandMark: "#f96403",
  /**
   * 8% and 25% brand over white, precomputed. Satori supports rgba, but a flat
   * hex renders identically and removes a compositing step per element.
   *
   * `brand` on `brandTint` measures 5.07:1 — the tint is deliberately weak enough
   * that a chip label stays above 4.5:1 without a second colour.
   */
  brandTint: "#faf0ec",
  brandBorder: "#f0d0c2",

  /** Type ramp, matching the site's heading / body / muted roles. */
  heading: "#0f172a",
  body: "#334155",
  muted: "#475569",
  faint: "#64748b",

  hairline: "#e2e8f0",

  success: "#15803d",
  successTint: "#f0fdf4",
  danger: "#be123c",
  warning: "#b45309",
  info: "#0369a1",
} as const;
