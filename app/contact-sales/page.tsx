import type { Metadata } from 'next';
import Link from 'next/link';
import { ContactForm } from '@/components/sa/ContactForm';
import { SaRoot } from '@/components/sa/SaRoot';
import { JsonLd } from '@/components/seo/JsonLd';
import { buildMetadata } from '@/lib/seo/metadata';
import { breadcrumbList } from '@/lib/seo/schema';

/**
 * Where "Book a security review" lands. The old page was a heading and one sentence
 * with no form, so the Home call to action led nowhere. The form posts to the existing
 * /api/ops/contact route.
 *
 * Title: 35 characters with the brand suffix. Description: under 155.
 */
export const metadata: Metadata = buildMetadata({
  title: 'Book a Security Review',
  description:
    'Tell us what you run and what you need: SSO, SCIM, data retention, SIEM export or self-hosting. Free to ask; no response time is promised.',
  path: '/contact-sales',
});

export default function ContactSalesPage() {
  return (
    <SaRoot>
      <JsonLd
        data={breadcrumbList([
          { name: 'Home', path: '/' },
          { name: 'Book a security review', path: '/contact-sales' },
        ])}
      />
      <main className="sa-page" style={{ paddingBlock: 'var(--sa-space-7) var(--sa-space-9)' }}>
        <header>
          <p className="sa-eyebrow">Security review</p>
          <h1 className="sa-h1" style={{ marginTop: 'var(--sa-space-3)' }}>
            Book a security review
          </h1>
          <p className="sa-lede" style={{ marginTop: 'var(--sa-space-4)' }}>
            Describe your AI setup and what you need to control. SoterAI is built and run by one person, and no
            response time is promised.
          </p>
        </header>

        <section className="sa-section" aria-labelledby="form-title">
          <h2 className="sa-h2" id="form-title" style={{ marginBottom: 'var(--sa-space-5)' }}>
            Your details
          </h2>
          <ContactForm />
        </section>

        <section className="sa-section" aria-labelledby="before">
          <div className="sa-section__head">
            <h2 className="sa-h2" id="before">
              Before you write
            </h2>
          </div>
          <ul className="sa-rules sa-rules--2">
            <li>
              <h3>Try it first</h3>
              <p>
                The <Link className="sa-link" href="/playground">playground</Link> runs the real engine on your own text with no
                signup. Use sample data, not real secrets.
              </p>
            </li>
            <li>
              <h3>Read the limits</h3>
              <p>
                <Link className="sa-link" href="/benchmarks">Every number</Link> comes with its test and its{' '}
                <Link className="sa-link" href="/limitations">limits</Link>. Start there if you are comparing tools.
              </p>
            </li>
            <li>
              <h3>Billing</h3>
              <p>
                Paid plans are priced in Indian rupees. Buyers outside India should confirm payment methods and
                eligibility with sales. The Free plan requires no payment.
              </p>
            </li>
            <li>
              <h3>Certifications</h3>
              <p>
                SoterAI is not SOC 2, ISO 27001 or HIPAA certified. The <Link className="sa-link" href="/trust">trust center</Link>{' '}
                lists what exists today.
              </p>
            </li>
          </ul>
        </section>

        <p className="sa-body sa-muted">
          Prefer email? Write to <a className="sa-link" href="mailto:support@soterai.in">support@soterai.in</a>. To report a
          vulnerability, use <Link className="sa-link" href="/responsible-disclosure">responsible disclosure</Link>.
        </p>
      </main>
    </SaRoot>
  );
}
