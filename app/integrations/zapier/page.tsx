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
  title: 'Zapier AI security: webhook integration',
  description: 'A Beta guide to checking Zapier AI inputs and replies through webhooks. Configure credentials and Filter steps; unguarded branches stay out of scope.',
  path: '/integrations/zapier',
  keywords: ['zapier ai security', 'zapier prompt injection', 'zapier llm security', 'zapier ai automation security', 'secure zapier ai actions', 'zapier data leakage prevention', 'soterai zapier integration'],
});
const faqs = [
  { q: 'How does SoterAI integrate with Zapier?', a: 'Use Webhooks by Zapier to POST the mapped input or model reply to SoterAI, then configure a Filter or explicit decision branch. This is a guide, not a native app. Check your Zapier plan for webhook availability.' },
  { q: 'Can SoterAI stop a Zapier workflow if it detects an attack?', a: 'A Filter by Zapier step can stop the Zap when the result does not meet your allow conditions. The API verdict alone does not stop downstream actions; you must configure and test the Filter and HTTP error paths.' },
  { q: 'Does SoterAI detect India-specific PII in Zapier workflows?', a: 'The guard checks supplied text for recognized patterns, including Aadhaar-pattern numbers, PAN, GSTIN, UPI IDs, IFSC codes and Indian mobile numbers. Pattern detection can miss real data or flag benign text; evaluate it on non-sensitive examples from your use case.' },
  { q: 'Is there a Zapier native app for SoterAI?', a: 'No native app is offered by this guide. The integration uses Webhooks by Zapier today. No native-app release date is promised here.' },
];
const steps = [
  { step: 'Get your SoterAI API key', body: 'Sign up at soterai.in and create a project. Keep the API key in secure configuration. Use the REST guide configuration names SOTER_BASE_URL and SOTER_API_KEY.' },
  { step: 'Add a Webhooks step before your AI action', body: 'Add Webhooks by Zapier > POST before the AI action. Set the URL to your SOTER_BASE_URL followed by /api/guard/input.' },
  { step: 'Configure the webhook payload', body: 'Set Payload Type to JSON. Map the incoming text into the message field. Add the x-api-key header using your securely stored SOTER_API_KEY value. Do not send the placeholder name as the key.' },
  { step: 'Add a Filter to halt blocked requests', body: 'Configure Filter by Zapier to continue only when a valid response has allowed exactly true and action exactly ALLOW. For action ALLOW_WITH_REDACTION, require allowed exactly true and a non-empty redactedText or safeText; pass only that cleaned text through an explicit branch. For action REWRITE, require allowed exactly true and a non-empty safeText; pass only that rewritten text through an explicit branch. Stop on BLOCK or HUMAN_REVIEW. Stop when allowed is false or missing, the action is unknown or missing, required cleaned text is absent, or the result is invalid or unavailable.' },
  { step: 'Guard the AI output', body: 'After the AI action, POST to /api/guard/output with the reply mapped into aiResponse. Add the same verdict checks before downstream actions. Ensure an HTTP failure cannot fall through to the AI or delivery step.' },
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
  { title: 'Input guard', body: 'Review the mapped input for known prompt-injection and jailbreak patterns before the AI action.' },
  { title: 'PII detection', body: 'Find recognized sensitive identifiers in text supplied through the webhook. Detection is not a data-authorization boundary.' },
  { title: 'Output guard', body: 'Inspect a mapped model reply before sending it to another Zapier action.' },
  { title: 'Decision evidence', body: 'Review guard decisions in SoterAI. Retention and export availability depend on your plan and configuration.' },
];
export default function Page() {
  return (
    <SaRoot>
      <JsonLd data={breadcrumbList([
        { name: 'Home', path: '/' }, { name: 'Integrations', path: '/integrations' },
        { name: 'Zapier AI Security', path: '/integrations/zapier' },
      ])} />
      <JsonLd data={faqJsonLd(faqs)} />
      <JsonLd data={{
        '@context': 'https://schema.org', '@type': 'HowTo', name: 'How to add SoterAI AI security to Zapier workflows',
        description: 'Configure webhook requests, authentication and explicit Filter steps for supplied AI text.',
        step: steps.map((item, i) => ({ '@type': 'HowToStep', position: i + 1, name: item.step, text: item.body })),
      }} />
      <main className="sa-page" style={{ paddingBlock: 'var(--sa-space-7) var(--sa-space-9)' }}>
        <header>
          <p className="sa-eyebrow">Integration · Zapier <StatusBadge status={workflowSurface.status} /></p>
          <h1 className="sa-h1" style={{ marginTop: 'var(--sa-space-3)' }}>Put a check around the AI step in your Zap.</h1>
          <p className="sa-lede" style={{ marginTop: 'var(--sa-space-4)' }}>Use Webhooks by Zapier to check a prompt before the model and a reply before delivery. This is a guide, not a native app. You configure the credentials, mapped text and Filter steps.</p>
          <div className="sa-hero__actions"><SaLinkButton href="/signup">Get your API key</SaLinkButton><SaLinkButton href="/docs/rest-api" variant="secondary">REST API docs</SaLinkButton></div>
          <p className="sa-body sa-muted" style={{ marginTop: 'var(--sa-space-4)' }}>{STATUS_MEANING.find((item) => item.status === workflowSurface.status)?.meaning}</p>
        </header>
        <section className="sa-section" aria-labelledby="checks"><div className="sa-section__head"><h2 className="sa-h2" id="checks">What the webhook steps check</h2></div><ul className="sa-rules sa-rules--2">{features.map((item) => <li key={item.title}><h3>{item.title}</h3><p className="sa-body">{item.body}</p></li>)}</ul></section>
        <section className="sa-section" aria-labelledby="setup"><div className="sa-section__head"><h2 className="sa-h2" id="setup">How to integrate with Zapier</h2></div><ol className="sa-steps">{steps.map((item) => <li key={item.step}><div><h3>{item.step}</h3><p className="sa-body">{item.body}</p></div></li>)}</ol></section>
        <section className="sa-section" aria-labelledby="requests"><div className="sa-section__head"><h2 className="sa-h2" id="requests">The documented HTTP requests</h2><p className="sa-body">These curl equivalents use the REST documentation&apos;s environment-variable names. In Zapier, substitute configured values and map the input or reply field. They are request examples, not captured engine responses.</p></div><div className="sa-cols sa-cols--2"><CodeBlock label="Input request" language="bash" code={inputRequest} /><CodeBlock label="Output request" language="bash" code={outputRequest} /></div></section>
        <section className="sa-section" aria-labelledby="limits"><div className="sa-section__head"><h2 className="sa-h2" id="limits">Limitations</h2></div><Callout kind="limit" title="The Filter is not optional">Steps that bypass the guard are not covered. Detection can miss attacks or flag benign text. Webhooks by Zapier may require a paid plan. Each guard adds an API call; test latency, ALLOW, ALLOW_WITH_REDACTION, REWRITE, BLOCK and HUMAN_REVIEW, missing or empty cleaned text, allowed false or missing, invalid or unavailable responses and API failures in your own Zap.</Callout></section>
        <section className="sa-section" aria-labelledby="faq"><div className="sa-section__head"><h2 className="sa-h2" id="faq">Frequently asked questions</h2></div><Faq items={faqs} /></section>
        <nav className="sa-section" aria-label="Related integrations" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sa-space-4)' }}>
          {[
            ['AI Workflow Security', '/ai-workflow-security'], ['n8n Integration', '/integrations/n8n'],
            ['Make.com Integration', '/integrations/make'], ['AI Agent Security', '/ai-agent-security'], ['Limitations', '/limitations'],
          ].map(([label, href]) => <Link className="sa-link" key={href} href={href}>{label}</Link>)}
        </nav>
        <section className="sa-section" aria-labelledby="pilot"><div className="sa-section__head"><h2 className="sa-h2" id="pilot">Pilot one guarded path first</h2><p className="sa-body">Use non-sensitive text and verify that each Filter stops rejected or unavailable results. Two webhooks do not automatically cover other AI actions or branches.</p></div><SaLinkButton href="/signup">Get started free</SaLinkButton></section>
      </main>
    </SaRoot>
  );
}

