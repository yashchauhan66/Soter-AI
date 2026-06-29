import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo/schema";

// Private areas that should never be crawled by anyone.
const PRIVATE_PATHS = [
  "/api/",
  "/admin/",
  "/dashboard/",
  "/signin",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/_next/",
];

// Answer-engine / LLM crawlers we explicitly welcome. For an AI-security brand,
// being citable inside ChatGPT, Claude, Perplexity and Google AI answers
// (generative engine optimization) is a primary discovery channel — so these
// are allowed on public pages rather than blocked. They still cannot reach the
// authenticated app surface (PRIVATE_PATHS).
const AI_CRAWLERS = [
  "GPTBot", // OpenAI training/index
  "OAI-SearchBot", // ChatGPT search
  "ChatGPT-User", // ChatGPT live browsing
  "ClaudeBot", // Anthropic index
  "anthropic-ai", // Anthropic
  "Claude-User", // Claude live browsing
  "PerplexityBot", // Perplexity index
  "Perplexity-User", // Perplexity live browsing
  "Google-Extended", // Gemini / Vertex grounding
  "Applebot-Extended", // Apple Intelligence
  "CCBot", // Common Crawl (feeds many LLMs)
];

export default function robots(): MetadataRoute.Robots {
  const siteUrl = SITE_URL;

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
      // Same public/private boundary, stated explicitly for AI crawlers so the
      // policy is unambiguous and future-proof.
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: PRIVATE_PATHS,
      })),
    ],
    host: siteUrl,
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
