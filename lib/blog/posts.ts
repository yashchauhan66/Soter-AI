/**
 * Single source of truth for blog post metadata.
 *
 * The blog index (`app/blog/page.tsx`) and the sitemap both derive from this
 * list, so they never drift from the actual `app/blog/<slug>/page.tsx` routes.
 * Post *content* lives in each route file; this only holds listing metadata.
 */
export interface BlogPostMeta {
  slug: string;
  /** Editorial headline. Rendered as the page <h1>, so it can be long and rich. */
  title: string;
  /**
   * Optional shorter title for the <title> tag. Set this when `title` plus the
   * layout's " | SoterAI" suffix would exceed ~60 chars and get truncated in the
   * SERP — the h1 keeps the full headline, the SERP gets a clickable one.
   */
  seoTitle?: string;
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
    title: "How to Prevent Secret Leaks from AI Coding Tools",
    description:
      "Prevent secret leaks from AI coding tools with local scanning, redaction, narrow context, canaries, and credential rotation before prompts leave your editor.",
    datePublished: "2026-07-06",
    excerpt:
      "AI coding assistants read more of your project than you think. Here is how credentials end up in prompts — and a practical, local-first checklist to reduce the risk.",
    readingTime: "9 min read",
    tags: ["secret-scanning", "ai-coding", "data-leakage"],
  },
  {
    slug: "what-is-ai-context-firewall",
    title: "What Is an AI Context Firewall? Definition and Architecture",
    seoTitle: "What Is an AI Context Firewall? Architecture",
    description:
      "An AI context firewall inspects prompts, files, tool results, and model output for secret leakage and injected instructions. Learn its architecture and limits.",
    datePublished: "2026-07-06",
    excerpt:
      "The context an AI reads is the new attack surface. This guide explains the AI context firewall pattern — what it inspects, where it sits, and its honest limits.",
    readingTime: "10 min read",
    tags: ["ai-context-firewall", "prompt-injection", "architecture"],
  },
  {
    slug: "mcp-security-for-developers",
    title: "MCP Security for Developers: Why Tool Permissions Matter",
    seoTitle: "MCP Security: Why Tool Permissions Matter",
    description:
      "The Model Context Protocol gives AI agents real tools. This guide covers the permission risks, common failure modes, and how to review MCP configs safely.",
    datePublished: "2026-07-06",
    excerpt:
      "MCP gives AI agents real tools — file systems, shells, networks. This guide covers the permission risks, common failure modes, and how to review MCP configs safely.",
    readingTime: "9 min read",
    tags: ["mcp-security", "ai-agent-security", "tool-permissions"],
  },
  {
    slug: "ai-security-best-practices-indian-enterprises-2026",
    title: "AI Security Best Practices for Indian Enterprises in 2026",
    seoTitle: "AI Security Best Practices: Indian Enterprises",
    description:
      "Enterprise AI security checklist for Indian businesses: Aadhaar PII compliance, prompt injection prevention, RAG security and agent firewall deployment.",
    datePublished: "2026-07-18",
    excerpt:
      "Indian enterprises adopting AI need security tailored to India's regulatory landscape. This guide covers Aadhaar/PAN PII compliance, prompt injection defense, and RAG security for Indian businesses.",
    readingTime: "12 min read",
    tags: ["ai-security-india", "enterprise-ai-security", "aadhaar-compliance", "indian-pii"],
  },
  {
    slug: "what-is-prompt-injection-types-examples-prevention",
    title: "What Is Prompt Injection? Types, Examples, and Prevention for Developers",
    seoTitle: "What Is Prompt Injection? Types & Prevention",
    description:
      "A guide to prompt injection attacks: direct vs indirect injection, jailbreak techniques, encoding obfuscation and practical prevention for LLM apps.",
    datePublished: "2026-07-19",
    excerpt:
      "Prompt injection is the top LLM security risk. Learn what it is, see real attack examples (DAN, hypothetical scenario, encoded instructions), and implement practical defenses.",
    readingTime: "14 min read",
    tags: ["prompt-injection", "llm-security", "jailbreak-detection", "ai-security"],
  },
  {
    slug: "llm-guardrails-explained-developer-guide",
    title: "What Are LLM Guardrails? Types, Examples and Architecture",
    seoTitle: "What Are LLM Guardrails? Types & Architecture",
    description:
      "Learn what LLM guardrails are, with input, output, RAG, and agent examples plus a practical architecture for deploying AI safety controls in production.",
    datePublished: "2026-07-20",
    excerpt:
      "LLM guardrails are the safety layer between your AI and your users. This guide explains input/output guards, jailbreak detection, topic fencing, and PII redaction for production AI apps.",
    readingTime: "11 min read",
    tags: ["llm-guardrails", "ai-safety", "guardrails-ai", "ai-content-safety"],
  },
  {
    slug: "ai-agent-security-risks-threats-protection",
    title: "AI Agent Security: Risks, Real Threats, and How to Protect Autonomous Agents",
    seoTitle: "AI Agent Security: Risks & How to Protect Agents",
    description:
      "AI agents bring new risks: tool abuse, MCP permission exploits, indirect prompt injection and data exfiltration. Learn how to secure agents in production.",
    datePublished: "2026-07-21",
    excerpt:
      "Autonomous AI agents can call tools, execute code, and access data. This guide covers the real security risks of agentic AI and how to deploy agents with proper safety controls.",
    readingTime: "13 min read",
    tags: ["ai-agent-security", "autonomous-agents", "agent-firewall", "mcp-security"],
  },
  {
    slug: "pii-detection-indian-businesses-aadhaar-pan-gstin-compliance",
    title: "PII Detection for Indian Businesses: Aadhaar, PAN, GSTIN Compliance Guide",
    seoTitle: "PII Detection in India: Aadhaar, PAN & GSTIN",
    description:
      "India-specific PII detection and redaction for AI apps: detect Aadhaar, PAN, GSTIN and UPI IDs, and align with India's data protection framework.",
    datePublished: "2026-07-22",
    excerpt:
      "Indian businesses processing PII through AI need India-specific detection. This guide covers Aadhaar, PAN, GSTIN, UPI, and mobile number detection for AI compliance.",
    readingTime: "10 min read",
    tags: ["pii-detection-india", "aadhaar-data-protection", "indian-compliance", "ai-privacy"],
  },
];

export function getPost(slug: string): BlogPostMeta | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}
