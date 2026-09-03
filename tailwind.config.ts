import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";

/**
 * SoterAI design system — Tailwind theme.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * LIGHT THEME — read this before changing a colour
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The product renders on a **solid white** page. It did not always: the console
 * was dark, and 5,246 colour utilities were written against that assumption
 * across ~400 files, with **zero `dark:` variants** to switch on.
 *
 * That constraint decides the approach. Converting by editing call sites means
 * rewriting 2,389 `text-slate-*`, 643 `border-slate-*`, 452 `bg-slate-*` and
 * 650 `text-cyan` occurrences — weeks of churn with the product visually broken
 * throughout, and a permanent risk that page #187 was missed.
 *
 * So the theme is inverted **here**, at the ramp, instead.
 *
 * The insight that makes it safe: the numeric step in this codebase is not
 * decorative, it is a *role*, and it is applied consistently.
 *
 *     text-slate-300   1028x   body copy
 *     text-slate-200    982x   emphasised copy
 *     border-slate-800  404x   hairline between surfaces
 *     text-slate-100    104x   headings
 *     bg-slate-950      203x   page / sunken well
 *
 * Mirroring the ramp (light end <-> dark end) maps every one of those roles to
 * its light-theme equivalent at once. `text-slate-300` stops meaning "light grey
 * on near-black" and starts meaning `#334155` on white — still body copy, now at
 * 10.35:1 instead of 1.4:1. ~5,100 call sites became correct without being
 * touched.
 *
 * ## The mirror is not symmetric, and that is deliberate
 *
 * A naive `step -> 1000 - step` fails four roles, each caught by
 * `npm run audit:contrast` (scripts/verify-palette-contrast.mjs):
 *
 *   - `text-slate-600` would mirror to slate-400 = **2.56:1 on white**, a fail.
 *     The dark theme used 600 for "barely there" decoration, but on white there
 *     is no legible step below 4.5:1, so 500 and 600 both resolve to `#64748b`.
 *     Collapsing two steps beats shipping unreadable timestamps.
 *   - `text-emerald-400` / `amber-400` / `green-400` would mirror to the 600
 *     step, which lands at 3.2–3.8:1. Status text must clear 4.5:1, so the
 *     300/400 band maps to **700**, not 600.
 *
 * See `SEMANTIC_MIRROR` and `SLATE_MIRROR` below.
 *
 * ## Why `cyan` holds an orange ramp
 *
 * The brand mark is `#f96403`. `text-cyan` / `bg-cyan` / `border-cyan` appear
 * 1,070 times, so the *names* are load-bearing; renaming them is a 200-file diff
 * that would bury every real change in this pass. The scale keeps its key and
 * carries the brand ramp. `brand` is exported as the alias new code should use,
 * and both keys point at the same object, so a later rename is a pure
 * find/replace with no visual delta.
 *
 * ## Why these are full ramps and never plain strings
 *
 * `theme.extend.colors` merges **shallowly**. An earlier config set
 * `cyan: "#31d7c8"`, which replaced Tailwind's entire `cyan` *object* with a
 * string — so every `text-cyan-300`, `bg-cyan-500/10`, `border-cyan-900/50` and
 * `shadow-cyan-500/25` in the codebase emitted **no CSS at all** and rendered
 * unstyled. The same bug hit `lime`. Every scale here defines all eleven steps
 * plus `DEFAULT`; never collapse one back to a string.
 */

/**
 * Mirror map for the semantic families (red, amber, emerald, …).
 *
 * The 200–400 band is where this codebase puts status *text* (`text-red-300`
 * 101x, `text-emerald-300` 76x, `text-amber-300` 75x). It maps to **800**, not
 * 700, and the reason is composition rather than the page.
 *
 * Those labels are almost always drawn on a 10% tint *of their own colour* —
 * `.badge-success` is `bg-emerald-500/10 text-emerald-300`. That makes the colour
 * its own background, and the 700 steps of the warm families are too light to
 * survive it: green-700 on a 10% green tint is 4.38:1, amber-700 4.39:1,
 * orange-700 4.48:1. All measured on the real DOM by
 * `audit-rendered-contrast.mjs`, all invisible against a plain-white check.
 *
 * At 800 every family clears 5.5:1 on its own tint with room to spare. The cost is
 * that 200/300/400 now resolve to the same value — acceptable, because all three
 * were the same *role*, and a distinction nobody can see is not worth a fail.
 *
 * The 500–950 band is tints and fills (`bg-red-500/10`,
 * `border-amber-500/30`), so it maps to the pale end.
 */
const SEMANTIC_MIRROR: Record<string, number> = {
  50: 950, 100: 900, 200: 800, 300: 800, 400: 800, 500: 600,
  600: 500, 700: 200, 800: 100, 900: 50, 950: 50,
};

/**
 * Mirror map for `slate`, which carries different roles than the semantic
 * families: 100–600 is the type hierarchy, 700–950 is surfaces and hairlines.
 *
 * 500 and 600 intentionally collide — see the note above.
 */
const SLATE_MIRROR: Record<string, number> = {
  50: 950, 100: 900, 200: 800, 300: 700, 400: 600, 500: 500,
  600: 500, 700: 300, 800: 200, 900: 100, 950: 50,
};

/**
 * The "dim" step, overriding what the mirror would produce.
 *
 * A naive mirror leaves 500/600 at slate-500 (`#64748b`), which is 4.76:1 on
 * white — a pass with 0.26 of headroom. That headroom is not enough for how the
 * step is actually used: `text-slate-500` appears 61 times, often *inside* a
 * tinted chip or a hero wash, and `audit-rendered-contrast.mjs` measured those
 * real compositions at **4.20:1**. Passing against the page while failing against
 * the thing it is drawn on is the specific failure mode a token-level audit cannot
 * see.
 *
 * `#58687d` is 5.69:1 on white and 5.03:1 on the neutral badge tint, so the step
 * survives being placed on any surface in the system. It stays clearly dimmer than
 * slate-400 (7.58:1), which is what the role requires.
 */
const SLATE_DIM = "#58687d";

type Ramp = Record<string, string>;

/** Applies a mirror map to a Tailwind scale, keeping every key present. */
function mirror(scale: Ramp, map: Record<string, number>, defaultStep: number): Ramp {
  const out: Ramp = {};
  for (const step of Object.keys(map)) out[step] = scale[String(map[step])];
  out.DEFAULT = scale[String(defaultStep)];
  return out;
}

const semantic = (scale: Ramp, defaultStep = 800) => mirror(scale, SEMANTIC_MIRROR, defaultStep);

/**
 * Brand ramp.
 *
 * `#f96403` — sampled from `public/logo_circle_whiter.png` — is the mark's colour
 * and sits at step 500 of a natural orange scale.
 *
 * The scale is then **mirrored like the semantic families**, and it has to be. The
 * codebase reaches for numeric brand steps 40 times, and those uses were written
 * for a dark page: `text-cyan-300` / `text-cyan-400` (16 sites) meant "bright
 * brand text". Left un-mirrored they resolve to `#fdba74` and `#fb8b3c` — 1.69:1
 * and 2.37:1 on white, i.e. illegible. Mirrored, both land on `BRAND_TEXT`, and
 * the tint side keeps working too: `bg-cyan-500/10` becomes a pale orange badge
 * fill rather than a muddy one.
 *
 * `DEFAULT` (= step 700 = `BRAND_TEXT`) is what `text-cyan` resolves to — 627
 * links, active nav labels, and inline emphasis, all body-sized text on white.
 *
 * The mark's own `#f96403` is 3.06:1: correct for a logo or a large graphic under
 * WCAG 1.4.11, a failure as text. It stays reachable as `bg-cyan-600` and as
 * `--brand-graphic` in globals.css. Do not set text in it.
 */
const BRAND_MARK = "#f96403";

/**
 * The accessible brand step.
 *
 * Not `#c2410c` (orange-700), which is the obvious choice and what this shipped
 * with first. That value is 5.18:1 on white and looks fine in a token-level audit
 * — but `text-cyan` is used 627 times, and ~90 of those sit inside a `bg-cyan/10`
 * chip. When such a chip lands inside an already brand-tinted panel the tint
 * stacks, and `audit-rendered-contrast.mjs` measured the real composition at
 * **4.10–4.48:1**: a fail, on the site's most-used accent, invisible to every
 * static check.
 *
 * `#b23b0b` is one notch darker: 5.96:1 on white and 5.27:1 on a brand tint. The
 * figure that decides it is the *doubled* tint — a `bg-cyan/10` chip inside an
 * already brand-tinted panel — where it holds 4.70:1 and `#c2410c` measured 4.19.
 * White-on-it is also 5.96:1, which keeps the primary button legible.
 */
const BRAND_TEXT = "#b23b0b";

const brand = {
  ...semantic(
    {
      50: "#fff7ed",
      100: "#ffedd5",
      200: "#fed7aa",
      300: "#fdba74",
      400: "#fb8b3c",
      500: BRAND_MARK,
      600: "#ea580c",
      700: "#c2410c",
      800: BRAND_TEXT,
      900: "#7c2d12",
      950: "#431407",
    },
    800,
  ),

  /**
   * Named steps, deliberately non-numeric.
   *
   * The mirror inverts the numeric scale, which also inverts what a *hover*
   * modifier does: `bg-cyan-500 hover:bg-cyan-400` used to darken on hover and now
   * lightens, dropping a white label from 3.56:1 to 2.37:1 exactly while the
   * pointer is on it. Three real buttons had that bug.
   *
   * Numeric steps cannot express "one step darker" under a mirror, so intent gets
   * its own key. `bg-cyan-press` is always darker than `bg-cyan`, in either theme,
   * and `text-cyan-mark` is always the logo hue.
   */
  press: "#9a3412",
  mark: BRAND_MARK,
} as const;

/**
 * "Safe / positive" accent.
 *
 * Was acid lime `#b7f34a`, which is **1.32:1 on white** — invisible. `text-lime`
 * has 76 call sites marking safe verdicts and passed checks, and most of them sit
 * on a `bg-lime/10` chip, so the DEFAULT has to survive its own tint: green-800
 * (`#166534`) is 7.13:1 on white and 6.14:1 on the tint. green-700 measured
 * 4.38:1 there and failed.
 */
const lime = semantic(colors.green as Ramp, 800);

/**
 * Page ramp ("ink"). Historically the near-black page background.
 *
 * `DEFAULT` is now `#ffffff`, which fixes two families of call site at once:
 * `bg-ink` (27x) becomes the white page, and `text-ink` (35x) — always paired
 * with a brand fill, e.g. `bg-cyan … text-ink` — becomes white-on-orange at
 * 5.18:1.
 *
 * One case this does *not* fix: `bg-ink/80` was five modal scrims, and white at
 * 80% over a white page is no scrim at all. Those call sites move to
 * `bg-slate-900/50`.
 */
const ink: Ramp = { ...mirror(colors.slate as Ramp, SLATE_MIRROR, 50), DEFAULT: "#ffffff" };

/** Elevated surface ramp ("panel"). White card on a white page, split by a hairline. */
const panel: Ramp = { ...mirror(colors.slate as Ramp, SLATE_MIRROR, 50), DEFAULT: "#ffffff" };

/** Neutral ramp. Carries the entire type hierarchy plus every surface and rule. */
const slate: Ramp = {
  ...mirror(colors.slate as Ramp, SLATE_MIRROR, 700),
  500: SLATE_DIM,
  600: SLATE_DIM,
};


const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "Consolas", "Monaco", "monospace"],
      },

      colors: {
        // Neutrals and surfaces.
        slate,
        ink,
        panel,

        // Brand. `cyan` is the legacy key (1,070 call sites); `brand` is the
        // name new code should use. Same object — see the header note.
        cyan: brand,
        brand,
        lime,

        /**
         * Semantic families, mirrored.
         *
         * All of these appear as status colours on what is now a white surface.
         * Left un-mirrored, `text-red-300` (101x) would render `#fca5a5` on
         * white — 1.9:1, effectively invisible.
         */
        red: semantic(colors.red as Ramp),
        rose: semantic(colors.rose as Ramp),
        orange: semantic(colors.orange as Ramp),
        amber: semantic(colors.amber as Ramp),
        yellow: semantic(colors.yellow as Ramp),
        green: semantic(colors.green as Ramp),
        emerald: semantic(colors.emerald as Ramp),
        teal: semantic(colors.teal as Ramp),
        sky: semantic(colors.sky as Ramp),
        blue: semantic(colors.blue as Ramp),
        indigo: semantic(colors.indigo as Ramp),
        violet: semantic(colors.violet as Ramp),
        purple: semantic(colors.purple as Ramp),
        fuchsia: semantic(colors.fuchsia as Ramp),
        pink: semantic(colors.pink as Ramp),
      },

      /**
       * Fluid display scale. `clamp()` removes the need for a separate
       * `sm:`/`lg:` font-size at every heading call site and keeps large
       * headings from overflowing narrow viewports (a CLS source).
       */
      fontSize: {
        "display-xs": ["clamp(1.5rem, 1.3rem + 1vw, 1.875rem)", { lineHeight: "1.25", letterSpacing: "-0.015em" }],
        "display-sm": ["clamp(1.75rem, 1.45rem + 1.5vw, 2.25rem)", { lineHeight: "1.2", letterSpacing: "-0.018em" }],
        "display-md": ["clamp(2rem, 1.6rem + 2vw, 3rem)", { lineHeight: "1.15", letterSpacing: "-0.021em" }],
        "display-lg": ["clamp(2.5rem, 1.9rem + 3vw, 3.75rem)", { lineHeight: "1.08", letterSpacing: "-0.024em" }],
        "display-xl": ["clamp(2.75rem, 2rem + 4vw, 4.5rem)", { lineHeight: "1.04", letterSpacing: "-0.028em" }],
      },

      /** Optical letter-spacing steps for eyebrows and small caps. */
      letterSpacing: {
        eyebrow: "0.18em",
        micro: "0.12em",
      },

      /**
       * Layered elevation, retuned for a white page.
       *
       * A dark UI reads depth from a white inset highlight plus a soft ambient
       * shadow. On white that highlight is invisible, so **all** the elevation
       * has to come from the shadow — but at dark-theme opacity (24–32%) a light
       * card looks like it is sitting in a smudge.
       *
       * These are tinted with slate rather than pure black (neutral black over
       * white reads grey and slightly dead next to a blue-grey hairline) and
       * capped at 10%. Kept in sync with the `--shadow-*` tokens in globals.css.
       */
      boxShadow: {
        glow: "0 0 0 1px rgba(178, 59, 11, 0.14), 0 8px 24px rgba(178, 59, 11, 0.10)",
        "elevation-1": "0 1px 2px rgba(15, 23, 42, 0.05)",
        "elevation-2": "0 1px 2px rgba(15, 23, 42, 0.05), 0 2px 8px rgba(15, 23, 42, 0.05)",
        "elevation-3": "0 2px 4px rgba(15, 23, 42, 0.05), 0 8px 24px rgba(15, 23, 42, 0.07)",
        "elevation-4": "0 4px 8px rgba(15, 23, 42, 0.06), 0 16px 48px rgba(15, 23, 42, 0.10)",
        "ring-brand": "0 0 0 1px rgba(178, 59, 11, 0.30), 0 6px 20px rgba(178, 59, 11, 0.10)",
        "inset-hairline": "inset 0 1px 0 rgba(255, 255, 255, 0.6)",
      },


      /** Shared motion vocabulary so components animate consistently. */
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
        "out-back": "cubic-bezier(0.34, 1.56, 0.64, 1)",
        "in-out-smooth": "cubic-bezier(0.4, 0, 0.2, 1)",
      },

      transitionDuration: {
        fast: "120ms",
        base: "180ms",
        slow: "280ms",
      },

      /**
       * `card` and `panel` mirror `--radius-lg` / `--radius-xl`.
       *
       * These are deliberately tighter than Tailwind's `rounded-xl`/`2xl`. See
       * the radii note in globals.css: on nested console surfaces a large outer
       * radius forces every inner element into a bad corner alignment.
       */
      borderRadius: {
        card: "0.625rem",
        panel: "0.875rem",
      },

      /** Reading-measure caps used by long-form copy. */
      maxWidth: {
        prose: "68ch",
        measure: "58ch",
      },

      backgroundImage: {
        "brand-sheen": "linear-gradient(135deg, #f96403 0%, #b23b0b 100%)",
        "surface-fade": "linear-gradient(180deg, rgba(248,250,252,0.9) 0%, rgba(255,255,255,0) 100%)",
      },

      zIndex: {
        banner: "40",
        header: "50",
        drawer: "60",
        overlay: "70",
        toast: "80",
      },
    },
  },
  plugins: [],
};

export default config;
