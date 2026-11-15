import type { Metadata } from 'next';
import Link from 'next/link';
import { Faq, faqJsonLd, type FaqItem } from '@/components/sa/Faq';
import { PricingComparison, PricingPlans } from '@/components/sa/PricingPlans';
import { Callout, DataTable, SaLinkButton, StatusBadge } from '@/components/sa/primitives';
import { SaRoot } from '@/components/sa/SaRoot';
import { BILLING_NOTE, PLANS, PLANS_STATEMENT } from '@/lib/sa/pricing';
import { pricingOffersLd } from '@/lib/sa/pricing-schema';
import { STATUS_MEANING, SURFACES } from '@/lib/sa/surfaces';
import { safeJsonLd } from '@/lib/seo/jsonLd';
import { buildMetadata } from '@/lib/seo/metadata';

/**
 * Pricing.
 *
 * Plan names, prices and feature lines are copied from the previous page. What is
 * different, and why:
 *  - No "Most popular" badge. The site has no popularity data, and the rule is to
 *    never invent a statistic.
 *  - Prices remain in INR. Currency restrictions do not establish international
 *    payment eligibility; buyers outside India are directed to sales for confirmation.
 *  - "Keywords" meta and the India-only description are gone. The description is
 *    written for a global reader.
 *  - The "Product" schema now names the brand soterai.in. The offer currency stays
 *    INR because that is the only currency that can be charged.
 *
 * Title: 52 characters. Description: 126.
 */
export const metadata: Metadata = buildMetadata({
  // The root layout template appends " | soterai.in". Rendered: 52 characters.
  title: 'AI Security Pricing: Free to Enterprise',
  description:
    'Plans from INR 0. Every plan runs the same detection engine. Start free, upgrade when you need more projects or team controls.',
  path: '/pricing',
  ogTitle: 'Pricing: Free, Starter, Pro, Agency, Enterprise | SoterAI',
  ogDescription: 'Every plan runs the same detection engine. Higher plans raise limits and add team controls.',
});

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://soterai.in';


/*
 * The old page's four questions, tightened. The privacy answer no longer says
 * "designed to avoid persisting raw prompts": that is a design intent, and the
 * accurate statement is what the audit records hold.
 */
const FAQ: FaqItem[] = [
  {
    q: 'What counts as a security check?',
    a: 'Each API call to an input, output, PII, RAG or grounding guard endpoint counts as one check. Calls made through an integration count the same way.',
  },
  {
    q: 'Are all integrations production ready?',
    a: 'No. Each surface has its own status. The API and audit evidence are Stable. Browser Guard, IDE Guard and the n8n, Make and Zapier nodes are Beta. MCP and agent guard is Labs.',
  },
  {
    q: 'Does SoterAI store my prompts or AI outputs?',
    a: 'Audit records store metadata such as risk scores, categories, timestamps and actions. On redaction paths the design avoids keeping raw prompts, secrets and outputs. Self-hosting keeps all of it on your own systems.',
  },
  {
    q: 'Can I pay from outside India?',
    a: 'Paid plans are billed in Indian rupees through Razorpay. Contact sales to confirm available payment methods for your country before purchasing. The Free plan does not require a payment.',
  },
  {
    q: 'Does it replace human security review?',
    a: 'No. It lowers risk and it misses things. It does not replace human review, secure design, monitoring or incident response.',
  },
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': `${siteUrl}/pricing#webpage`,
      url: `${siteUrl}/pricing`,
      name: 'AI Security Pricing: Free to Enterprise',
      isPartOf: { '@id': `${siteUrl}#website` },
      inLanguage: 'en-IN',
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${siteUrl}/pricing#application`,
      name: 'SoterAI',
      applicationCategory: 'SecurityApplication',
      description: 'The AI security command layer: checks prompts and replies, redacts secrets and personal data, and holds risky agent actions.',
      url: `${siteUrl}/pricing`,
      offers: pricingOffersLd(PLANS, siteUrl),
      mainEntityOfPage: { '@type': 'WebPage', '@id': `${siteUrl}/pricing` },
    },
    (() => {
      const { ['@context']: _ctx, ...rest } = faqJsonLd(FAQ) as Record<string, unknown>;
      return { '@id': `${siteUrl}/pricing#faq`, ...rest };
    })(),
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
        { '@type': 'ListItem', position: 2, name: 'Pricing', item: `${siteUrl}/pricing` },
      ],
    },
  ],
};

export default function PricingPage() {
  return (
    <SaRoot>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
      <main className="sa-page" style={{ paddingBlock: 'var(--sa-space-7) var(--sa-space-9)' }}>
        <header>
          <p className="sa-eyebrow">Pricing</p>
          <h1 className="sa-h1" style={{ marginTop: 'var(--sa-space-3)' }}>
            Free to start. The same engine on every plan.
          </h1>
          <p className="sa-lede" style={{ marginTop: 'var(--sa-space-4)' }}>
            {PLANS_STATEMENT} No plan claims complete protection, SOC 2 compliance or unqualified enterprise readiness.
          </p>
        </header>

        {/* The plan names are h3. A hidden h2 keeps the heading order h1, h2, h3 (Lighthouse heading-order). */}
        <h2 className="sa-sr-only" id="plans">
          Plans
        </h2>
        <div style={{ marginTop: 'var(--sa-space-6)' }}>
          <PricingPlans plans={PLANS} />
        </div>

        <div style={{ marginTop: 'var(--sa-space-5)' }}>
          <Callout kind="note" title="Billing">
            {BILLING_NOTE}
          </Callout>
        </div>

        <PricingComparison plans={PLANS} />

        <section className="sa-section" aria-labelledby="status-title" id="status">
          <div className="sa-section__head">
            <h2 className="sa-h2" id="status-title">
              Status of each surface
            </h2>
            <p className="sa-body sa-muted">
              Integrations are sold and supported according to their status. Stable does not mean complete protection.
            </p>
          </div>
          <DataTable
            caption="What each surface does, its status, and its known gap"
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
          <dl style={{ margin: 'var(--sa-space-5) 0 0', display: 'grid', gap: 'var(--sa-space-2)' }}>
            {STATUS_MEANING.map((m) => (
              <div key={m.status} style={{ display: 'flex', gap: 'var(--sa-space-3)', alignItems: 'baseline', flexWrap: 'wrap' }}>
                <dt style={{ minWidth: '5rem' }}>
                  <StatusBadge status={m.status} />
                </dt>
                <dd style={{ margin: 0, flex: 1, minWidth: '14rem' }}>{m.meaning}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="sa-section" aria-labelledby="deploy">
          <div className="sa-cols sa-cols--2">
            <div>
              <h2 className="sa-h3" id="deploy">
                How billing works
              </h2>
              <p className="sa-body">
                Trials expire after the configured window. Payment failures get a limited grace period. Plan activation
                and changes need a server-verified Razorpay signature.
              </p>
            </div>
            <div>
              <h2 className="sa-h3">Need a deployment review?</h2>
              <p className="sa-body">
                Enterprise pricing depends on message volume, deployment model, support needs and integration scope.
                Enterprise general availability is still gated on evidence, and the Enterprise plan starts as a paid
                pilot.
              </p>
              <div style={{ marginTop: 'var(--sa-space-4)', display: 'flex', gap: 'var(--sa-space-3)', flexWrap: 'wrap' }}>
                <SaLinkButton href="/contact-sales" variant="secondary">
                  Book a security review
                </SaLinkButton>
                <SaLinkButton href="/enterprise/pilot" variant="ghost">
                  Join the paid pilot
                </SaLinkButton>
              </div>
            </div>
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
      </main>
    </SaRoot>
  );
}
