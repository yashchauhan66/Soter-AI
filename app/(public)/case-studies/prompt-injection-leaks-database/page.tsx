import type { Metadata } from 'next';
import Link from 'next/link';
import { Callout, SaLinkButton } from '@/components/sa/primitives';
import { SaRoot } from '@/components/sa/SaRoot';
import { JsonLd } from '@/components/seo/JsonLd';
import { articleLd, buildMetadata } from '@/lib/seo/metadata';
import { breadcrumbList } from '@/lib/seo/schema';

const path = '/case-studies/prompt-injection-leaks-database';
const headline = 'Illustrative scenario: prompt injection and a database';
const description = 'An illustrative RAG data-leak scenario, not a verified customer incident. Review authorization, guard placement and the limits of detection.';

export const metadata: Metadata = buildMetadata({
  title: 'Illustrative case: prompt injection',
  description,
  path,
  isArticle: true,
  datePublished: '2026-09-01',
});

export default function IllustrativeCasePage() {
  return (
    <SaRoot>
      <JsonLd data={breadcrumbList([
        { name: 'Home', path: '/' },
        { name: 'Case studies', path: '/case-studies' },
        { name: 'Illustrative prompt-injection scenario', path },
      ])} />
      <JsonLd data={articleLd({
        headline,
        description,
        path,
        datePublished: '2026-09-01',
        dateModified: '2026-11-11',
      })} />
      <main className="sa-page" style={{ paddingBlock: 'var(--sa-space-7) var(--sa-space-9)' }}>
        <header>
          <Link className="sa-link sa-label" href="/case-studies">← Case studies</Link>
          <p className="sa-eyebrow" style={{ marginTop: 'var(--sa-space-5)' }}>RAG &amp; prompt injection · Illustrative</p>
          <h1 className="sa-h1" style={{ marginTop: 'var(--sa-space-3)' }}>How prompt injection could expose a database.</h1>
          <p className="sa-lede" style={{ marginTop: 'var(--sa-space-4)' }}>
            A hypothetical HR chatbot retrieves an untrusted document that asks the assistant
            to reveal records outside the user&apos;s request. The question is which boundary stops it.
          </p>
        </header>

        <section className="sa-section" aria-label="Provenance and evidence limits">
          <Callout kind="limit" title="Illustrative, not a verified incident">
            This is not a customer case study. No verified customer, incident report or measured
            SoterAI outcome is supplied. The steps below describe a possible failure path,
            not an observed breach or a successful prevention test.
          </Callout>
        </section>

        <section className="sa-section" aria-labelledby="failure-path">
          <div className="sa-section__head">
            <h2 className="sa-h2" id="failure-path">A possible failure path</h2>
          </div>
          <ol className="sa-steps">
            <li><div>
              <h3>Untrusted text enters retrieval</h3>
              <p className="sa-body">A document contains instructions to ignore the task and retrieve private records. It should be treated as data, not as authority.</p>
            </div></li>
            <li><div>
              <h3>The assistant has more access than the user</h3>
              <p className="sa-body">If the retrieval or database tool uses broad credentials, the assistant may be able to request records that the user is not authorized to read.</p>
            </div></li>
            <li><div>
              <h3>An unchecked result leaves the application</h3>
              <p className="sa-body">If the model follows the injected instruction and the output is sent without review, private data could cross the intended boundary.</p>
            </div></li>
          </ol>
        </section>

        <section className="sa-section" aria-labelledby="controls">
          <div className="sa-section__head">
            <h2 className="sa-h2" id="controls">Controls to evaluate, not a prevention guarantee</h2>
            <p className="sa-body">The application must enforce authorization for each retrieval and tool call. A text guard cannot replace database access control.</p>
          </div>
          <ul className="sa-rules">
            <li><h3>Limit retrieval to the requesting user</h3><p className="sa-body">Use least-privilege credentials and enforce tenant and record-level permissions before returning any data to the model.</p></li>
            <li><h3>Check the text you actually send</h3><p className="sa-body">An input guard can review prompts and retrieved text for known injection patterns. Text that bypasses the guard is not inspected, and a new attack may be missed.</p></li>
            <li><h3>Review output and sensitive actions</h3><p className="sa-body">Check the reply before release. Keep sensitive tool actions behind authorization and, where appropriate, human approval. Test error and bypass paths as well as expected detections.</p></li>
          </ul>
        </section>

        <section className="sa-section" aria-labelledby="verification">
          <div className="sa-section__head">
            <h2 className="sa-h2" id="verification">What would make this a customer case study?</h2>
            <p className="sa-body">A publishable deployment needs customer approval, incident provenance, the tested configuration, measured outcomes, and false-positive and missed-attack findings. None is claimed here.</p>
          </div>
          <p className="sa-body">See the <Link className="sa-link" href="/docs/rest-api">REST API guide</Link> for integration details and <Link className="sa-link" href="/limitations">known limitations</Link> before planning a pilot.</p>
          <div className="sa-hero__actions">
            <SaLinkButton href="/signup">Create a free account</SaLinkButton>
            <SaLinkButton href="/contact-sales" variant="secondary">Discuss an evidenced deployment</SaLinkButton>
            <SaLinkButton href="/case-studies" variant="ghost">Back to case studies</SaLinkButton>
          </div>
        </section>
      </main>
    </SaRoot>
  );
}
