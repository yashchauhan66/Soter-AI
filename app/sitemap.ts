import type { MetadataRoute } from "next";

const siteUrl = "https://soterai.publicvm.com";

const marketingPages = [
  { url: "/", priority: 1.0, changeFrequency: "weekly" as const },
  { url: "/benchmarks", priority: 0.9, changeFrequency: "weekly" as const },
  { url: "/comparison", priority: 0.9, changeFrequency: "weekly" as const },
  { url: "/pricing", priority: 0.8, changeFrequency: "weekly" as const },
  { url: "/playground", priority: 0.7, changeFrequency: "monthly" as const },
  { url: "/case-studies", priority: 0.7, changeFrequency: "monthly" as const },
  { url: "/changelog", priority: 0.6, changeFrequency: "weekly" as const },
  { url: "/enterprise", priority: 0.8, changeFrequency: "monthly" as const },
  { url: "/enterprise/pilot", priority: 0.7, changeFrequency: "monthly" as const },
  { url: "/contact", priority: 0.5, changeFrequency: "monthly" as const },
  { url: "/contact-sales", priority: 0.6, changeFrequency: "monthly" as const },
  { url: "/demo", priority: 0.7, changeFrequency: "monthly" as const },
  { url: "/demo-chatbot", priority: 0.6, changeFrequency: "monthly" as const },
  { url: "/demo/rag", priority: 0.5, changeFrequency: "monthly" as const },
  { url: "/demo/red-team", priority: 0.5, changeFrequency: "monthly" as const },
  { url: "/partners/agency", priority: 0.6, changeFrequency: "monthly" as const },

];

const compliancePages = [
  { url: "/compliance/owasp-llm-top-10", priority: 0.7, changeFrequency: "monthly" as const },
  { url: "/compliance/iso27001-readiness", priority: 0.6, changeFrequency: "monthly" as const },
  { url: "/compliance/soc2-readiness", priority: 0.6, changeFrequency: "monthly" as const },
];

const legalPages = [
  { url: "/trust", priority: 0.6, changeFrequency: "monthly" as const },
  { url: "/security", priority: 0.6, changeFrequency: "monthly" as const },
  { url: "/responsible-disclosure", priority: 0.4, changeFrequency: "yearly" as const },
  { url: "/privacy", priority: 0.5, changeFrequency: "yearly" as const },
  { url: "/terms", priority: 0.5, changeFrequency: "yearly" as const },
  { url: "/data-retention", priority: 0.4, changeFrequency: "yearly" as const },
  { url: "/subprocessors", priority: 0.4, changeFrequency: "yearly" as const },
  { url: "/status", priority: 0.5, changeFrequency: "daily" as const },
];

const docsPages = [
  { url: "/docs", priority: 0.9, changeFrequency: "weekly" as const },
  { url: "/docs/quickstart", priority: 0.8, changeFrequency: "weekly" as const },
  { url: "/docs/js", priority: 0.7, changeFrequency: "monthly" as const },
  { url: "/docs/python", priority: 0.7, changeFrequency: "monthly" as const },
  { url: "/docs/nextjs", priority: 0.7, changeFrequency: "monthly" as const },
  { url: "/docs/rest-api", priority: 0.7, changeFrequency: "monthly" as const },
  { url: "/docs/rag", priority: 0.7, changeFrequency: "monthly" as const },
  { url: "/docs/fastapi", priority: 0.6, changeFrequency: "monthly" as const },
  { url: "/docs/express", priority: 0.6, changeFrequency: "monthly" as const },
  { url: "/docs/generic-chatbot", priority: 0.6, changeFrequency: "monthly" as const },
  { url: "/docs/botpress", priority: 0.5, changeFrequency: "monthly" as const },
  { url: "/docs/intercom", priority: 0.5, changeFrequency: "monthly" as const },
  { url: "/docs/zendesk", priority: 0.5, changeFrequency: "monthly" as const },
  { url: "/docs/whatsapp", priority: 0.5, changeFrequency: "monthly" as const },
  { url: "/docs/wordpress", priority: 0.5, changeFrequency: "monthly" as const },
  { url: "/docs/cli", priority: 0.4, changeFrequency: "monthly" as const },
  { url: "/docs/best-practices", priority: 0.6, changeFrequency: "monthly" as const },
  { url: "/docs/api-contract", priority: 0.6, changeFrequency: "monthly" as const },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const allPages = [
    ...marketingPages,
    ...compliancePages,
    ...legalPages,
    ...docsPages,
  ];

  return allPages.map((page) => ({
    url: `${siteUrl}${page.url}`,
    lastModified: new Date(),
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
