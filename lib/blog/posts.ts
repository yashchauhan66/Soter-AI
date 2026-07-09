/**
 * Single source of truth for blog post metadata.
 *
 * The blog index (`app/blog/page.tsx`) and the sitemap both derive from this
 * list, so they never drift from the actual `app/blog/<slug>/page.tsx` routes.
 * Post *content* lives in each route file; this only holds listing metadata.
 */
export interface BlogPostMeta {
  slug: string;
  title: string;
  description: string;
  /** ISO date (YYYY-MM-DD). */
  datePublished: string;
  /** Short listing excerpt. */
  excerpt: string;
  /** Estimated reading time, e.g. "8 min read". */
  readingTime: string;
  tags: string[];
}

export const BLOG_POSTS: BlogPostMeta[] = [
  {
    slug: "how-ai-coding-tools-leak-secrets",
    title: "How AI Coding Tools Can Leak Secrets — and How to Reduce the Risk",
    description:
      "AI coding assistants read more of your project than you think. Here is how secrets end up in prompts, and practical steps to reduce the risk locally.",
    datePublished: "2026-07-06",
    excerpt:
      "AI coding assistants read more of your project than you think. Here is how credentials end up in prompts — and a practical, local-first checklist to reduce the risk.",
    readingTime: "9 min read",
    tags: ["secret-scanning", "ai-coding", "data-leakage"],
  },
  {
    slug: "what-is-ai-context-firewall",
    title: "What Is an AI Context Firewall? A Developer Guide",
    description:
      "A developer-focused explanation of the AI context firewall pattern: what it inspects, where it sits, and how it differs from a traditional firewall or DLP.",
    datePublished: "2026-07-06",
    excerpt:
      "The context an AI reads is the new attack surface. This guide explains the AI context firewall pattern — what it inspects, where it sits, and its honest limits.",
    readingTime: "10 min read",
    tags: ["ai-context-firewall", "prompt-injection", "architecture"],
  },
  {
    slug: "mcp-security-for-developers",
    title: "MCP Security for Developers: Why Tool Permissions Matter",
    description:
      "The Model Context Protocol gives AI agents real tools. This guide covers the permission risks, common failure modes, and how to review MCP configs safely.",
    datePublished: "2026-07-06",
    excerpt:
      "MCP gives AI agents real tools — file systems, shells, networks. This guide covers the permission risks, common failure modes, and how to review MCP configs safely.",
    readingTime: "9 min read",
    tags: ["mcp-security", "ai-agent-security", "tool-permissions"],
  },
];

export function getPost(slug: string): BlogPostMeta | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}
