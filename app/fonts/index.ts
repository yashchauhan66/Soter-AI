import localFont from "next/font/local";

// Self-hosted fonts (no build-time network dependency on Google Fonts).
// Variable woff2 files cover the full 400–900 / 400–700 weight ranges.
// Subsets downloaded from fonts.gstatic.com (latin + latin-ext).
export const inter = localFont({
  src: [
    { path: "./Inter-latin.woff2", weight: "100 900", style: "normal" },
    { path: "./Inter-latin-ext.woff2", weight: "100 900", style: "normal" },
  ],
  display: "swap",
  variable: "--font-inter",
  // The root layout emits both latin and latin-ext sources. Preloading the
  // whole set makes the browser warn about whichever unicode subset is not
  // needed on the current page; let the generated @font-face rules load the
  // matching subset on demand instead.
  preload: false,
  fallback: ["system-ui", "-apple-system", "sans-serif"],
});

export const jetbrainsMono = localFont({
  src: [
    { path: "./JetBrainsMono-latin.woff2", weight: "100 800", style: "normal" },
    { path: "./JetBrainsMono-latin-ext.woff2", weight: "100 800", style: "normal" },
  ],
  display: "swap",
  variable: "--font-jetbrains-mono",
  preload: false,
  fallback: ["Consolas", "Monaco", "monospace"],
});
