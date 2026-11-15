import type { Metadata } from 'next';
import Link from 'next/link';
import { PLAYGROUND_CTA_LABEL } from '@/lib/marketing/cta';
import { Faq, faqJsonLd, type FaqItem } from '@/components/sa/Faq';
import { Callout, DataTable, SaLinkButton, StatusBadge } from '@/components/sa/primitives';
import { SaRoot } from '@/components/sa/SaRoot';
import { JsonLd } from '@/components/seo/JsonLd';
import { BLIND_RECALL, BLIND_RECALL_INTERVAL } from '@/lib/sa/claims';
import { STATUS_MEANING, SURFACES } from '@/lib/sa/surfaces';
import { buildMetadata } from '@/lib/seo/metadata';
import { breadcrumbList } from '@/lib/seo/schema';

/**
 * The published limits. Every gap below was observed or recorded on the date shown,
 * and the date is printed with it. When a gap is fixed, move it to the changelog and
 * delete the row. Do not soften a row to make the page read better.
 *
 * Title: 44 characters before the brand suffix. Description: 150.
 */
export const metadata: Metadata = buildMetadata({
  title: 'Known Limits and Gaps: What It Misses',
  description:
    'What SoterAI misses today: detection gaps with dates, how mature each surface is, and what it does not claim. Updated 2026-11-09.',
  path: '/limitations',
});

const REVIEWED = '2026-11-09';

const GAPS: Array<{ gap: string; evidence: string; effect: string }> = [
  {
    gap: 'Blind held-out recall is 16 of 26',
    evidence: `${BLIND_RECALL.caught} of ${BLIND_RECALL.of} cases that no detector was tuned against were caught (about ${Math.round(BLIND_RECALL_INTERVAL.low)} to ${Math.round(BLIND_RECALL_INTERVAL.high)}% at 95% confidence, computed). The set is two short paraphrases in each of 13 languages.`,
    effect: 'Assume a new attack wording can get through. The 98.40% and 100% figures are on sets we tuned against.',
  },
  {
    gap: 'Aadhaar-like rule has no checksum',
    evidence: 'A checksum-valid and a checksum-invalid 12-digit number got the same result in two live calls on 2026-11-09.',
    effect: 'Order numbers and other 12-digit values can be redacted as Aadhaar-like. A real number is not confirmed as real.',
  },
  {
    gap: 'Card and IBAN digits can also get an Aadhaar-like label',
    evidence: 'A test card number and a sample IBAN each returned an extra Aadhaar-like finding in live calls on 2026-11-09.',
    effect: 'The redaction still happens, but the label is wrong. Do not use the label for reporting.',
  },
  {
    gap: 'Masked Aadhaar numbers are not reliably named',
    evidence: "A number written 'XXXX XXXX 1234' got no pattern rule in two samples on 2026-11-09. The model tier only held it for review.",
    effect: 'Do not rely on pattern detection for masked identifiers.',
  },
  {
    gap: 'UK National Insurance numbers are not named',
    evidence: 'A sample number went to HUMAN_REVIEW from the model tier with no named identifier on 2026-11-09.',
    effect: 'Treat UK national identifiers as uncovered by pattern rules.',
  },
  {
    gap: 'Languages: one phrase each, and some false alarms',
    evidence:
      'One instruction-override phrase in each of ten non-English languages was flagged. That is a smoke test, not a benchmark. In an earlier run, a harmless sentence in Portuguese, Russian, Chinese and Arabic returned HUMAN_REVIEW at risk 0. No native speaker has reviewed those sentences.',
    effect: 'No recall or false-positive rate exists for any language. Expect review queue noise in those languages.',
  },
  {
    gap: 'No independent audit',
    evidence: 'Every benchmark is written and maintained by the same person who builds the engine.',
    effect: 'Read each number as a regression check, not as proof of real-world performance.',
  },
];

const BOUNDARIES: Array<{ title: string; body: string }> = [
  {
    title: 'Detection is heuristic',
    body: 'Secrets, personal data and prompt injection are found with patterns, signatures and a model tier. Common and known cases are caught more often than new wording or heavy obfuscation. A clean result means no known issue was found, not that the text is safe.',
  },
  {
    title: 'Coverage is limited to what you route through it',
    body: 'The API checks the text you send it. The IDE and browser extensions check what passes through them. Traffic that bypasses them is not seen.',
  },
  {
    title: 'Redaction is best effort',
    body: 'Redacted text is safer than raw text, but review it before you share it outside your team. Test redaction end to end on your own setup with sample values.',
  },
  {
    title: 'It governs what leaves, not the provider',
    body: 'It reduces what sensitive data reaches a model and records what was sent. It does not control how a provider handles text you choose to send. Provider terms still apply.',
  },
  {
    title: 'A recorded decision is not a prevented one',
    body: 'Audit logs and ledgers show what happened. Pair them with blocking, redaction or approval rules if you need prevention.',
  },
  {
    title: 'The public playground sends text to our server',
    body: 'Use sample data, not real secrets. To keep text on your own systems, self-host with Docker, Postgres and Redis.',
  },
];

const NOT_CLAIMED = [
  'Complete protection for any application. It lowers risk and it misses things.',
  'SOC 2, ISO 27001 or HIPAA certification. None is held. Compliance content is evidence collection and control mapping only.',
  'Independent validation of any benchmark.',
  'A latency promise. Only measured samples are quoted, with their method.',
  'Support for editors other than VS Code, or browsers other than Chrome and Edge. Others are untested.',
  'Billing outside India. Paid plans are priced in Indian rupees. Confirm supported payment methods and eligibility with sales; INR pricing alone does not establish country availability.',
];

const FAQ: FaqItem[] = [
  {
    q: 'Is SoterAI completely secure?',
    a: `No. No security product is. It lowers the chance of leaking secrets and personal data to AI tools and flags many attacks, and it misses some. On ${BLIND_RECALL.of} blind test cases it caught ${BLIND_RECALL.caught}.`,
  },
  {
    q: 'Why publish a page about what you miss?',
    a: 'A buyer should see the limits before the claims. Each row here has a date and the evidence behind it, so you can check it or reproduce it.',
  },
  {
    q: 'What is the most important thing to understand?',
    a: 'Detection is heuristic. SoterAI is one layer in a defense in depth. It does not replace least privilege, code review, isolation or authentication.',
  },
  {
    q: 'How do I report a gap that is not listed?',
    a: 'Email support@soterai.in with the text that was missed or wrongly flagged. Use sample data. For a security vulnerability, use the responsible disclosure page.',
  },
];

export default function LimitationsPage() {
  return (
    <SaRoot>
      <JsonLd
        data={breadcrumbList([
          { name: 'Home', path: '/' },
          { name: 'Known limits', path: '/limitations' },
        ])}
      />
      <JsonLd data={faqJsonLd(FAQ)} />
      <main className="sa-page" style={{ paddingBlock: 'var(--sa-space-7) var(--sa-space-9)' }}>
        <header>
          <p className="sa-eyebrow">Evidence</p>
          <h1 className="sa-h1" style={{ marginTop: 'var(--sa-space-3)' }}>
            What SoterAI misses today.
          </h1>
          <p className="sa-lede" style={{ marginTop: 'var(--sa-space-4)' }}>
            Security marketing leans on absolutes. This page lists the gaps we know about, with the date each one was observed, so you
            can weigh them before you rely on the product. Last reviewed {REVIEWED}.
          </p>
          <div className="sa-hero__actions">
            <SaLinkButton href="/playground" large>
              {PLAYGROUND_CTA_LABEL}
            </SaLinkButton>
            <SaLinkButton href="/benchmarks" variant="ghost">
              Read the numbers
            </SaLinkButton>
          </div>
        </header>

        <section className="sa-section" aria-labelledby="gaps">
          <div className="sa-section__head">
            <h2 className="sa-h2" id="gaps">
              Known detection gaps
            </h2>
            <p className="sa-body sa-muted">
              Single samples unless a row says otherwise. A sample shows that a gap exists. It does not measure how often.
            </p>
          </div>
          <DataTable
            caption="Known detection gaps, the evidence for each, and what it means for you"
            columns={[
              { key: 'gap', header: 'Gap' },
              { key: 'evidence', header: 'Evidence' },
              { key: 'effect', header: 'What it means' },
            ]}
            rows={GAPS}
          />
        </section>

        <section className="sa-section" aria-labelledby="maturity">
          <div className="sa-section__head">
            <h2 className="sa-h2" id="maturity">
              How mature each surface is
            </h2>
          </div>
          <DataTable
            caption="Each surface, its status, and what it does not do yet"
            columns={[
              { key: 'name', header: 'Surface' },
              { key: 'status', header: 'Status' },
              { key: 'gap', header: 'Known gap' },
            ]}
            rows={SURFACES.map((s) => ({
              name: (
                <Link className="sa-link" href={s.href}>
                  {s.name}
                </Link>
              ),
              status: <StatusBadge status={s.status} />,
              gap: s.gap,
            }))}
          />
          <ul className="sa-rules" style={{ marginTop: 'var(--sa-space-5)' }}>
            {STATUS_MEANING.map((m) => (
              <li key={m.status}>
                <h3>
                  <StatusBadge status={m.status} />
                </h3>
                <p>{m.meaning}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="sa-section" aria-labelledby="boundaries">
          <div className="sa-section__head">
            <h2 className="sa-h2" id="boundaries">
              Boundaries of the design
            </h2>
          </div>
          <ul className="sa-rules sa-rules--2">
            {BOUNDARIES.map((b) => (
              <li key={b.title}>
                <h3>{b.title}</h3>
                <p>{b.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="sa-section" aria-labelledby="not-claimed">
          <div className="sa-section__head">
            <h2 className="sa-h2" id="not-claimed">
              What we do not claim
            </h2>
          </div>
          <ul className="sa-limits">
            {NOT_CLAIMED.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <div style={{ marginTop: 'var(--sa-space-6)' }}>
            <Callout kind="note" title="Tell us when this page is wrong">
              Email <a className="sa-link" href="mailto:support@soterai.in">support@soterai.in</a> with the text that was missed or
              wrongly flagged. Fixes are recorded in the <Link className="sa-link" href="/changelog">changelog</Link>.
            </Callout>
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

        <section className="sa-section" aria-labelledby="related">
          <div className="sa-section__head">
            <h2 className="sa-h3" id="related">
              Related
            </h2>
          </div>
          <nav aria-labelledby="related">
            <ul className="sa-linklist sa-linklist--cols">
              <li><Link href="/benchmarks">Numbers and their limits</Link></li>
              <li><Link href="/benchmark/methodology">Benchmark methodology</Link></li>
              <li><Link href="/trust">Trust center</Link></li>
              <li><Link href="/security">Security</Link></li>
              <li><Link href="/responsible-disclosure">Responsible disclosure</Link></li>
              <li><Link href="/changelog">Changelog</Link></li>
            </ul>
          </nav>
        </section>
      </main>
    </SaRoot>
  );
}
