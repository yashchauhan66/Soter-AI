import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Soter Guard — AI Security Guardrail Platform",
    short_name: "Soter Guard",
    description:
      "AI security guardrail platform protecting chatbots, RAG apps, and AI agents from prompt injection, jailbreaks, PII leakage, and unsafe outputs.",
    start_url: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "minimal-ui"],
    background_color: "#0f1117",
    theme_color: "#00c8c8",
    orientation: "portrait-primary",
    categories: ["security", "developer-tools", "productivity"],
    lang: "en",
    scope: "/",
    id: "/",
    shortcuts: [
      {
        name: "Benchmarks",
        short_name: "Benchmarks",
        description: "View adversarial benchmark results",
        url: "/benchmarks",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Playground",
        short_name: "Playground",
        description: "Test the guard interactively",
        url: "/playground",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Docs",
        short_name: "Docs",
        description: "Integration documentation",
        url: "/docs",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
    ],
    icons: [
      {
        src: "/icon.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
    screenshots: [
      {
        src: "/opengraph-image.png",
        sizes: "1200x630",
        type: "image/png",
        form_factor: "wide",
        label: "Soter Guard — AI Security Guardrail Platform",
      },
    ],
    prefer_related_applications: false,
    related_applications: [],
  };
}
