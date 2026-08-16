import Link from "next/link";
import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildMetadata, faqPageLd } from "@/lib/seo/metadata";
import { breadcrumbList } from "@/lib/seo/schema";

export const metadata: Metadata = buildMetadata({
  title: "Limitations — What SoterAI Does and Does Not Claim",
  description:
    "An honest account of what SoterAI IDE Guard can and cannot do: heuristic detection, coverage boundaries, and why we make no claims of 100% security.",
  path: "/limitations",
});

const faqs = [
  {
    q: "Is SoterAI completely secure?",
    a: "No. No security product is. SoterAI reduces the risk of leaking secrets, PII, and sensitive context to AI tools and helps you review exposure, but it cannot guarantee that every sensitive value or every attack is caught.",
  },
  {
    q: "Do you claim to be the fastest AI security tool?",
    a: "No. We publish reproducible benchmarks for our own components and let you run them yourself. We do not make comparative “fastest” claims.",
  },
  {
    q: "What is the single most important thing to understand?",
    a: "Detection is heuristic. SoterAI raises the cost and lowers the probability of accidental leakage and prompt injection; it is one layer in a defense-in-depth strategy, not a substitute for least privilege, code review, and isolation.",
  },
];

const boundaries: Array<{ title: string; body: string }> = [
  {
    title: "Detection is heuristic and signature-based",
    body: "Secret, PII, and prompt-injection detection rely on patterns and signatures. They catch common and known cases well, but novel formats or heavily obfuscated payloads can evade them. Treat a clean scan as “no known issues found,” not “provably safe.”",
  },
  {
    title: "Coverage is limited to routed context",
    body: "The extension inspects context you route through its commands and its optional Local AI Broker. It cannot see or control traffic sent by other tools or extensions that bypass it entirely.",
  },
  {
    title: "Redaction is best-effort",
    body: "Redacted output is safer than raw content, but should still be reviewed before sharing externally. We provide a canary workflow so you can verify redaction end-to-end for your own setup.",
  },
  {
    title: "We govern egress, not the provider",
    body: "SoterAI reduces what sensitive data leaves your editor and records what was shared. It does not control how an AI provider handles content you deliberately send, and provider terms still apply.",
  },
  {
    title: "Visibility is not prevention",
    body: "The AI Memory Inspector and Access Ledger record what context was shared through the extension. They are audit tools; pair them with Safe Mode and redaction for preventive control.",
  },
  {
    title: "Benchmarks are ours and reproducible",
    body: "Performance numbers we publish come from benchmark scripts you can run yourself on your own hardware. Results vary by machine, and we do not present them as competitor comparisons.",
  },
];

export default function LimitationsPage() {
  const breadcrumb = breadcrumbList([
    { name: "Home", path: "/" },
    { name: "Limitations", path: "/limitations" },
  ]);

  return (
    <main className="container-page py-16">
      <JsonLd data={breadcrumb} />
      <JsonLd data={faqPageLd(faqs)} />

      <section className="max-w-3xl">
        <p className="eyebrow">Trust &amp; honesty</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          What SoterAI does and does not claim
        </h1>
        <p className="mt-5 text-lg leading-8 text-slate-200">
          Security marketing tends toward absolutes. We would rather you trust us
          because we are precise about our boundaries. Here is an honest account
          of what SoterAI IDE Guard can do, what it cannot, and how to use it as
          one layer in a defense-in-depth approach.
        </p>
      </section>

      <section className="mt-14 grid gap-5 sm:grid-cols-2">
        {boundaries.map((b) => (
          <div
            key={b.title}
            className="rounded-xl border border-slate-800 bg-panel/40 p-5"
          >
            <h2 className="text-base font-semibold text-slate-100">{b.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-200">{b.body}</p>
          </div>
        ))}
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-bold">FAQ</h2>
        <div className="mt-6 space-y-6">
          {faqs.map((f) => (
            <div key={f.q}>
              <h3 className="font-semibold text-slate-100">{f.q}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-200">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16 border-t border-slate-800 pt-8">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-200">
          Explore the features honestly
        </h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {[
            { label: "VS Code AI Security", href: "/vscode-ai-security" },
            { label: "Prompt Injection Protection", href: "/prompt-injection-protection" },
            { label: "MCP Security", href: "/mcp-security" },
            { label: "AI Data Leakage Prevention", href: "/ai-data-leakage-prevention" },
            { label: "Local AI Broker", href: "/local-ai-broker" },
          ].map((r) => (
            <Link
              key={r.href}
              href={r.href}
              className="inline-flex items-center rounded-full border border-slate-700/60 px-4 py-2 text-sm text-slate-300 transition hover:border-cyan/50 hover:text-cyan"
            >
              {r.label}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
