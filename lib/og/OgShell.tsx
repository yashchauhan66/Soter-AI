import { og } from "@/lib/og/theme";

/**
 * Shared shell for `next/og` cards.
 *
 * The three OG routes had ~200 lines each of near-identical structure — brand
 * rule, lockup, headline, stat row, chip row, footer — with the values inlined.
 * That is why they drifted apart: recolouring one and not the others is
 * invisible until someone shares the wrong link.
 *
 * Satori supports a narrow slice of CSS, and two constraints drive the markup:
 *
 * - **Every element needs an explicit `display`.** Satori has no default `block`;
 *   a `<div>` without `display: flex` silently drops its children.
 * - **No shorthand `flex`, no `gap` on non-flex parents, no CSS variables.** The
 *   inline literals here are not sloppiness; they are the only option.
 */
export function OgShell({
  eyebrow,
  title,
  titleAccent,
  description,
  stats,
  chips,
  footerLeft,
  footerRight,
}: {
  eyebrow: string;
  title: string;
  /** Trailing fragment of the headline, set in brand colour. */
  titleAccent?: string;
  description: string;
  /** `[value, label]` pairs. Values are brand-coloured; labels are muted. */
  stats?: Array<[string, string]>;
  chips?: string[];
  footerLeft: string;
  footerRight: string;
}) {
  return (
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
        <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 40,
              height: 40,
              borderRadius: 999,
              background: og.brandMark,
              color: "#ffffff",
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            S
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 16,
              fontWeight: 600,
              color: og.faint,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            {eyebrow}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            fontSize: 54,
            fontWeight: 700,
            color: og.heading,
            letterSpacing: "-0.035em",
            lineHeight: 1.1,
            marginTop: 26,
            maxWidth: 940,
          }}
        >
          {title}
          {titleAccent && <span style={{ color: og.brand }}>&nbsp;{titleAccent}</span>}
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 22,
            lineHeight: 1.45,
            color: og.body,
            marginTop: 16,
            maxWidth: 840,
          }}
        >
          {description}
        </div>

        {stats && stats.length > 0 && (
          <div style={{ display: "flex", gap: 40, marginTop: 30 }}>
            {stats.map(([value, label]) => (
              <div key={label} style={{ display: "flex", flexDirection: "column", maxWidth: 250 }}>
                <div style={{ display: "flex", fontSize: 36, fontWeight: 700, color: og.brand }}>{value}</div>
                <div style={{ display: "flex", fontSize: 15, color: og.faint, marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {chips && chips.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 30 }}>
            {chips.map((chip) => (
              <div
                key={chip}
                style={{
                  display: "flex",
                  padding: "7px 14px",
                  borderRadius: 6,
                  border: `1px solid ${og.hairline}`,
                  background: og.bgSubtle,
                  fontSize: 16,
                  fontWeight: 500,
                  color: og.body,
                }}
              >
                {chip}
              </div>
            ))}
          </div>
        )}
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
        <div style={{ display: "flex", fontSize: 16, fontWeight: 600, color: og.muted }}>{footerLeft}</div>
        <div style={{ display: "flex", fontSize: 14, color: og.faint }}>{footerRight}</div>
      </div>
    </div>
  );
}
