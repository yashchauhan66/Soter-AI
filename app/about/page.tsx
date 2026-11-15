import type { Metadata } from 'next';
import Link from 'next/link';
import { PLAYGROUND_CTA_LABEL } from '@/lib/marketing/cta';
import { SaLinkButton } from '@/components/sa/primitives';
import { SaRoot } from '@/components/sa/SaRoot';
import { JsonLd } from '@/components/seo/JsonLd';
import { safeJsonLd } from '@/lib/seo/jsonLd';
import { buildMetadata } from '@/lib/seo/metadata';
import { breadcrumbList, ORGANIZATION_ID, SITE_URL } from '@/lib/seo/schema';

/**
 * About. Facts only. The old page described the founder as "an Indian technologist and
 * cybersecurity researcher" who builds "zero-compromise runtime firewalls", said IDE Guard
 * works with Cursor and Windsurf (the repo's own claims document says other editors are
 * untested), and made India the product's headline. None of that is kept.
 *
 * Title: 38 characters with the brand suffix. Description: 134.
 */
export const metadata: Metadata = buildMetadata({
  title: 'About: Built and Run by One Person',
  description:
    'SoterAI is built and run by Yash Chauhan, a solo founder in India. What it does, how it is made, and what it does not do yet.',
  path: '/about',
});

const aboutJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'AboutPage',
  url: `${SITE_URL}/about`,
  name: 'About SoterAI',
  description: 'SoterAI is built and run by Yash Chauhan, a solo founder in India.',
  // The canonical Organization node (with the founder and sameAs) lives in schema.ts.
  mainEntity: { '@id': ORGANIZATION_ID },
};

const PRINCIPLES: Array<{ title: string; body: string }> = [
  {
    title: 'Say what it misses',
    body: 'Every number on the site sits beside its test and its limits, and the limits page lists known gaps with dates. If a gap is fixed it moves to the changelog.',
  },
  {
    title: 'Let people try it first',
    body: 'The playground runs the real engine with no signup, and the Free plan works anywhere. You should see a verdict on your own text before you talk to anyone.',
  },
  {
    title: 'Regional depth, not a regional product',
    body: 'It is built for teams anywhere. India is where it is made, and it names Indian identifiers such as PAN, GSTIN, UPI IDs, IFSC codes and Aadhaar-like numbers. Other regions are added only when the engine and the evidence support them.',
  },
  {
    title: 'Layers, not a promise',
    body: 'No single tool removes AI risk. SoterAI checks prompts, replies and agent actions, and says where each layer ends.',
  },
];

export default function AboutPage() {
  return (
    <SaRoot>
      <JsonLd
        data={breadcrumbList([
          { name: 'Home', path: '/' },
          { name: 'About', path: '/about' },
        ])}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(aboutJsonLd) }} />
      <main className="sa-page" style={{ paddingBlock: 'var(--sa-space-7) var(--sa-space-9)' }}>
        <header>
          <p className="sa-eyebrow">About</p>
          <h1 className="sa-h1" style={{ marginTop: 'var(--sa-space-3)' }}>
            Built and run by one person.
          </h1>
          <p className="sa-lede" style={{ marginTop: 'var(--sa-space-4)' }}>
            SoterAI is the AI security command layer. It is made by Yash Chauhan, a solo founder in India. There is no team page
            because there is no team.
          </p>
        </header>

        <section className="sa-section" aria-labelledby="facts">
          <div className="sa-section__head">
            <h2 className="sa-h2" id="facts">
              The facts
            </h2>
          </div>
          <dl className="sa-facts">
            <div>
              <dt>Founder</dt>
              <dd>Yash Chauhan, Founder and CEO</dd>
            </div>
            <div>
              <dt>Based in</dt>
              <dd>India</dd>
            </div>
            <div>
              <dt>Product</dt>
              <dd>
                An AI security command layer: it checks prompts and replies, redacts secrets and personal data, flags prompt injection,
                and holds risky agent actions for approval.
              </dd>
            </div>
            <div>
              <dt>Surfaces</dt>
              <dd>
                API and SDKs (Stable). VS Code extension, Chrome and Edge extension, and n8n, Make and Zapier guards (Beta). MCP and
                agent guard (Labs). Details on the <Link className="sa-link" href="/integrations">integrations page</Link>.
              </dd>
            </div>
            <div>
              <dt>Customers</dt>
              <dd>None are named here. No logos, quotes or case studies are shown unless they are real and agreed.</dd>
            </div>
            <div>
              <dt>Certifications</dt>
              <dd>
                None held. See the <Link className="sa-link" href="/trust">trust center</Link>.
              </dd>
            </div>
            <div>
              <dt>Contact</dt>
              <dd>
                <a className="sa-link" href="mailto:support@soterai.in">support@soterai.in</a>
              </dd>
            </div>
          </dl>
        </section>

        <section className="sa-section" aria-labelledby="why">
          <div className="sa-section__head">
            <h2 className="sa-h2" id="why">
              Why it exists
            </h2>
          </div>
          <div className="sa-prose">
            <p>
              Teams ship chatbots, retrieval systems and agents faster than they add controls. The controls that production software
              expects are visible decisions, enforceable rules and a record of what happened. SoterAI puts those in one place, and
              starts with a free tier so a developer can try it without a sales call.
            </p>
            <p>
              Larger plans add team controls such as SSO, SCIM, retention settings and SIEM export. Every plan runs the same detection
              engine.
            </p>
          </div>
        </section>

        <section className="sa-section" aria-labelledby="principles">
          <div className="sa-section__head">
            <h2 className="sa-h2" id="principles">
              How it is built
            </h2>
          </div>
          <ul className="sa-rules sa-rules--2">
            {PRINCIPLES.map((p) => (
              <li key={p.title}>
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="sa-section" aria-labelledby="evidence">
          <div className="sa-section__head">
            <h2 className="sa-h2" id="evidence">
              Where to check us
            </h2>
          </div>
          <ul className="sa-linklist sa-linklist--cols">
            <li><Link href="/benchmarks">Numbers with their limits</Link></li>
            <li><Link href="/limitations">What it misses today</Link></li>
            <li><Link href="/changelog">Changelog</Link></li>
            <li><Link href="/status">Service status</Link></li>
            <li><Link href="/responsible-disclosure">Responsible disclosure</Link></li>
            <li>
              <a href="https://marketplace.visualstudio.com/items?itemName=soterai.soterai-ide-guard" target="_blank" rel="noopener noreferrer">
                IDE Guard on the VS Code Marketplace
              </a>
            </li>
          </ul>
        </section>

        <section className="sa-closing" aria-labelledby="closing">
          <h2 className="sa-h2" id="closing">
            Try it before you decide.
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
      </main>
    </SaRoot>
  );
}
