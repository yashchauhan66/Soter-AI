import { BLOG_POSTS } from "@/lib/blog/posts";
import { buildCrumbs } from "@/lib/navigation";
import { SITEMAP_SEGMENTS } from "@/lib/seo/sitemapData";

/**
 * Share-card registry. One card per known page, drawn at build time from this list.
 *
 * Cards are keyed by page, not by a query string, so nobody can make our domain draw
 * arbitrary text. An unknown page falls back to the default card.
 *
 * Copy rules for a card: plain words from the page's own promise, no statistic, no
 * "100%", no logo of a shield or padlock. A share preview is read in a second, so it
 * carries one idea.
 */
export interface OgCard {
  kicker: string;
  title: string;
}

const PAGES: Array<[path: string, kicker: string, title: string]> = [
  ["/", "AI security command layer", "Decide what your AI can see, say and do."],
  ["/pricing", "Pricing", "Free to start. Every plan runs the same engine."],
  ["/playground", "Playground", "Try it on your own text. No signup."],
  ["/benchmarks", "Evidence", "Every number, with the test behind it and its limits."],
  ["/limitations", "Evidence", "What SoterAI misses today."],
  ["/comparison", "Compare", "How SoterAI compares, and where it does not."],
  ["/trust", "Evidence", "What we hold, and what we do not."],
  ["/about", "About", "Built and run by one person."],
  ["/integrations", "Integrations", "Put the check where your team already works."],
  ["/case-studies", "Illustrative analysis", "Scenarios, not customer proof."],
  ["/case-studies/prompt-injection-leaks-database", "Illustrative RAG scenario", "How prompt injection could expose a database."],
  ["/integrations/n8n", "n8n Guard (Beta)", "Add a guard step to an n8n AI workflow."],
  ["/integrations/make", "Make Guard (Beta)", "Check AI inputs and replies in a Make scenario."],
  ["/integrations/zapier", "Zapier Guard (Beta)", "Add an AI security check to a Zap."],
  ["/extensions/ide", "IDE Guard (Beta)", "Review prompts and secrets in VS Code."],
  ["/extensions/browser", "Browser Guard (Beta)", "Review AI input in your browser."],
  ["/blog", "Blog", "AI security notes for developers."],
  ["/contact-sales", "Security review", "Book a security review."],
  ["/docs", "Docs", "Quickstart, SDKs and the REST API."],
  ["/ai-agent-security", "Agents", "Hold risky agent actions for approval."],
  ["/ai-user-security", "Teams", "Set rules for how your team uses AI."],
  ["/prompt-injection-protection", "Prompt injection", "Flag prompt injection before the model reads it."],
  ["/jailbreak-detection", "Jailbreaks", "Flag jailbreak attempts, with published limits."],
  ["/ai-data-leakage-prevention", "Data leakage", "Redact secrets and personal data before they leave."],
  ["/rag-security", "RAG", "Check retrieved documents before they reach the model."],
  ["/mcp-security", "MCP (Labs)", "Review MCP tools and tool calls."],
  ["/llm-firewall", "LLM firewall", "Check prompts and replies in one place."],
  ["/llm-security", "LLM security", "One engine for prompts, replies and actions."],
  ["/ai-security-india", "Regional depth", "Indian identifiers, named directly."],
  ["/ai-workflow-security", "Workflows", "Guard steps for n8n, Make and Zapier."],
  ["/vscode-ai-security", "VS Code (Beta)", "Find secrets before they reach an AI assistant."],
];

/** Path to the key used in the card URL. "/" is "home", "/a/b" is "a-b". */
export const ogKey = (path: string): string => (path === "/" ? "home" : path.replace(/^\//, "").replace(/\//g, "-"));

const cards = new Map<string, OgCard>();
for (const [path, kicker, title] of PAGES) cards.set(ogKey(path), { kicker, title });
const SEGMENT_LABELS: Record<string, string> = { core: "SoterAI", topics: "Product", integrations: "Integrations", evidence: "Evidence", legal: "Policy", docs: "Docs", blog: "Blog" };
// Public pages outside the editorial list still get their own card, using the
// existing IA label rather than an invented product claim or a shared image.
for (const [segment, entries] of Object.entries(SITEMAP_SEGMENTS)) {
  for (const entry of entries) {
    const key = ogKey(entry.url);
    if (!cards.has(key)) cards.set(key, { kicker: SEGMENT_LABELS[segment] ?? "SoterAI", title: buildCrumbs(entry.url).at(-1)?.name ?? "SoterAI" });
  }
}
for (const post of BLOG_POSTS) {
  cards.set(ogKey(`/blog/${post.slug}`), { kicker: "Blog", title: post.seoTitle ?? post.title });
}

export const DEFAULT_CARD: OgCard = { kicker: "AI security command layer", title: "Decide what your AI can see, say and do." };

export const OG_KEYS: string[] = ["default", ...cards.keys()];

export function getOgCard(key: string): OgCard | null {
  if (key === "default") return DEFAULT_CARD;
  return cards.get(key) ?? null;
}

/** URL of the share card for a page, or the default card when the page has none. */
export function ogCardUrl(path: string): string {
  const key = ogKey(path.split("?")[0].replace(/\/$/, "") || "/");
  return cards.has(key) ? `/og-card/${key}.png` : "/og-card/default.png";
}
