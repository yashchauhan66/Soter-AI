import Link from "next/link";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  softwareApplicationLd,
  faqPageLd,
} from "@/lib/seo/metadata";
import { breadcrumbList } from "@/lib/seo/schema";

/** VS Code Marketplace listing for the IDE Guard extension. */
export const VSCODE_MARKETPLACE_URL =
  "https://marketplace.visualstudio.com/items?itemName=soterai.soterai-ide-guard";

export interface FeatureLandingData {
  /** Site-relative path, e.g. "/mcp-security". */
  path: string;
  /** Short kicker above the H1. */
  eyebrow: string;
  /** Page H1. */
  h1: string;
  /** One-paragraph hero subtext. */
  intro: string;
  /** SoftwareApplication schema name. */
  productName: string;
  /** "What it does" bullets. */
  features: Array<{ title: string; body: string }>;
  /** "How it works" ordered steps. */
  how: Array<{ step: string; body: string }>;
  /** Honest limitations — what the feature does NOT do. */
  limitations: string[];
  /** FAQ pairs (also emitted as FAQPage JSON-LD). */
  faqs: Array<{ q: string; a: string }>;
  /** Internal links to related SoterAI features/docs. */
  related: Array<{ label: string; href: string }>;
}

/**
 * Shared server-rendered layout for the AI-security feature landing pages.
 * Each page passes its own content; the component handles consistent structure,
 * internal linking, the VS Code install CTA, and page-scoped structured data
 * (Breadcrumb + SoftwareApplication + FAQPage).
 */
export function FeatureLanding({ data }: { data: FeatureLandingData }) {
  const breadcrumb = breadcrumbList([
    { name: "Home", path: "/" },
    { name: data.h1, path: data.path },
  ]);
  const appLd = softwareApplicationLd({
    name: data.productName,
    description: data.intro,
    path: data.path,
  });
  const faqLd = faqPageLd(data.faqs);

  return (
    <main className="container-page py-16">
      <JsonLd data={breadcrumb} />
      <JsonLd data={appLd} />
      <JsonLd data={faqLd} />

      {/* Hero */}
      <section className="max-w-3xl">
        <p className="eyebrow">{data.eyebrow}</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          {data.h1}
        </h1>
        <p className="mt-5 text-lg leading-8 text-slate-400">{data.intro}</p>
        <div className="mt-8 flex flex-wrap gap-4">
          <a
            href={VSCODE_MARKETPLACE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-cyan px-5 py-3 text-sm font-semibold text-ink transition hover:opacity-90"
          >
            Install the VS Code extension <ArrowRight className="h-4 w-4" />
          </a>
          <Link
            href="/docs/quickstart"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700/60 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500"
          >
            Read the docs
          </Link>
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Runs locally in your editor. Secret, PII, prompt-injection, and MCP
          scanning happen on your machine before anything reaches an AI model.
        </p>
      </section>

      {/* Features */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold">What it does</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {data.features.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-slate-800 bg-panel/40 p-5"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-cyan" />
                <h3 className="font-semibold text-slate-100">{f.title}</h3>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-400">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold">How it works</h2>
        <ol className="mt-6 space-y-4">
          {data.how.map((s, i) => (
            <li key={s.step} className="flex gap-4">
              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-cyan/10 text-sm font-bold text-cyan">
                {i + 1}
              </span>
              <div>
                <p className="font-semibold text-slate-100">{s.step}</p>
                <p className="mt-1 text-sm leading-6 text-slate-400">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Honest limitations */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold">Honest limitations</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          No security tool is perfect. Here is what this feature does not claim
          to do, so you can layer defenses appropriately.
        </p>
        <ul className="mt-5 space-y-3">
          {data.limitations.map((l) => (
            <li key={l} className="flex gap-3 text-sm leading-6 text-slate-400">
              <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-amber-500" />
              {l}
            </li>
          ))}
        </ul>
      </section>

      {/* FAQ */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold">Frequently asked questions</h2>
        <div className="mt-6 space-y-6">
          {data.faqs.map((f) => (
            <div key={f.q}>
              <h3 className="font-semibold text-slate-100">{f.q}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Related internal links */}
      <section className="mt-16 border-t border-slate-800 pt-8">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">
          Related
        </h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {data.related.map((r) => (
            <Link
              key={r.href}
              href={r.href}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-700/60 px-4 py-2 text-sm text-slate-300 transition hover:border-cyan/50 hover:text-cyan"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> {r.label}
            </Link>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mt-16 rounded-2xl border border-cyan/20 bg-cyan/5 p-8 text-center">
        <h2 className="text-2xl font-bold">Protect your AI coding context</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400">
          Install SoterAI IDE Guard and scan secrets, prompts, MCP tools, and
          terminal commands locally before they ever reach an AI model.
        </p>
        <a
          href={VSCODE_MARKETPLACE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-cyan px-6 py-3 text-sm font-semibold text-ink transition hover:opacity-90"
        >
          Install for VS Code <ArrowRight className="h-4 w-4" />
        </a>
      </section>
    </main>
  );
}
