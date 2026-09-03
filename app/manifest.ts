import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SoterAI - AI Security Command Layer",
    short_name: "SoterAI",
    description:
      "AI security command layer for chatbots, RAG apps, and autonomous agents. Detect prompt injection, prevent data leakage, and monitor risky AI behavior.",
    start_url: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "minimal-ui"],
    // Tracks --surface-0 in app/globals.css. The PWA splash screen paints this
    // before the app renders, so a stale value shows as a colour flash on launch.
    background_color: "#ffffff",
    // The brand's *text* step, not the logo's #f96403. This paints the task
    // switcher and address bar, where it sits behind white system glyphs.
    theme_color: "#b23b0b",
    orientation: "portrait-primary",
    categories: ["security", "developer-tools", "productivity"],
    lang: "en",
    scope: "/",
    id: "/",
    shortcuts: [
      { name: "Benchmarks", short_name: "Benchmarks", description: "View adversarial benchmark results", url: "/benchmarks", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Playground", short_name: "Playground", description: "Test SoterAI interactively", url: "/playground", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Docs", short_name: "Docs", description: "Integration documentation", url: "/docs", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
    icons: [
      { src: "/icon.png", sizes: "32x32", type: "image/png" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
    screenshots: [
      { src: "/opengraph-image.png", sizes: "1200x630", type: "image/png", form_factor: "wide", label: "SoterAI AI Security Command Layer" },
    ],
    prefer_related_applications: false,
    related_applications: [],
  };
}