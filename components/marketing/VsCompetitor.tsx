import Link from "next/link";
import { PLAYGROUND_CTA_LABEL } from "@/lib/marketing/cta";
import type { ReactNode } from "react";
import { DataTable, SaLinkButton } from "@/components/sa/primitives";
import { SaRoot } from "@/components/sa/SaRoot";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbList } from "@/lib/seo/schema";

/**
 * One-to-one comparison, as a fact sheet.
 *
 * The earlier template drew a yes/no matrix for the other product and a "Where SoterAI
 * wins" list. Those cells were unsourced, some were wrong (one page named the wrong
 * acquirer for Protect AI), and a tick or a cross cannot carry a date. This template keeps
 * only what can be sourced:
 *   - facts about the other product, each with the link and the date it was read;
 *   - facts about soterai.in, from our own limits page;
 *   - plain guidance on when each is the better choice, framed as guidance, not as a test.
 * There is no score and no matrix. No head-to-head test exists.
 */
export interface VsContent {
  slug: string;
  competitor: string;
  /** What kind of product it is, in a few words. */
  kind: string;
  /** Date the sources were read, YYYY-MM-DD. */
  readOn: string;
  /** One or two sentences from the product's own description, paraphrased. */
  summary: string;
  /** Facts about the other product. Each should be traceable to a listed source. */
  facts: Array<{ label: string; value: ReactNode }>;
  /** Choose the other product when... */
  chooseThem: string[];
  /** Choose soterai.in when... */
  chooseUs: string[];
  sources: Array<{ label: string; href: string }>;
}

/** Facts about soterai.in that are true on every one-to-one page. */
const OURS: Array<{ label: string; value: ReactNode }> = [
  { label: "What it is", value: "An AI security command layer: it checks prompts and replies, redacts secrets and personal data, flags prompt injection, and holds risky agent actions for approval." },
  { label: "Terms", value: "Proprietary server. A Free plan that works anywhere. Paid plans are priced in Indian rupees and international billing is not available yet." },
  { label: "Hosting", value: "Hosted by SoterAI, or self-hosted with Docker, Postgres and Redis." },
  { label: "Evidence", value: <>Self-written tests and no outside audit. Blind held-out recall is 16 of 26. <Link className="sa-link" href="/benchmarks">Numbers and limits</Link>.</> },
  { label: "Known gaps", value: <>Listed with dates on the <Link className="sa-link" href="/limitations">limits page</Link>.</> },
  { label: "Maturity", value: "API and SDKs are Stable. Extensions and workflow guards are Beta. The MCP and agent guard is Labs." },
  { label: "Customers and certifications", value: "No named customers. No SOC 2, ISO 27001 or HIPAA certification." },
];

export function VsCompetitor({ data }: { data: VsContent }) {
  const breadcrumb = breadcrumbList([
    { name: "Home", path: "/" },
    { name: "Compare", path: "/comparison" },
    { name: `SoterAI and ${data.competitor}`, path: `/comparison/${data.slug}` },
  ]);

  return (
    <SaRoot>
      <JsonLd data={breadcrumb} />
      <main className="sa-page" style={{ paddingBlock: "var(--sa-space-7) var(--sa-space-9)" }}>
        <header>
          <p className="sa-eyebrow">Compare</p>
          <h1 className="sa-h1" style={{ marginTop: "var(--sa-space-3)" }}>
            SoterAI and {data.competitor}.
          </h1>
          <p className="sa-lede" style={{ marginTop: "var(--sa-space-4)" }}>
            {data.summary}
          </p>
          <p className="sa-body sa-muted" style={{ marginTop: "var(--sa-space-4)" }}>
            Facts about {data.competitor} come from the sources below, read on {data.readOn}. SoterAI wrote this page, so check them.
            There is no score, because no head-to-head test has been run.
          </p>
        </header>

        <section className="sa-section" aria-labelledby="facts">
          <div className="sa-section__head">
            <h2 className="sa-h2" id="facts">
              The facts
            </h2>
          </div>
          <div className="sa-cols sa-cols--2">
            <div>
              <h3 className="sa-h3">{data.competitor}</h3>
              <p className="sa-muted" style={{ margin: "var(--sa-space-1) 0 var(--sa-space-3)" }}>{data.kind}</p>
              <dl className="sa-facts">
                {data.facts.map((f) => (
                  <div key={f.label}>
                    <dt>{f.label}</dt>
                    <dd>{f.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div>
              <h3 className="sa-h3">SoterAI</h3>
              <p className="sa-muted" style={{ margin: "var(--sa-space-1) 0 var(--sa-space-3)" }}>Command layer</p>
              <dl className="sa-facts">
                {OURS.map((f) => (
                  <div key={f.label}>
                    <dt>{f.label}</dt>
                    <dd>{f.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        <section className="sa-section" aria-labelledby="choose">
          <div className="sa-section__head">
            <h2 className="sa-h2" id="choose">
              Which to choose
            </h2>
          </div>
          <div className="sa-cols sa-cols--2">
            <div>
              <h3 className="sa-h3">Choose {data.competitor} when</h3>
              <ul className="sa-list">
                {data.chooseThem.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="sa-h3">Choose SoterAI when</h3>
              <ul className="sa-list">
                {data.chooseUs.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="sa-section" aria-labelledby="sources">
          <div className="sa-section__head">
            <h2 className="sa-h2" id="sources">
              Sources
            </h2>
            <p className="sa-body sa-muted">Read on {data.readOn}. Products change, so check the source before you rely on a fact.</p>
          </div>
          <DataTable
            caption={`Sources for the facts about ${data.competitor}`}
            columns={[
              { key: "label", header: "Source" },
              { key: "href", header: "Link" },
            ]}
            rows={data.sources.map((s) => ({
              label: s.label,
              href: (
                <a className="sa-link" href={s.href} rel="noopener noreferrer">
                  {s.href}
                </a>
              ),
            }))}
          />
        </section>

        <section className="sa-closing" aria-labelledby="closing">
          <h2 className="sa-h2" id="closing">
            Test both on your own text.
          </h2>
          <p className="sa-body" style={{ marginTop: "var(--sa-space-3)" }}>
            Run the same ten inputs through each option and record what comes back. Use sample data, not real secrets.
          </p>
          <div className="sa-hero__actions">
            <SaLinkButton href="/playground" large>
              {PLAYGROUND_CTA_LABEL}
            </SaLinkButton>
            <SaLinkButton href="/comparison" variant="ghost">
              All options compared
            </SaLinkButton>
          </div>
        </section>
      </main>
    </SaRoot>
  );
}
