import type { Metadata } from 'next';
import Link from 'next/link';
import { Callout, SaLinkButton } from '@/components/sa/primitives';
import { SaRoot } from '@/components/sa/SaRoot';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Case studies: illustrative AI risk analysis',
  description:
    'An illustrative prompt-injection scenario, not a verified customer incident. Explore data boundaries, possible controls and their limits.',
  path: '/case-studies',
});

export default function CaseStudiesPage() {
  return (
    <SaRoot>
      <main className="sa-page" style={{ paddingBlock: 'var(--sa-space-7) var(--sa-space-9)' }}>
        <header>
          <p className="sa-eyebrow">Case studies · Illustrative analysis</p>
          <h1 className="sa-h1" style={{ marginTop: 'var(--sa-space-3)' }}>
            AI security scenarios, with their limits.
          </h1>
          <p className="sa-lede" style={{ marginTop: 'var(--sa-space-4)' }}>
            Explore how a prompt injection could cross a RAG application&apos;s data boundaries,
            and where a guard step might help.
          </p>
        </header>

        <section className="sa-section" aria-label="Evidence status">
          <Callout kind="limit" title="Illustrative, not customer proof">
            This is not a customer case study. No verified customer or incident provenance is
            supplied for this scenario. It does not report measured outcomes or a deployment of SoterAI.
          </Callout>
        </section>

        <section className="sa-section" aria-label="Illustrative analyses">
          <ul className="sa-rules">
            <li>
              <Link
                href="/case-studies/prompt-injection-leaks-database"
                className="sa-link"
                style={{ display: 'block', textDecoration: 'none' }}
              >
                <p className="sa-eyebrow">RAG &amp; prompt injection · Illustrative</p>
                <h2 className="sa-h2" style={{ marginBlock: 'var(--sa-space-3)' }}>
                  How prompt injection could expose a database
                </h2>
                <p className="sa-body">
                  A hypothetical HR chatbot shows the difference between checking retrieved text
                  and enforcing who may read the underlying records. No prevention result is claimed.
                </p>
                <p className="sa-label" style={{ marginTop: 'var(--sa-space-4)' }}>Read the analysis →</p>
              </Link>
            </li>
          </ul>
        </section>

        <section className="sa-section" aria-labelledby="share-a-case">
          <div className="sa-section__head">
            <h2 id="share-a-case" className="sa-h2">Have an evidenced deployment to share?</h2>
            <p className="sa-body">
              Send the use case, measured results and known limitations. Customer approval and
              supporting evidence are needed before a deployment can be presented as a customer case study.
            </p>
          </div>
          <SaLinkButton href="/contact-sales" variant="secondary">Contact us</SaLinkButton>
        </section>
      </main>
    </SaRoot>
  );
}
