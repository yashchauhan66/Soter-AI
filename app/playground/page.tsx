import type { Metadata } from 'next';
import Link from 'next/link';
import { PlaygroundFromQuery } from '@/components/sa/PlaygroundFromQuery';
import { SaRoot } from '@/components/sa/SaRoot';
import { VerdictLegend } from '@/components/sa/ReviewView';
import { SaLinkButton } from '@/components/sa/primitives';
import { safeJsonLd } from '@/lib/seo/jsonLd';
import { buildMetadata } from '@/lib/seo/metadata';

/**
 * Playground. The live engine, no signup.
 *
 * Replaces the earlier playground and keeps its URL and canonical. It covers all
 * thirteen attack categories of the earlier page and its four safe examples word for
 * word, and adds three attack categories (16 attack and 5 safe presets in all, plus
 * 9 language examples). Four of the thirteen attack texts were reworded (prompt
 * injection, Aadhaar and PAN, API key, Hinglish), so their results can differ from
 * the earlier page. What else changed: the verdict is drawn on the visitor's own
 * text, both timings are shown, a rate limit is never presented as a verdict, and
 * every result carries its limit.
 *
 * Title: 60 characters. Description: 124.
 */
export const metadata: Metadata = buildMetadata({
  // The root layout template appends " | soterai.in". Rendered: 60 characters.
  title: 'Playground: Test a Prompt for Injection and PII',
  description:
    'Test prompts, replies and tool requests on the live SoterAI engine. See the verdict, risk score and redaction. No signup.',
  path: '/playground',
});

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://soterai.in';

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': `${siteUrl}/playground#webpage`,
      url: `${siteUrl}/playground`,
      name: 'Playground: Test a Prompt for Injection and PII',
      isPartOf: { '@id': `${siteUrl}#website` },
      inLanguage: 'en',
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
        { '@type': 'ListItem', position: 2, name: 'Playground', item: `${siteUrl}/playground` },
      ],
    },
  ],
};

export default function PlaygroundPage() {
  return (
    <SaRoot>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
      <main className="sa-page sa-playground-page">
        <header className="sa-playground__head">
          <div>
          <p className="sa-eyebrow">Playground · live engine · no signup</p>
          <h1 className="sa-h1">
            See what the engine decides.
          </h1>
          <p className="sa-lede">
            Paste a prompt, a model reply or a tool request. The engine marks what it found on your own text and says
            what it would do. It runs the same checks as the API.
          </p>
          </div>
          <div className="sa-playground__next">
            <span className="sa-label">Use it in your app</span>
            <SaLinkButton href="/docs/quickstart" variant="secondary">Read the quickstart</SaLinkButton>
            <Link className="sa-link" href="/docs/rest-api">REST API guide</Link>
          </div>
        </header>

        <PlaygroundFromQuery />

        <section aria-labelledby="legend" style={{ marginTop: 'var(--sa-space-8)' }}>
          <h2 className="sa-h3" id="legend" style={{ marginBottom: 'var(--sa-space-4)' }}>
            What the five verdicts mean
          </h2>
          <VerdictLegend />
        </section>

        <section aria-labelledby="use" style={{ marginTop: 'var(--sa-space-8)' }}>
          <h2 className="sa-h3" id="use" style={{ marginBottom: 'var(--sa-space-3)' }}>
            Use it from your own code
          </h2>
          <p className="sa-body">
            The <Link className="sa-link" href="/docs/quickstart">quickstart</Link> shows how to guard a prompt before
            your model and a reply before your user. The{' '}
            <Link className="sa-link" href="/docs/rest-api">REST API guide</Link> covers any language. Read{' '}
            <Link className="sa-link" href="/limitations">what it does not stop</Link> before you rely on it.
          </p>
        </section>
      </main>
    </SaRoot>
  );
}
