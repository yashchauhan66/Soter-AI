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
  {
    slug: "ai-security-best-practices-indian-enterprises-2026",
    title: "AI Security Best Practices for Indian Enterprises in 2026",
    description:
      "Enterprise AI security checklist for Indian businesses: Aadhaar PII compliance, prompt injection prevention, RAG pipeline security, and agent firewall deployment for India's digital stack.",
    datePublished: "2026-07-18",
    excerpt:
      "Indian enterprises adopting AI need security tailored to India's regulatory landscape. This guide covers Aadhaar/PAN PII compliance, prompt injection defense, and RAG security for Indian businesses.",
    readingTime: "12 min read",
    tags: ["ai-security-india", "enterprise-ai-security", "aadhaar-compliance", "indian-pii"],
  },
  {
    slug: "what-is-prompt-injection-types-examples-prevention",
    title: "What Is Prompt Injection? Types, Examples, and Prevention for Developers",
    description:
      "A comprehensive guide to prompt injection attacks: direct vs indirect injection, jailbreak techniques, encoding obfuscation, and practical prevention strategies for LLM-powered applications.",
    datePublished: "2026-07-19",
    excerpt:
      "Prompt injection is the top LLM security risk. Learn what it is, see real attack examples (DAN, hypothetical scenario, encoded instructions), and implement practical defenses.",
    readingTime: "14 min read",
    tags: ["prompt-injection", "llm-security", "jailbreak-detection", "ai-security"],
  },
  {
    slug: "llm-guardrails-explained-developer-guide",
    title: "LLM Guardrails Explained: A Developer's Guide to AI Safety Controls",
    description:
      "What are LLM guardrails? This developer guide explains input/output guards, topic fencing, PII redaction, jailbreak detection, and how to deploy guardrails in production chatbots and RAG apps.",
    datePublished: "2026-07-20",
    excerpt:
      "LLM guardrails are the safety layer between your AI and your users. This guide explains input/output guards, jailbreak detection, topic fencing, and PII redaction for production AI apps.",
    readingTime: "11 min read",
    tags: ["llm-guardrails", "ai-safety", "guardrails-ai", "ai-content-safety"],
  },
  {
    slug: "ai-agent-security-risks-threats-protection",
    title: "AI Agent Security: Risks, Real Threats, and How to Protect Autonomous Agents",
    description:
      "AI agents introduce new security risks: tool abuse, MCP permission exploits, indirect prompt injection, and data exfiltration. Learn how to secure autonomous AI agents in production.",
    datePublished: "2026-07-21",
    excerpt:
      "Autonomous AI agents can call tools, execute code, and access data. This guide covers the real security risks of agentic AI and how to deploy agents with proper safety controls.",
    readingTime: "13 min read",
    tags: ["ai-agent-security", "autonomous-agents", "agent-firewall", "mcp-security"],
  },
  {
    slug: "pii-detection-indian-businesses-aadhaar-pan-gstin-compliance",
    title: "PII Detection for Indian Businesses: Aadhaar, PAN, GSTIN Compliance Guide",
    description:
      "India-specific PII detection and redaction guide for AI applications. Learn how to detect Aadhaar numbers, PAN cards, GSTIN, UPI IDs, and comply with India's data protection framework.",
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
