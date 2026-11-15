import type { Metadata } from 'next';
import Link from 'next/link';
import { CodeBlock } from '@/components/sa/CodeBlock';
import { Faq, faqJsonLd } from '@/components/sa/Faq';
import { Callout, SaLinkButton, StatusBadge } from '@/components/sa/primitives';
import { SaRoot } from '@/components/sa/SaRoot';
import { JsonLd } from '@/components/seo/JsonLd';
import { buildMetadata } from '@/lib/seo/metadata';
import { breadcrumbList } from '@/lib/seo/schema';
import { STATUS_MEANING, SURFACES } from '@/lib/sa/surfaces';

const workflowSurface = SURFACES.find((surface) => surface.href === '/integrations')!;

export const metadata: Metadata = buildMetadata({
  title: 'Make.com AI security: HTTP integration',
  description: 'A Beta guide to checking Make.com AI inputs and replies with HTTP modules. Configure credentials, verdict routing and error paths before a pilot.',
  path: '/integrations/make',
  keywords: ['make.com ai security', 'make ai scenario security', 'integromat ai security', 'make prompt injection', 'make llm security', 'secure make ai modules', 'soterai make integration'],
});

const faqs = [
  { q: "Does SoterAI work with Make.com's native AI modules?", a: 'Use an HTTP module before or after the AI module you want to check. This is a guide, not a native SoterAI module. Only the text mapped into the guard request is inspected.' },
  { q: "Can I use SoterAI with Make's self-hosted (on-premise) edition?", a: 'This guide does not verify a self-hosted Make edition. An HTTP integration needs a reachable SoterAI API; verify your Make deployment, network path and data boundary before using a private endpoint.' },
  { q: 'How does SoterAI handle Make error branches?', a: 'Configure the Router to handle the returned verdict and a separate error handler for failed HTTP requests. A BLOCK verdict is response data, not necessarily an HTTP error. Do not run the AI module on a missing or invalid result.' },
  { q: 'What is the latency impact on Make scenarios?', a: 'Each guard step adds an API call and its network and processing time. No end-to-end Make scenario latency is claimed here. Measure your own scenario, including retries and error handling.' },
];

const steps = [
  { step: 'Create a SoterAI project and get your API key', body: 'Sign up at soterai.in, create a project, and store the API key securely. The REST guide names the configuration values SOTER_BASE_URL and SOTER_API_KEY.' },
  { step: 'Add an HTTP module before your AI module', body: 'Add HTTP > Make a request. Use POST to your SOTER_BASE_URL followed by /api/guard/input. Enable JSON response parsing before configuring the Router.' },
  { step: 'Set up the request body and authentication', body: 'Use a Raw application/json body with the message field mapped from your trigger. Set the x-api-key header to your securely stored SOTER_API_KEY value. Do not paste the placeholder name as a credential.' },
  { step: 'Route on the guard response', body: 'Continue only for a valid result with allowed exactly true and action exactly ALLOW. For action ALLOW_WITH_REDACTION, require allowed exactly true and a non-empty redactedText or safeText; pass only that cleaned text to the AI module. For action REWRITE, require allowed exactly true and a non-empty safeText; pass only that rewritten text. Stop or send for review on BLOCK or HUMAN_REVIEW. Stop when allowed is false or missing, the action is unknown or missing, required cleaned text is absent, or the result is invalid or unavailable.' },
  { step: 'Add output guard after your AI module', body: 'POST to /api/guard/output with the aiResponse field mapped from the model reply. Apply the same verdict routing before sending the reply to another app. Configure HTTP failures so downstream actions do not run.' },
];

const inputRequest = `curl -X POST "$SOTER_BASE_URL/api/guard/input" \\
  -H "x-api-key: $SOTER_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"message":"Non-sensitive test prompt"}'`;
const outputRequest = `curl -X POST "$SOTER_BASE_URL/api/guard/output" \\
  -H "x-api-key: $SOTER_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"aiResponse":"Non-sensitive test reply"}'`;

const features = [
  { title: 'Input guard', body: 'Review mapped text for known injection and jailbreak patterns before calling your AI module.' },
  { title: 'PII and secret detection', body: 'Find recognized sensitive identifiers in the text you supply. Use the cleaned text when your policy calls for redaction.' },
  { title: 'Output guard', body: 'Inspect the mapped model reply before it goes to a downstream module.' },
  { title: 'Decision evidence', body: 'Review guard decisions in SoterAI. Audit retention and export availability depend on your plan and configuration.' },
];

export default function Page() {
  return (
    <SaRoot>
      <JsonLd data={breadcrumbList([
        { name: 'Home', path: '/' }, { name: 'Integrations', path: '/integrations' },
        { name: 'Make.com AI Security', path: '/integrations/make' },
      ])} />
      <JsonLd data={faqJsonLd(faqs)} />
      <JsonLd data={{
        '@context': 'https://schema.org', '@type': 'HowTo',
        name: 'How to add SoterAI AI security to Make.com scenarios',
        description: 'Configure the HTTP module, authentication and verdict routing for supplied AI inputs and replies.',
        step: steps.map((item, i) => ({ '@type': 'HowToStep', position: i + 1, name: item.step, text: item.body })),
      }} />
      <main className="sa-page" style={{ paddingBlock: 'var(--sa-space-7) var(--sa-space-9)' }}>
        <header>
          <p className="sa-eyebrow">Integration · Make.com <StatusBadge status={workflowSurface.status} /></p>
          <h1 className="sa-h1" style={{ marginTop: 'var(--sa-space-3)' }}>Check the AI text in your Make scenario.</h1>
          <p className="sa-lede" style={{ marginTop: 'var(--sa-space-4)' }}>Call SoterAI from Make&apos;s HTTP module before a prompt or after a reply. This is a guide, not a native module. You configure the credentials, text mapping and decision branches.</p>
          <div className="sa-hero__actions"><SaLinkButton href="/signup">Get your API key</SaLinkButton><SaLinkButton href="/docs/rest-api" variant="secondary">REST API docs</SaLinkButton></div>
          <p className="sa-body sa-muted" style={{ marginTop: 'var(--sa-space-4)' }}>{STATUS_MEANING.find((item) => item.status === workflowSurface.status)?.meaning}</p>
        </header>

        <section className="sa-section" aria-labelledby="checks">
          <div className="sa-section__head"><h2 className="sa-h2" id="checks">What the HTTP steps check</h2></div>
          <ul className="sa-rules sa-rules--2">{features.map((item) => <li key={item.title}><h3>{item.title}</h3><p className="sa-body">{item.body}</p></li>)}</ul>
        </section>

        <section className="sa-section" aria-labelledby="setup">
          <div className="sa-section__head"><h2 className="sa-h2" id="setup">How to integrate with Make.com</h2></div>
          <ol className="sa-steps">{steps.map((item) => <li key={item.step}><div><h3>{item.step}</h3><p className="sa-body">{item.body}</p></div></li>)}</ol>
        </section>

        <section className="sa-section" aria-labelledby="requests">
          <div className="sa-section__head"><h2 className="sa-h2" id="requests">The documented HTTP requests</h2><p className="sa-body">These curl equivalents use the existing REST documentation&apos;s environment-variable names. In Make, map the configured URL, secret header and text fields into the module. They are request examples, not captured engine responses.</p></div>
          <div className="sa-cols sa-cols--2"><CodeBlock label="Input request" language="bash" code={inputRequest} /><CodeBlock label="Output request" language="bash" code={outputRequest} /></div>
        </section>

        <section className="sa-section" aria-labelledby="limits">
          <div className="sa-section__head"><h2 className="sa-h2" id="limits">Limitations</h2></div>
          <Callout kind="limit" title="Routing is part of the control">Modules that bypass the guard are not covered. A guard can miss attacks or flag benign text. Check your Make plan&apos;s HTTP restrictions and test ALLOW, ALLOW_WITH_REDACTION, REWRITE, BLOCK and HUMAN_REVIEW, missing or empty cleaned text, allowed false or missing, invalid or unavailable responses and API failures before a rollout.</Callout>
        </section>

        <section className="sa-section" aria-labelledby="faq"><div className="sa-section__head"><h2 className="sa-h2" id="faq">Frequently asked questions</h2></div><Faq items={faqs} /></section>

        <nav className="sa-section" aria-label="Related integrations" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sa-space-4)' }}>
          {[
            ['AI Workflow Security', '/ai-workflow-security'], ['n8n Integration', '/integrations/n8n'],
            ['Zapier Integration', '/integrations/zapier'], ['AI Agent Security', '/ai-agent-security'], ['Limitations', '/limitations'],
          ].map(([label, href]) => <Link className="sa-link" key={href} href={href}>{label}</Link>)}
        </nav>

        <section className="sa-section" aria-labelledby="pilot"><div className="sa-section__head"><h2 className="sa-h2" id="pilot">Start with a non-sensitive scenario</h2><p className="sa-body">Map one input and one reply, then verify both guard results and the stop branches. Adding two modules does not cover other AI steps automatically.</p></div><SaLinkButton href="/signup">Get started free</SaLinkButton></section>
      </main>
    </SaRoot>
  );
}
