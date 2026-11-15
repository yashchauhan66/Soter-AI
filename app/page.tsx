import type { Metadata } from 'next';
import Link from 'next/link';
import { PLAYGROUND_CTA_LABEL } from '@/lib/marketing/cta';
import { Faq, faqJsonLd, type FaqItem } from '@/components/sa/Faq';
import { HeroDemo } from '@/components/sa/HeroDemo';
import { HomeIntro } from '@/components/sa/HomeIntro';
import '@/components/sa/home-refresh.css';
import { DataTable, SaLinkButton, StatusBadge } from '@/components/sa/primitives';
import { SaRoot } from '@/components/sa/SaRoot';
import { NUMBERS_WITH_LIMITS, BLIND_RECALL, LATENCY_SENTENCE } from '@/lib/sa/claims';
import { SURFACES } from '@/lib/sa/surfaces';
import { safeJsonLd } from '@/lib/seo/jsonLd';
import { buildMetadata } from '@/lib/seo/metadata';

/**
 * Home. Written from the approved copy deck (Phase 3), and held to the claims
 * register: every number comes from lib/sa/claims.ts, nothing is typed in by hand.
 * The two benign-control counts (1,000 and 322) are different test sets, the public
 * benchmark and the regression run, and each row names its own set.
 *
 * Title: 58 characters. Description: 140.
 */
// buildMetadata() returns the title as absolute here because it already names the
// brand, and it fills in og:site_name, og:type, og:url and the image, which a
// hand-written openGraph object would replace instead of merge.
export const metadata: Metadata = buildMetadata({
  title: 'AI Security Command Layer for LLMs and Agents | SoterAI',
  description:
    'Check prompts and AI replies, redact secrets and personal data, flag prompt injection, and hold risky agent actions. Try it free, no signup.',
  path: '/',
  ogTitle: 'Detect prompt injection. Redact sensitive data. | SoterAI',
  ogDescription:
    'The AI security command layer. It checks prompts and replies, redacts secrets and personal data, flags prompt injection, and holds risky agent actions for approval.',
});

const siteUrl = 'https://soterai.in';

/*
 * Visible FAQ and FAQPage schema come from this one array, so they cannot differ.
 * The latency answer quotes the live sample, not a promise. The old page said
 * "under 50 milliseconds"; the repo's own changelog (2026-06-27) records that a
 * similar claim was false.
 */
const FAQ: FaqItem[] = [
  {
    q: 'What is a command layer?',
    a: 'A command layer decides, for every prompt, reply and agent action, whether to allow, redact, block or hold it for approval, and keeps the record.',
  },
  {
    q: 'Does it guarantee security?',
    a: `No. It lowers risk and it misses things. On ${BLIND_RECALL.of} blind test cases it caught ${BLIND_RECALL.caught}.`,
  },
  {
    q: 'How fast is it?',
    a: `${LATENCY_SENTENCE} See the method on the benchmarks page.`,
  },
  {
    q: 'Does my text stay private?',
    a: 'The public playground sends your text to our server for analysis and is rate limited. Use sample data. To keep text on your own systems, self-host with Docker, Postgres and Redis.',
  },
  {
    q: 'Which languages and data types does it cover?',
    a: 'It finds email, phone numbers, card-like numbers, IBAN-like identifiers, SSN-like identifiers, common API keys, and Indian identifiers such as PAN and UPI IDs. In a smoke test, one instruction override in each of ten non-English languages was flagged. The known gaps are listed on this page.',
  },
  {
    q: 'Who builds it?',
    a: 'SoterAI is built and run by Yash Chauhan, a solo founder in India.',
  },
];

const homeJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': `${siteUrl}/#webpage`,
      url: siteUrl,
      name: 'AI Security Command Layer for LLMs and Agents',
      description: 'Check prompts and AI replies, redact secrets and personal data, flag prompt injection, and hold risky agent actions.',
      isPartOf: { '@id': `${siteUrl}#website` },
      about: { '@id': `${siteUrl}#organization` },
      inLanguage: 'en-IN',
      breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl }] },
    },
    faqJsonLd(FAQ),
  ].map((node) => {
    // faqJsonLd returns its own @context; inside a @graph the nodes must not repeat it.
    const { ['@context']: _ctx, ...rest } = node as Record<string, unknown>;
    return rest;
  }),
};

export default function Home() {
  // A row can be held back by giving it a `blocked` reason in lib/sa/claims.ts.
  const numbers = NUMBERS_WITH_LIMITS.filter((n) => !n.blocked);
  const summaryNumbers = numbers.filter((n) => n.test.startsWith('Server handling time'));

  return (
    <SaRoot>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(homeJsonLd) }} />

      <main className="sa-home soter-home">
        <div className="sa-page">
          <section className="soter-home__hero" aria-labelledby="hero-title">
            <HomeIntro />
            <HeroDemo />
          </section>

          <section className="sa-section sa-home__paths" aria-labelledby="paths">
            <div className="sa-section__head">
              <p className="sa-eyebrow">Choose your starting point</p>
              <h2 className="sa-h2" id="paths">Your workflow. A clear way in.</h2>
              <p className="sa-body sa-muted">Build with the API, review team controls, or connect an existing workflow.</p>
            </div>
            <ol className="sa-pathlist">
              <li>
                <div>
                  <h3 className="sa-h3">For developers</h3>
                  <p>Check the prompt before your model, and the reply before your user.</p>
                </div>
                <Link className="sa-link" href="/docs/quickstart">Build with the API <span aria-hidden="true">↗</span></Link>
              </li>
              <li>
                <div>
                  <h3 className="sa-h3">For security teams</h3>
                  <p>Review the controls for ChatGPT, browser tools and coding assistants.</p>
                </div>
                <Link className="sa-link" href="/ai-user-security">Explore team controls <span aria-hidden="true">↗</span></Link>
              </li>
              <li>
                <div>
                  <h3 className="sa-h3">An automated workflow</h3>
                  <p>Find an integration, check its maturity, and inspect the action before continuing.</p>
                </div>
                <Link className="sa-link" href="/integrations">Browse integrations <span aria-hidden="true">↗</span></Link>
              </li>
            </ol>
          </section>

          <section className="sa-section" aria-labelledby="numbers">
            <div className="sa-section__head">
              <p className="sa-eyebrow">Evidence, not a guarantee</p>
              <h2 className="sa-h2" id="numbers">Every number comes with the test it came from.</h2>
              <p className="sa-body sa-muted">The limit sits next to the number, in the same view, so you can decide how much to trust it.</p>
            </div>
            <dl className="sa-evidence-summary">
              {summaryNumbers.map((n) => (
                <div key={n.test}>
                  <dt>{n.number}</dt>
                  <dd><p>{n.test}</p><p className="sa-muted">{n.limit}</p></dd>
                </div>
              ))}
            </dl>
            <details className="sa-disclosure sa-home__evidence">
              <summary>All results, test conditions &amp; limits</summary>
              <DataTable
                caption="Results, the test behind each one, and why not to over-trust it"
                columns={[
                  { key: 'number', header: 'Number', numeric: true },
                  { key: 'test', header: 'Test' },
                  { key: 'limit', header: 'Why not to over-trust it' },
                ]}
                rows={numbers.map((n) => ({ number: n.number, test: n.test, limit: n.limit }))}
              />
            </details>
            <Link className="sa-link" href="/benchmarks">Read the method and the limits.</Link>
          </section>

          <section className="sa-section sa-home__next" aria-labelledby="pricing">
            <div>
              <p className="sa-eyebrow">Choose a plan</p>
              <h2 className="sa-h2" id="pricing">Free to start. Every plan runs the same detection engine.</h2>
              <p className="sa-body">Higher plans raise limits and add team controls. They do not unlock stronger detection.</p>
              <SaLinkButton href="/pricing" variant="secondary">See plans</SaLinkButton>
            </div>
            <div>
              <p className="sa-eyebrow">Build with it</p>
              <h3 className="sa-h2">From a check to your own code.</h3>
              <p className="sa-body">Start with the API contract, then choose a framework or integration. The docs explain what to send, what comes back, and when to stop.</p>
              <div className="sa-home__next-actions">
                <SaLinkButton href="/docs/quickstart">Read the quickstart</SaLinkButton>
                <Link className="sa-link" href="/docs">Browse documentation</Link>
              </div>
            </div>
          </section>

          <section className="sa-section" aria-labelledby="decides">
            <div className="sa-section__head">
              <h2 className="sa-h2" id="decides">
                One place for three decisions.
              </h2>
            </div>
            <ul className="sa-strip">
              <li>
                <span className="sa-strip__word">See</span>
                <p className="sa-body" style={{ margin: 0 }}>
                  Prompts are checked for injection, jailbreaks, secrets and personal data before the model reads them.
                </p>
              </li>
              <li>
                <span className="sa-strip__word">Say</span>
                <p className="sa-body" style={{ margin: 0 }}>
                  Replies that carry personal data or secrets are redacted or refused before the user sees them.
                </p>
              </li>
              <li>
                <span className="sa-strip__word">Do</span>
                <p className="sa-body" style={{ margin: 0 }}>
                  Risky tool calls are blocked or sent to a person to approve, and each decision is logged.
                </p>
              </li>
            </ul>
            {/* Two entry points into the same engine. Links to both pillar pages keep them
                reachable from the homepage (tests/seo-user-security.test.ts requires it). */}
            <p className="sa-body sa-muted" style={{ marginTop: 'var(--sa-space-5)' }}>
              Building an AI app or agent? See{' '}
              <Link className="sa-link" href="/ai-agent-security">
                AI agent security
              </Link>
              . Setting rules for how your own team uses ChatGPT and coding assistants? See{' '}
              <Link className="sa-link" href="/ai-user-security">
                AI user security
              </Link>
              .
            </p>
          </section>

          <section className="sa-section" aria-labelledby="where">
            <div className="sa-section__head">
              <h2 className="sa-h2" id="where">
                Pick the place your team already works.
              </h2>
              <p className="sa-body sa-muted">
                Each surface has its own status.{' '}
                <Link className="sa-link" href="/pricing#status">
                  What Stable, Beta and Labs mean.
                </Link>
              </p>
            </div>
            <DataTable
              caption="Where it runs, how mature it is, and what it does not do yet"
              columns={[
                { key: 'name', header: 'Surface' },
                { key: 'status', header: 'Status' },
                { key: 'does', header: 'What it does' },
                { key: 'gap', header: 'Known gap' },
              ]}
              rows={SURFACES.map((s) => ({
                name: (
                  <Link className="sa-link" href={s.href}>
                    {s.name}
                  </Link>
                ),
                status: <StatusBadge status={s.status} />,
                does: s.does,
                gap: s.gap,
              }))}
            />
          </section>


          <section className="sa-section" aria-labelledby="finds">
            <div className="sa-section__head">
              <h2 className="sa-h2" id="finds">
                Global identifiers and local ones.
              </h2>
            </div>
            <div className="sa-cols sa-cols--2">
              <div>
                <h3 className="sa-h3">Secrets</h3>
                <p className="sa-body">API keys and tokens, for example AWS keys, GitHub tokens and OpenAI-style keys.</p>
                <h3 className="sa-h3" style={{ marginTop: 'var(--sa-space-5)' }}>
                  Personal data
                </h3>
                <p className="sa-body">
                  Email, phone numbers, card-like numbers, IBAN-like identifiers and SSN-like identifiers.
                </p>
              </div>
              <div>
                <h3 className="sa-h3">India</h3>
                <p className="sa-body">
                  Aadhaar-like numbers, PAN, GSTIN, UPI IDs, IFSC codes and mobile numbers.{' '}
                  <Link className="sa-link" href="/ai-security-india">
                    Indian identifiers and DPDP.
                  </Link>
                </p>
                <h3 className="sa-h3" style={{ marginTop: 'var(--sa-space-5)' }}>
                  Languages
                </h3>
                <p className="sa-body">
                  In a smoke test, one instruction override in each of ten non-English languages was flagged: Spanish,
                  French, German, Portuguese, Russian, Chinese, Japanese, Arabic, Hindi and Hinglish. One phrase per
                  language is not a benchmark.
                </p>
              </div>
            </div>
            <div style={{ marginTop: 'var(--sa-space-6)' }} className="sa-callout sa-callout--limit">
              <p className="sa-callout__title">Known gaps</p>
              <p className="sa-callout__body">
                UK National Insurance numbers are not named. The Aadhaar-like rule can also fire on some card and IBAN
                digits, and it does not check the number&rsquo;s checksum yet.
              </p>
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

          <section className="sa-closing" aria-labelledby="closing">
            <h2 className="sa-h2" id="closing">
              Test it on text you already have.
            </h2>
            <div className="sa-hero__actions">
              <SaLinkButton href="/playground" large>
                {PLAYGROUND_CTA_LABEL}
              </SaLinkButton>
              <SaLinkButton href="/signup" variant="secondary">
                Create a free account
              </SaLinkButton>
              <SaLinkButton href="/contact-sales" variant="ghost">
                Book a security review
              </SaLinkButton>
            </div>
          </section>
        </div>
      </main>
    </SaRoot>
  );
}
