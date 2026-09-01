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

/** Pages that are IDE / editor focused — show the VS Code install CTA. */
const IDE_PAGES = new Set([
  "/vscode-ai-security",
  "/cursor-ai-security",
  "/windsurf-ai-security",
  "/mcp-security",
  "/prompt-injection-protection",
  "/ai-data-leakage-prevention",
  "/local-ai-broker",
  "/ai-safe-mode",
  "/ai-memory-inspector",
]);

/** Determine the primary CTA for a feature page based on its path. */
function primaryCta(path: string): { label: string; href: string; external: boolean } {
  if (path === "/ai-user-security") {
    return { label: "Explore Browser Guard", href: "/extensions/browser", external: false };
  }
  if (IDE_PAGES.has(path)) {
    return { label: "Install the VS Code extension", href: VSCODE_MARKETPLACE_URL, external: true };
  }
  // API / platform pages — drive to signup
  return { label: "Start for free", href: "/signup", external: false };
}

/** Determine the secondary CTA based on page path. */
function secondaryCta(path: string): { label: string; href: string } {
  if (path === "/ai-user-security") {
    return { label: "Book a security demo", href: "/contact-sales" };
  }
  if (IDE_PAGES.has(path)) {
    return { label: "Read the docs", href: "/docs/quickstart" };
  }
  if (path.includes("enterprise")) {
    return { label: "Talk to sales", href: "/contact-sales" };
  }
  return { label: "Read the docs", href: "/docs/quickstart" };
}

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
  const cta = primaryCta(data.path);
  const secondary = secondaryCta(data.path);

  return (
    <main className="container-page py-16">
      <JsonLd data={breadcrumb} />
      <JsonLd data={appLd} />
      <JsonLd data={faqLd} />

      {/* Hero */}
      <section className="max-w-3xl">
        <p className="eyebrow">{data.eyebrow}</p>
        <h1 className="heading-1 mt-3">{data.h1}</h1>
        <p className="lede mt-5">{data.intro}</p>
        {/* Primary + secondary only. These used hand-rolled `bg-cyan px-5 py-3`
            buttons, so their height, focus ring, and hover behaviour differed
            from every other CTA on the site. */}
        <div className="mt-8 flex flex-wrap gap-3">
          {cta.external ? (
            <a href={cta.href} target="_blank" rel="noopener noreferrer" className="button-primary">
              {cta.label} <ArrowRight size={16} aria-hidden="true" />
            </a>
          ) : (
            <Link href={cta.href} className="button-primary">
              {cta.label} <ArrowRight size={16} aria-hidden="true" />
            </Link>
          )}
          <Link href={secondary.href} className="button-secondary">
            {secondary.label}
          </Link>
        </div>
        {IDE_PAGES.has(data.path) && (
          <p className="mt-4 text-xs leading-5 text-slate-400">
            Runs locally in your editor. Secret, PII, prompt-injection, and MCP scanning happen on your machine before
            anything reaches an AI model.
          </p>
        )}
      </section>

      {/* Features */}
      <section className="mt-16">
        <h2 className="heading-3">What it does</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {data.features.map((f) => (
            <div key={f.title} className="card p-5">
              <div className="flex items-center gap-2">
                <ShieldCheck size={20} className="shrink-0 text-cyan" aria-hidden="true" />
                <h3 className="font-semibold text-slate-100">{f.title}</h3>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-300">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mt-16">
        <h2 className="heading-3">How it works</h2>
        <ol className="mt-6 space-y-4">
          {data.how.map((s, i) => (
            <li key={s.step} className="flex gap-4">
              <span
                data-numeric
                className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-cyan/10 text-sm font-bold text-cyan"
              >
                {i + 1}
              </span>
              <div>
                <p className="font-semibold text-slate-100">{s.step}</p>
                <p className="mt-1 text-sm leading-6 text-slate-300">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Honest limitations. Kept above the FAQ on purpose: a reviewer who
          scrolls should hit the caveats before the closing CTA, not after. */}
      <section className="mt-16">
        <h2 className="heading-3">Honest limitations</h2>
        <p className="mt-2 max-w-prose text-sm text-slate-400">
          No security tool is perfect. Here is what this feature does not claim to do, so you can layer defenses
          appropriately.
        </p>
        <ul className="mt-5 space-y-3">
          {data.limitations.map((l) => (
            <li key={l} className="flex gap-3 text-sm leading-6 text-slate-200">
              <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-amber-500" />
              {l}
            </li>
          ))}
        </ul>
      </section>

      {/* FAQ */}
      <section className="mt-16">
        <h2 className="heading-3">Frequently asked questions</h2>
        <div className="mt-6 space-y-6">
          {data.faqs.map((f) => (
            <div key={f.q}>
              <h3 className="font-semibold text-slate-100">{f.q}</h3>
              <p className="mt-2 max-w-prose text-sm leading-6 text-slate-300">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Related internal links */}
      <section className="mt-16 border-t border-slate-800 pt-8">
        <h2 className="text-sm font-bold uppercase tracking-micro text-slate-200">Related</h2>
        <nav aria-label="Related pages" className="mt-4 flex flex-wrap gap-2">
          {data.related.map((r) => (
            <Link
              key={r.href}
              href={r.href}
              className="badge-neutral transition-colors hover:border-cyan/50 hover:text-cyan"
            >
              <CheckCircle2 size={13} aria-hidden="true" /> {r.label}
            </Link>
          ))}
        </nav>
      </section>

      {/* Final CTA */}
      <section className="mt-16 rounded-panel border border-cyan/20 bg-cyan/[0.06] p-8 text-center">
        {IDE_PAGES.has(data.path) ? (
          <>
            <h2 className="heading-3">Protect your AI coding context</h2>
            <p className="mx-auto mt-3 max-w-measure text-sm leading-6 text-slate-300">
              Install SoterAI IDE Guard and scan secrets, prompts, MCP tools, and terminal commands locally before they
              ever reach an AI model.
            </p>
            <a
              href={VSCODE_MARKETPLACE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="button-primary mt-6"
            >
              Install for VS Code <ArrowRight size={16} aria-hidden="true" />
            </a>
          </>
        ) : (
          <>
            <h2 className="heading-3">Add security to your AI application</h2>
            <p className="mx-auto mt-3 max-w-measure text-sm leading-6 text-slate-300">
              Free tier available. Integrate with a single SDK call and protect your first AI workflow in under ten
              minutes.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/signup" className="button-primary">
                Start for free <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/playground" className="button-secondary">
                Try the playground
              </Link>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

