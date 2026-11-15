import type { Metadata } from 'next';
import Link from 'next/link';
import { PLAYGROUND_CTA_LABEL } from '@/lib/marketing/cta';
import { Faq, faqJsonLd, type FaqItem } from '@/components/sa/Faq';
import { Callout, DataTable, SaLinkButton } from '@/components/sa/primitives';
import { SaRoot } from '@/components/sa/SaRoot';
import { safeJsonLd } from '@/lib/seo/jsonLd';
import { buildMetadata } from '@/lib/seo/metadata';
import { breadcrumbList } from '@/lib/seo/schema';

/**
 * Comparison. Written to be fair and checkable.
 *
 * Rules for this page:
 *  - Every fact about another product comes from that product's own documentation or a
 *    primary announcement, with the link and the date it was read. No scores and no
 *    "winner", because no head-to-head test exists.
 *  - Nothing is copied from another vendor's marketing text.
 *  - The page says where the others are better, before it says where soterai.in differs.
 *  - Vendor claims are attributed to the vendor. Nobody's latency or accuracy figure is
 *    repeated as if we had measured it.
 *
 * The old page ranked 15 vendors with "winner" tags, a "highest independent F1" claim with
 * no source, GitHub star counts that did not match GitHub, and a purchase price for the
 * Lakera deal that no source on the page supported. All of that is gone.
 *
 * Title: 49 characters with the brand suffix. Description: 152.
 */
export const metadata: Metadata = buildMetadata({
  title: 'LLM Guardrail and Firewall Options Compared',
  description:
    'Open-source libraries, cloud guardrails, vendor platforms and SoterAI side by side. Facts come from each product’s own docs, with links and dates.',
  path: '/comparison',
});

const READ = '2026-11-10';
const REPO_READ = '2026-11-09';

function src(href: string, label: string) {
  return (
    <a className="sa-link" href={href} rel="noopener noreferrer">
      {label}
    </a>
  );
}

const OPTIONS: Array<{ name: React.ReactNode; kind: string; docs: React.ReactNode; terms: React.ReactNode; source: React.ReactNode }> = [
  {
    name: 'Guardrails AI',
    kind: 'Open-source Python framework',
    docs: 'Runs input and output guards that detect and reduce specific risks, and generates structured data from models. Its README announces that hosted remote inferencing is being discontinued, with a planned cutoff of 2026-08-25.',
    terms: `Apache-2.0. Not archived (${REPO_READ}). You run it yourself.`,
    source: src('https://github.com/guardrails-ai/guardrails', 'README and repository'),
  },
  {
    name: 'NVIDIA NeMo Guardrails',
    kind: 'Open-source toolkit',
    docs: 'Adds programmable guardrails between application code and the model for conversational apps: steering topics, dialog paths, response style and tool use.',
    terms: `Apache-2.0 per the LICENSE.md header; GitHub’s license field shows “Other” (${REPO_READ}). Not archived. You run it yourself.`,
    source: src('https://github.com/NVIDIA-NeMo/Guardrails', 'README and repository'),
  },
  {
    name: 'LLM Guard (Protect AI)',
    kind: 'Open-source scanner library',
    docs: 'Scanners for sanitizing prompts and replies, detecting harmful language, preventing data leakage and resisting prompt injection.',
    terms: `MIT. The repository is archived: its README says it is no longer under active development or maintained (${REPO_READ}).`,
    source: src('https://github.com/protectai/llm-guard', 'README and repository'),
  },
  {
    name: 'Amazon Bedrock Guardrails',
    kind: 'Cloud guardrails, AWS',
    docs: 'Content filters (including prompt attacks), denied topics, word filters, sensitive-information filters, contextual grounding checks and automated reasoning checks. An ApplyGuardrail API can check text without invoking a model.',
    terms: 'Hosted by AWS, billed through AWS.',
    source: src('https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails.html', `AWS docs, read ${READ}`),
  },
  {
    name: 'Azure Prompt Shields',
    kind: 'Cloud API, Microsoft Azure',
    docs: 'Detects user prompt attacks and document attacks in text. The API returns a result and does not itself block or route content. The docs say it does not judge harm, accuracy, grounding or policy compliance.',
    terms: 'Part of Azure AI Content Safety, billed through Azure.',
    source: src('https://learn.microsoft.com/en-us/azure/ai-services/content-safety/concepts/jailbreak-detection', `Microsoft Learn, read ${READ}`),
  },
  {
    name: 'Google Model Armor',
    kind: 'Cloud service, Google Cloud',
    docs: 'Screens prompts and replies for malicious input, sensitive data and harmful content using templates with confidence thresholds. Google says it can be used with AI on other clouds.',
    terms: 'Part of Google Cloud, billed through Google Cloud.',
    source: src('https://docs.cloud.google.com/security-command-center/docs/model-armor-overview', `Google Cloud docs, read ${READ}`),
  },
  {
    name: 'Lakera (Check Point)',
    kind: 'Vendor platform',
    docs: 'Check Point announced the Lakera acquisition on 2025-09-16 and describes runtime protection and red teaming for LLMs, agents and multimodal workflows. Check Point’s Q3 2025 results describe the acquisition as made. The detection and latency figures in the announcement are Check Point’s own claims, not ours.',
    terms: 'Commercial. Pricing not published on the pages read.',
    source: src('https://www.checkpoint.com/press-releases/check-point-acquires-lakera-to-deliver-end-to-end-ai-security-for-enterprises/', `Check Point release, read ${READ}`),
  },
  {
    name: 'SoterAI',
    kind: 'Hosted or self-hosted command layer',
    docs: 'Checks prompts, replies and agent actions; redacts secrets and personal data; flags prompt injection; holds risky agent actions for approval; keeps the record.',
    terms: 'Proprietary server. Free plan; paid plans are priced in Indian rupees. Buyers outside India should confirm payment methods and eligibility with sales. Self-hosting with Docker, Postgres and Redis.',
    source: <Link className="sa-link" href="/limitations">Our own limits page</Link>,
  },
];

const BETTER: Array<{ title: string; body: string }> = [
  {
    title: 'Cloud guardrails fit the cloud you already pay for',
    body: 'Bedrock Guardrails, Azure Prompt Shields and Model Armor sit inside platforms with existing contracts, support, regions and billing. They also cover content-safety categories and, for Bedrock, grounding checks. SoterAI does not claim grounding or hallucination checks.',
  },
  {
    title: 'Open-source libraries can be read, changed and run without a vendor',
    body: 'Guardrails AI and NeMo Guardrails are Apache-2.0 code you can audit and fork. The SoterAI server is proprietary. Some of its published packages keep their own licenses.',
  },
  {
    title: 'Established vendors have scale and history',
    body: 'Check Point is a large security company, and its release describes enterprise customers. SoterAI is built and run by one person, has no named customers, and holds no certifications.',
  },
  {
    title: 'Breadth of tested coverage',
    body: 'Our blind held-out recall is 16 of 26 cases, and the 100% figures are on sets we wrote. We have not run any head-to-head test, so this page does not say we detect more or less than anyone.',
  },
];

const DIFFERS: Array<{ title: string; body: React.ReactNode }> = [
  {
    title: 'You can try it on your own text, now',
    body: (
      <>
        The <Link className="sa-link" href="/playground">playground</Link> runs the real engine with no signup, and the Free plan works
        anywhere.
      </>
    ),
  },
  {
    title: 'Limits sit beside the numbers',
    body: (
      <>
        <Link className="sa-link" href="/benchmarks">Every figure</Link> comes with its test, and{' '}
        <Link className="sa-link" href="/limitations">known gaps</Link> are listed with dates.
      </>
    ),
  },
  {
    title: 'One policy across several surfaces',
    body: 'API and SDKs (Stable), plus VS Code, Chrome and Edge, and n8n, Make and Zapier guards (Beta), use the same engine and record.',
  },
  {
    title: 'Agent actions can be held for approval',
    body: 'Risky tool calls can be blocked or sent to a person to approve, and each decision is logged. The MCP and agent guard is in Labs.',
  },
  {
    title: 'It can be self-hosted',
    body: 'Docker, Postgres and Redis, with an optional vector store.',
  },
];

const FAQ: FaqItem[] = [
  {
    q: 'Is SoterAI an alternative to Lakera?',
    a: 'They overlap on checking prompts and replies for injection and data leakage. They differ in size, price model and proof. Lakera is now part of Check Point and sells to enterprises. SoterAI has a free tier, a no-signup playground and published limits, and it has no named customers and no certifications. No head-to-head test exists, so neither is claimed to detect more.',
  },
  {
    q: 'Should I use an open-source library instead?',
    a: 'If you want code you can read and run without a vendor, yes, and Guardrails AI and NeMo Guardrails are maintained as of 2026-11-09. LLM Guard is archived. A library does not give you a hosted service, an approval queue or an audit record unless you build them.',
  },
  {
    q: 'Do the big cloud guardrails make this unnecessary?',
    a: 'Not always. They are tied to one cloud and billing account, and each has its own scope. Azure Prompt Shields, for example, returns a result and leaves blocking to your application. If you are on one cloud and its filters meet your need, use them.',
  },
  {
    q: 'How were these facts gathered?',
    a: `From each product’s own documentation or announcement, read on ${READ} (repository facts on ${REPO_READ}). Links are in the table. Products change, so check the source before you rely on a row.`,
  },
];

const SUBPAGES = [
  { href: '/comparison/lakera', label: 'SoterAI and Lakera' },
  { href: '/comparison/guardrails-ai', label: 'SoterAI and Guardrails AI' },
  { href: '/comparison/nemo-guardrails', label: 'SoterAI and NeMo Guardrails' },
  { href: '/comparison/llm-guard', label: 'SoterAI and LLM Guard' },
  { href: '/comparison/prompt-armor', label: 'SoterAI and Prompt Armor' },
  { href: '/comparison/llama-guard', label: 'SoterAI and Meta Llama Guard' },
  { href: '/comparison/bedrock-guardrails', label: 'SoterAI and Bedrock Guardrails' },
  { href: '/comparison/prompt-security', label: 'SoterAI and Prompt Security' },
  { href: '/comparison/hiddenlayer', label: 'SoterAI and HiddenLayer' },
];

export default function ComparisonPage() {
  const ld = [
    breadcrumbList([
      { name: 'Home', path: '/' },
      { name: 'Compare', path: '/comparison' },
    ]),
    faqJsonLd(FAQ),
  ];
  return (
    <SaRoot>
      {ld.map((node, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(node as Record<string, unknown>) }} />
      ))}
      <main className="sa-page" style={{ paddingBlock: 'var(--sa-space-7) var(--sa-space-9)' }}>
        <header>
          <p className="sa-eyebrow">Evidence</p>
          <h1 className="sa-h1" style={{ marginTop: 'var(--sa-space-3)' }}>
            How SoterAI compares, and where it does not.
          </h1>
          <p className="sa-lede" style={{ marginTop: 'var(--sa-space-4)' }}>
            Each row below comes from the product’s own documentation, with a link and the date it was read. There are no scores and no
            winners, because no head-to-head test has been run. Where another option is the better choice, this page says so.
          </p>
          <div style={{ marginTop: 'var(--sa-space-6)', maxWidth: 'var(--sa-measure)' }}>
            <Callout kind="limit" title="Read this first">
              SoterAI wrote this page, so it has a stake. Check the sources, and test each option on your own text.
            </Callout>
          </div>
        </header>

        <section className="sa-section" aria-labelledby="options">
          <div className="sa-section__head">
            <h2 className="sa-h2" id="options">
              The options
            </h2>
            <p className="sa-body sa-muted">
              Three kinds: open-source libraries you run yourself, guardrails built into a cloud, and vendor platforms.
            </p>
          </div>
          <DataTable
            caption="Options for guarding LLM apps, what their own docs say, their terms, and the source"
            columns={[
              { key: 'name', header: 'Option' },
              { key: 'kind', header: 'Kind' },
              { key: 'docs', header: 'What its own docs say' },
              { key: 'terms', header: 'Terms' },
              { key: 'source', header: 'Source' },
            ]}
            rows={OPTIONS}
          />
        </section>

        <section className="sa-section" aria-labelledby="better">
          <div className="sa-section__head">
            <h2 className="sa-h2" id="better">
              Where the others are better today
            </h2>
          </div>
          <ul className="sa-rules sa-rules--2">
            {BETTER.map((b) => (
              <li key={b.title}>
                <h3>{b.title}</h3>
                <p>{b.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="sa-section" aria-labelledby="differs">
          <div className="sa-section__head">
            <h2 className="sa-h2" id="differs">
              Where SoterAI differs
            </h2>
          </div>
          <ul className="sa-rules sa-rules--2">
            {DIFFERS.map((d) => (
              <li key={d.title}>
                <h3>{d.title}</h3>
                <p>{d.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="sa-section" aria-labelledby="test">
          <div className="sa-section__head">
            <h2 className="sa-h2" id="test">
              Test them the same way
            </h2>
            <p className="sa-body">
              Write ten inputs from your own traffic: two attacks you fear, two reworded versions of them, two with personal data, two
              harmless look-alikes and two ordinary requests. Run all ten through each option you are considering, pin each version, and
              record what came back. That tells you more than any figure on any vendor page.
            </p>
          </div>
          <div className="sa-hero__actions">
            <SaLinkButton href="/playground" large>
              {PLAYGROUND_CTA_LABEL}
            </SaLinkButton>
            <SaLinkButton href="/limitations" variant="ghost">
              Read what SoterAI misses
            </SaLinkButton>
          </div>
        </section>

        <section className="sa-section" aria-labelledby="faq">
          <div className="sa-section__head">
            <h2 className="sa-h2" id="faq">
              Questions
            </h2>
          </div>
          <Faq items={FAQ} />
        </section>

        <section className="sa-section" aria-labelledby="pairs">
          <div className="sa-section__head">
            <h2 className="sa-h3" id="pairs">
              One-to-one pages
            </h2>
            <p className="sa-body sa-muted">A fact sheet for each, with sources and the date they were read.</p>
          </div>
          <nav aria-labelledby="pairs">
            <ul className="sa-linklist sa-linklist--cols">
              {SUBPAGES.map((p) => (
                <li key={p.href}>
                  <Link href={p.href}>{p.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </section>
      </main>
    </SaRoot>
  );
}
