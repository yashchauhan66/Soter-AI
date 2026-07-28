import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { buildMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbList } from "@/lib/seo/schema";

export const metadata: Metadata = buildMetadata({
  title: "Integrations — Connect SoterAI to n8n, Zapier, Make and More",
  description:
    "Connect SoterAI Guard to your AI workflows: n8n, Zapier, Make.com, LangChain, Vercel AI SDK, Express, FastAPI and more. Add real-time prompt injection and data leakage protection to any AI automation.",
  path: "/integrations",
  keywords: [
    "soterai integrations",
    "ai security integrations",
    "n8n ai security",
    "zapier ai security",
    "make.com ai security",
    "langchain security",
    "ai workflow security integrations",
  ],
});

const integrations = [
  {
    name: "n8n",
    description: "Add SoterAI prompt injection and PII scanning to any n8n AI workflow node via the HTTP Request module.",
    href: "/integrations/n8n",
    category: "Workflow Automation",
    badge: "Guide available",
  },
  {
    name: "Zapier",
    description: "Protect Zapier AI actions with SoterAI's input and output guard before and after each automated AI step.",
    href: "/integrations/zapier",
    category: "Workflow Automation",
    badge: "Guide available",
  },
  {
    name: "Make.com",
    description: "Integrate SoterAI into Make scenarios via the HTTP module to scan AI inputs and outputs in real time.",
    href: "/integrations/make",
    category: "Workflow Automation",
    badge: "Guide available",
  },
  {
    name: "LangChain",
    description: "Wrap any LangChain chain with SoterAI's input and output guard middleware using the JavaScript or Python SDK.",
    href: "/docs/js",
    category: "AI Framework",
    badge: "SDK",
  },
  {
    name: "Vercel AI SDK",
    description: "Use the SoterAI middleware helper to guard streaming AI responses in Next.js and Edge runtime.",
    href: "/docs/nextjs",
    category: "AI Framework",
    badge: "SDK",
  },
  {
    name: "FastAPI",
    description: "Add SoterAI as a Python middleware to protect FastAPI-based LLM applications.",
    href: "/docs/fastapi",
    category: "Backend Framework",
    badge: "SDK",
  },
  {
    name: "Express",
    description: "Mount the SoterAI Express middleware to guard all AI routes in your Node.js application.",
    href: "/docs/express",
    category: "Backend Framework",
    badge: "SDK",
  },
  {
    name: "WordPress",
    description: "Install the SoterAI WordPress plugin to protect AI-powered content and chatbots on WordPress sites.",
    href: "/docs/wordpress",
    category: "CMS",
    badge: "Plugin",
  },
  {
    name: "REST API",
    description: "Use SoterAI's REST API to integrate with any platform, language, or automation tool.",
    href: "/docs/rest-api",
    category: "Universal",
    badge: "API",
  },
];

export default function Page() {
  const breadcrumb = breadcrumbList([
    { name: "Home", path: "/" },
    { name: "Integrations", path: "/integrations" },
  ]);

  return (
    <main className="container-page py-16">
      <JsonLd data={breadcrumb} />

      <div className="max-w-3xl">
        <p className="eyebrow">Integrations</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          Connect SoterAI to your AI stack
        </h1>
        <p className="mt-5 text-lg leading-8 text-slate-400">
          Add runtime prompt injection detection, PII redaction, and AI data leakage prevention
          to any workflow — whether you build with n8n, Zapier, Make, LangChain, or a custom API.
        </p>
        <div className="mt-8 flex gap-4">
          <Link href="/docs/quickstart" className="button-primary gap-2">
            Quickstart guide <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link href="/docs/rest-api" className="button-secondary">
            REST API reference
          </Link>
        </div>
      </div>

      <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {integrations.map((integration) => (
          <Link
            key={integration.name}
            href={integration.href}
            className="group rounded-xl border border-slate-800 bg-panel/40 p-6 transition hover:border-cyan/40"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold group-hover:text-cyan">{integration.name}</h2>
              <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-400">
                {integration.badge}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{integration.category}</p>
            <p className="mt-3 text-sm leading-6 text-slate-400">{integration.description}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-cyan">
              View integration <ArrowRight size={14} aria-hidden="true" />
            </span>
          </Link>
        ))}
      </div>

      <section className="mt-20 rounded-2xl border border-cyan/20 bg-cyan/5 p-8 text-center">
        <h2 className="text-2xl font-bold">Don&apos;t see your platform?</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400">
          SoterAI works with any platform via the REST API. If your use case is not covered,
          contact us and we will help you integrate.
        </p>
        <Link href="/contact" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-cyan px-5 py-3 text-sm font-semibold text-ink">
          Request an integration <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </section>
    </main>
  );
}
