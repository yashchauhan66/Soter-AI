import type { Config } from "tailwindcss";

/**
 * SoterAI design system — Tailwind theme.
 *
 * ## Why `cyan` and `lime` are full ramps and not single hex strings
 *
 * `theme.extend.colors` performs a **shallow** merge. The previous config set
 * `cyan: "#31d7c8"`, which replaced Tailwind's entire built-in `cyan` *object*
 * with a plain string. The consequence was silent and site-wide: every
 * `text-cyan-300`, `bg-cyan-500/10`, `border-cyan-900/50` and
 * `shadow-cyan-500/25` in the codebase generated **no CSS at all**, so those
 * elements rendered unstyled (PHLaunchBanner, DemoVideo, GuidedDemoFlow,
 * ModelScanUploader, case studies, dashboard verdict colours, …). The same bug
 * applied to `lime` (`text-lime-300`, `text-lime-400`, `bg-lime-500/20`).
 *
 * Defining a scale **with a `DEFAULT` key** fixes both directions at once:
 *   - `text-cyan`      → resolves to DEFAULT (#31d7c8) — the legacy brand usage
 *   - `text-cyan-300`  → resolves to a real ramp step  — the numeric usage
 *   - `bg-cyan/10`     → DEFAULT + alpha               — still works
 *
 * Never collapse these back to a string.
 */

/** Brand teal. Ramp generated around the existing brand value at step 400. */
const cyan = {
  DEFAULT: "#31d7c8",
  50: "#eafffc",
  100: "#c9fff8",
  200: "#96fef3",
  300: "#5ef4e8",
  400: "#31d7c8",
  500: "#14b8ab",
  600: "#0a938b",
  700: "#0c746f",
  800: "#0f5c59",
  900: "#114c4a",
  950: "#032e2d",
} as const;

/** Brand lime, used for positive/"safe" affordances. */
const lime = {
  DEFAULT: "#b7f34a",
  50: "#f7ffe5",
  100: "#ecffc7",
  200: "#d9ff95",
  300: "#c6fa68",
  400: "#b7f34a",
  500: "#93d420",
  600: "#71a913",
  700: "#568013",
  800: "#456515",
  900: "#3b5616",
  950: "#1d3005",
} as const;

/** Page background ramp ("ink"). 500 is the historical `bg-ink`. */
const ink = {
  DEFAULT: "#08111f",
  50: "#f4f7fb",
  100: "#e6ecf4",
  200: "#c9d6e6",
  300: "#9db2cd",
  400: "#6a87ae",
  500: "#08111f",
  600: "#070f1b",
  700: "#060c16",
  800: "#040911",
  900: "#03060b",
  950: "#010305",
} as const;

/** Elevated surface ramp ("panel"). DEFAULT is the historical `bg-panel`. */
const panel = {
  DEFAULT: "#101b2d",
  50: "#f6f8fb",
  100: "#eaeff6",
  200: "#d0dbe9",
  300: "#a7bbd4",
  400: "#7794b8",
  500: "#1b2c48",
  600: "#16243b",
  700: "#131f33",
  800: "#101b2d",
  900: "#0c1524",
  950: "#070d17",
} as const;

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "Consolas", "Monaco", "monospace"],
      },

      colors: { ink, panel, cyan, lime },

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
       * Layered elevation. Dark UIs read depth from a hairline highlight plus a
       * soft ambient shadow, not from a single hard drop shadow.
       */
      boxShadow: {
        glow: "0 0 50px rgba(49, 215, 200, 0.12)",
        "elevation-1": "0 1px 2px rgba(2, 6, 14, 0.32), 0 1px 3px rgba(2, 6, 14, 0.18)",
        "elevation-2": "0 2px 4px rgba(2, 6, 14, 0.34), 0 6px 16px rgba(2, 6, 14, 0.22)",
        "elevation-3": "0 4px 8px rgba(2, 6, 14, 0.36), 0 12px 32px rgba(2, 6, 14, 0.28)",
        "elevation-4": "0 8px 16px rgba(2, 6, 14, 0.38), 0 24px 64px rgba(2, 6, 14, 0.34)",
        "ring-brand": "0 0 0 1px rgba(49, 215, 200, 0.30), 0 8px 28px rgba(49, 215, 200, 0.10)",
        "inset-hairline": "inset 0 1px 0 rgba(255, 255, 255, 0.05)",
      },

      /** Shared motion vocabulary so components animate consistently. */
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
        "out-back": "cubic-bezier(0.34, 1.56, 0.64, 1)",
        "in-out-smooth": "cubic-bezier(0.4, 0, 0.2, 1)",
      },

      transitionDuration: {
        fast: "140ms",
        base: "220ms",
        slow: "360ms",
      },

      borderRadius: {
        card: "0.875rem",
        panel: "1.25rem",
      },

      /** Reading-measure caps used by long-form copy. */
      maxWidth: {
        prose: "68ch",
        measure: "58ch",
      },

      backgroundImage: {
        "brand-sheen": "linear-gradient(135deg, #31d7c8 0%, #14b8ab 100%)",
        "surface-fade": "linear-gradient(180deg, rgba(16,27,45,0.85) 0%, rgba(8,17,31,0) 100%)",
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
