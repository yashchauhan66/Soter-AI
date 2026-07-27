import type { Metadata } from "next";
import Link from "next/link";
import { safeJsonLd } from "@/lib/seo/jsonLd";
import { SITE_URL } from "@/lib/seo/schema";

export const metadata: Metadata = {
  title: "Enterprise AI Security Platform | SoterAI for Business",
  description:
    "Enterprise AI security platform for Indian businesses: Aadhaar/PAN PII compliance, SSO, SCIM, SIEM integration, tenant isolation, self-hosted deployment, and real-time AI guardrails for chatbots, RAG apps, and agents.",
  keywords: ["enterprise ai security", "ai security platform india", "enterprise llm security", "aadhaar compliance ai", "self-hosted ai guardrails", "enterprise ai firewall"],
  alternates: { canonical: "/enterprise" },
  openGraph: {
    title: "Enterprise AI Security Platform | SoterAI",
    description: "Enterprise-grade AI security for Indian businesses: SSO, SCIM, SIEM, Aadhaar PII detection, tenant isolation, and self-hosted guardrails for high-stakes AI applications.",
  },
};

const capabilities = ["Tenant isolation and RBAC", "SSO, SCIM, and audit trails", "RAG and agent security reviews", "Webhooks, SIEM export, and evidence reports"];

const enterpriseJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/enterprise#softwareapplication`,
      name: "SoterAI Enterprise",
      applicationCategory: "SecurityApplication",
      description: "Enterprise AI security platform with SSO, SCIM, SIEM, tenant isolation, self-hosted deployment, and India PII detection for high-stakes AI applications.",
      url: `${SITE_URL}/enterprise`,
      offers: {
        "@type": "Offer",
        price: "Custom",
        priceCurrency: "INR",
      },
      featureList: "SSO, SCIM, SIEM, Tenant Isolation, Self-Hosted, Audit Trails, India PII Detection, Agent Firewall, RAG Security",
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Enterprise", item: `${SITE_URL}/enterprise` },
      ],
    },
  ],
};

export default function EnterpriseMarketingPage() {
  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(enterpriseJsonLd) }} />
      <section className="container-page py-16">
        <p className="eyebrow">Enterprise</p>
        <h1 className="mt-2 text-4xl font-bold">Operational controls for high-stakes AI applications</h1>
        <p className="mt-5 max-w-3xl text-slate-300">Run a scoped SoterAI pilot for chatbots, RAG applications, and agents that need defense-in-depth controls, tenant isolation, and reviewable evidence.</p>
        <div className="mt-8 flex flex-wrap gap-3"><Link className="button-primary" href="/enterprise/pilot">Request pilot</Link><Link className="button-secondary" href="/trust">Review trust center</Link></div>
        <div className="mt-12 grid gap-4 md:grid-cols-2">{capabilities.map((item) => <div className="border-b border-slate-800 py-4 font-medium" key={item}>{item}</div>)}</div>
      </section>
      <section className="border-y border-slate-800 py-12">
        <div className="container-page"><h2 className="text-2xl font-bold">Honest scope</h2><p className="mt-3 max-w-3xl text-slate-400">SoterAI supports OWASP LLM Top 10 aligned risk reduction. It does not replace secure application design, access controls, human review, model governance, or incident response.</p></div>
      </section>
    </main>
  );
}