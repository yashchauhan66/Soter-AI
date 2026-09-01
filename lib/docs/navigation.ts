/**
 * Documentation information architecture — single source of truth.
 *
 * Before this file, `/docs` had **18 guide pages** reachable only through a
 * 6-item horizontal pill nav (`DocsNavigation`) plus a link grid on the hub. A
 * reader on `/docs/wordpress` could not discover that `/docs/whatsapp` existed
 * without navigating back to the hub — the classic "docs as a pile of pages"
 * failure. Every page also re-implemented its own back-link, eyebrow, and H1.
 *
 * Declaring the tree once means the sidebar, the ⌘K search index, the
 * previous/next pager, and breadcrumb labels stay in sync automatically, and
 * adding a guide is a single edit.
 *
 * `minutes` is an honest estimate of hands-on time, not a word count divided by
 * a reading speed. It is shown next to each entry so a reader can budget before
 * starting.
 */

import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Bot,
  Boxes,
  Braces,
  Code2,
  Database,
  FileCode2,
  Globe2,
  Layers3,
  LifeBuoy,
  MessageSquare,
  Rocket,
  ShieldCheck,
  Terminal,
  Zap,
} from "lucide-react";

export interface DocsPage {
  /** Site-relative path. */
  href: string;
  /** Sidebar / search label. Keep short — the summary carries the detail. */
  label: string;
  /** One line describing what the reader can do afterwards. */
  summary: string;
  /** Estimated hands-on minutes. */
  minutes: number;
  /** Extra search terms: aliases, product names, and synonyms. */
  keywords?: string[];
  icon?: LucideIcon;
  /** Marks the recommended starting point. */
  recommended?: boolean;
}

export interface DocsSection {
  id: string;
  label: string;
  /** Shown under the section heading in the sidebar. */
  caption: string;
  icon: LucideIcon;
  pages: DocsPage[];
}

export const DOCS_SECTIONS: DocsSection[] = [
  {
    id: "start",
    label: "Get started",
    caption: "From zero to a guarded request",
    icon: Rocket,
    pages: [
      {
        href: "/docs",
        label: "Overview",
        summary: "What SoterAI does, how the pieces fit together, and where to go next.",
        minutes: 3,
        icon: BookOpen,
        keywords: ["introduction", "index", "home", "getting started"],
      },
      {
        href: "/docs/quickstart",
        label: "Quickstart",
        summary: "Guard your first request end to end: install, key, input guard, output guard, verify.",
        minutes: 5,
        icon: Zap,
        recommended: true,
        keywords: ["first steps", "tutorial", "5 minutes", "hello world", "setup"],
      },
      {
        href: "/docs/services",
        label: "All services",
        summary: "Searchable directory of every security control, each with its own setup guide.",
        minutes: 4,
        icon: Layers3,
        keywords: ["catalog", "directory", "features", "controls", "capabilities"],
      },
    ],
  },
  {
    id: "sdks",
    label: "SDKs & API",
    caption: "Pick your language",
    icon: Code2,
    pages: [
      {
        href: "/docs/js",
        label: "JavaScript / TypeScript",
        summary: "Node.js, Deno, and Bun with typed results and framework snippets.",
        minutes: 6,
        icon: FileCode2,
        keywords: ["node", "npm", "typescript", "ts", "deno", "bun", "javascript"],
      },
      {
        href: "/docs/python",
        label: "Python",
        summary: "Sync and async clients for Django, Flask, and plain scripts.",
        minutes: 6,
        icon: FileCode2,
        keywords: ["pip", "django", "flask", "async", "py"],
      },
      {
        href: "/docs/rest-api",
        label: "REST API",
        summary: "Any language that can make an HTTPS request — Go, Java, PHP, C#, Ruby, Rust.",
        minutes: 7,
        icon: Globe2,
        keywords: ["curl", "http", "go", "java", "php", "c#", "ruby", "rust", "endpoint"],
      },
      {
        href: "/docs/api-contract",
        label: "API reference",
        summary: "Every endpoint, request field, response shape, error code, and webhook event.",
        minutes: 10,
        icon: Braces,
        keywords: ["contract", "schema", "reference", "errors", "status codes", "webhooks"],
      },
      {
        href: "/docs/cli",
        label: "CLI",
        summary: "Detect your framework and scaffold the integration from the terminal.",
        minutes: 3,
        icon: Terminal,
        keywords: ["command line", "npx", "scaffold", "init"],
      },
    ],
  },
  {
    id: "frameworks",
    label: "Frameworks",
    caption: "Drop-in patterns for your stack",
    icon: Boxes,
    pages: [
      {
        href: "/docs/nextjs",
        label: "Next.js",
        summary: "App Router route handlers, server actions, and streaming chat endpoints.",
        minutes: 5,
        keywords: ["app router", "route handler", "server action", "vercel", "react"],
      },
      {
        href: "/docs/express",
        label: "Express.js",
        summary: "Input and output guard middleware for existing Express chat routes.",
        minutes: 4,
        keywords: ["node", "middleware", "connect"],
      },
      {
        href: "/docs/fastapi",
        label: "FastAPI",
        summary: "Async Python routes with Pydantic request and response models.",
        minutes: 5,
        keywords: ["python", "async", "pydantic", "uvicorn", "starlette"],
      },
      {
        href: "/docs/rag",
        label: "RAG, LangChain & LlamaIndex",
        summary: "Inspect retrieved context and citations before they reach the model.",
        minutes: 8,
        icon: Database,
        keywords: ["retrieval", "vector", "embeddings", "langchain", "llamaindex", "grounding"],
      },
      {
        href: "/docs/generic-chatbot",
        label: "Any chatbot or agent",
        summary: "The universal pattern for when no framework-specific guide applies.",
        minutes: 5,
        icon: Bot,
        keywords: ["universal", "custom", "agent", "tool calling", "fallback"],
      },
    ],
  },

  {
    id: "platforms",
    label: "Platforms",
    caption: "No-code and hosted tools",
    icon: MessageSquare,
    pages: [
      {
        href: "/docs/wordpress",
        label: "WordPress",
        summary: "Plugin settings, shortcodes, and a local REST proxy that keeps the key server-side.",
        minutes: 7,
        keywords: ["php", "plugin", "shortcode", "wp"],
      },
      {
        href: "/docs/whatsapp",
        label: "WhatsApp",
        summary: "India-specific PII redaction for WhatsApp Business chat flows.",
        minutes: 6,
        keywords: ["twilio", "meta", "business api", "india", "aadhaar"],
      },
      {
        href: "/docs/intercom",
        label: "Intercom",
        summary: "Guard AI support replies and redact customer PII before it is stored.",
        minutes: 5,
        keywords: ["support", "helpdesk", "canvas kit"],
      },
      {
        href: "/docs/zendesk",
        label: "Zendesk",
        summary: "Protect ticket messages and AI-drafted agent responses.",
        minutes: 5,
        keywords: ["support", "helpdesk", "tickets"],
      },
      {
        href: "/docs/botpress",
        label: "Botpress",
        summary: "Pre- and post-processing HTTP steps inside a Botpress workflow.",
        minutes: 4,
        keywords: ["no-code", "flow", "hooks"],
      },
    ],
  },
  {
    id: "operate",
    label: "Operate securely",
    caption: "Run it properly in production",
    icon: ShieldCheck,
    pages: [
      {
        href: "/docs/best-practices",
        label: "Security best practices",
        summary: "Key handling, fail-closed defaults, webhook verification, and OWASP LLM alignment.",
        minutes: 9,
        icon: ShieldCheck,
        keywords: ["owasp", "hardening", "key rotation", "fail closed", "production", "checklist"],
      },
    ],
  },
];

/** Flat list in sidebar order. Used by search and the previous/next pager. */
export const DOCS_PAGES: DocsPage[] = DOCS_SECTIONS.flatMap((section) => section.pages);

/** Look up a page by exact path. */
export function findDocsPage(pathname: string): DocsPage | undefined {
  return DOCS_PAGES.find((page) => page.href === pathname);
}

/** Look up the section a path belongs to. */
export function findDocsSection(pathname: string): DocsSection | undefined {
  return DOCS_SECTIONS.find((section) => section.pages.some((page) => page.href === pathname));
}

/**
 * Previous and next guide in reading order.
 *
 * Every guide previously ended in a dead stop, which is why the hub was the only
 * way to continue reading. A pager turns the set into a path the reader can
 * follow without navigating back up a level.
 */
export function getDocsNeighbours(pathname: string): { previous?: DocsPage; next?: DocsPage } {
  const index = DOCS_PAGES.findIndex((page) => page.href === pathname);
  if (index === -1) return {};

  return {
    previous: index > 0 ? DOCS_PAGES[index - 1] : undefined,
    next: index < DOCS_PAGES.length - 1 ? DOCS_PAGES[index + 1] : undefined,
  };
}

/** Help destinations shown at the foot of the sidebar. */
export const DOCS_HELP_LINKS = [
  { href: "/playground", label: "Try it without signing up", icon: Zap },
  { href: "/support", label: "Contact support", icon: LifeBuoy },
] as const;

