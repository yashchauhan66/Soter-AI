import Link from 'next/link';
import type { Metadata } from 'next';
import { CodeBlock } from '@/components/sa/CodeBlock';
import { Faq, faqJsonLd } from '@/components/sa/Faq';
import { Callout, DataTable, SaLinkButton, StatusBadge } from '@/components/sa/primitives';
import { SaRoot } from '@/components/sa/SaRoot';
import { JsonLd } from '@/components/seo/JsonLd';
import { buildMetadata } from '@/lib/seo/metadata';
import { breadcrumbList } from '@/lib/seo/schema';
import { STATUS_MEANING, SURFACES } from '@/lib/sa/surfaces';

const NODE_NPM_URL = 'https://www.npmjs.com/package/n8n-nodes-soterai';
const workflowSurface = SURFACES.find((surface) => surface.href === '/integrations')!;

export const metadata: Metadata = buildMetadata({
  title: 'n8n AI security: SoterAI community node',
  description: 'Install n8n-nodes-soterai (Beta) to check prompts and replies in n8n. Requires a reachable API and a key. Review routing and limits before a pilot.',
  path: '/integrations/n8n',
  keywords: ['n8n ai security', 'n8n prompt injection', 'n8n llm security', 'n8n ai workflow security', 'n8n soterai integration', 'secure n8n ai nodes', 'n8n data leakage prevention', 'n8n-nodes-soterai'],
});

const installSteps = [
  { step: 'Open n8n and go to Settings → Community Nodes', body: 'Use the community node installer where your n8n deployment permits community packages. Check your administrator settings if the installer is unavailable.' },
  { step: 'Install n8n-nodes-soterai', body: 'Click Install a Community Node and enter n8n-nodes-soterai, or find SoterAI in the community node list.' },
  { step: 'Restart n8n if prompted', body: 'Some n8n instances require a restart after installing a community node. After it reloads, SoterAI appears in the node panel.' },
  { step: 'Search for SoterAI in the node panel', body: 'Drag the SoterAI node into your workflow before the AI input or after the AI output you want to inspect. Explicitly map that text into the node.' },
];

const setupSteps = [
  { step: 'Create a SoterAI project and API key', body: 'Sign up at soterai.in, create a project, and generate an API key. Live keys start with ck_live_. Keep the key out of workflow exports.' },
  { step: 'Add a SoterAI API credential in n8n', body: 'In the SoterAI node, create a new SoterAI API credential and paste your API key. Use the n8n credential store rather than embedding the key in workflow text.' },
  { step: 'Keep the default Base URL', body: 'https://soterai.in is pre-filled. Change it only when you run a self-hosted SoterAI API. Optionally set a default Project ID; each node can override it.' },
  { step: 'Run a safe test', body: 'Use synthetic text and non-sensitive test data. Never paste production secrets into test workflows, screenshots or exports.' },
];

const operationRows = [
  ['Universal AI Firewall (Best Protection)', 'Checks the supplied prompt, AI output and optional security context. The operation name is a UI label, not a complete-protection guarantee.'],
  ['Guard Input', 'Check inbound prompts before an AI app receives them. Supports Block, Redact, Warn, or Continue.'],
  ['Guard Output', 'Check AI-generated output before sending, saving, or responding with it. Supports Block, Redact, Warn, or Continue.'],
  ['Redact Secrets or PII', 'Detect and redact recognized sensitive strings such as emails, phone numbers, API keys, and secrets.'],
  ['Get RAG Risk Summary', 'Scan a document or chunk and return trustScore, trustLevel, findings, and a recommended action.'],
  ['Audit n8n Workflow Security', 'Review an exported workflow for AI Agent, tool, webhook, Code node, memory, RAG, credential, and output-egress risks.'],
  ['Analyze Text', 'Analyze a text field and return allowed, riskScore, categories, reason, and safe text without blocking.'],
];

const faqs = [
  { q: 'Do I need to install a package to use the SoterAI node?', a: 'Yes, install the n8n-nodes-soterai community package. Where your deployment allows it, Settings → Community Nodes handles the installation without a command-line step.' },
  { q: 'Where is the SoterAI node available?', a: 'The package is n8n-nodes-soterai on npm: https://www.npmjs.com/package/n8n-nodes-soterai. Community-node availability also depends on your n8n deployment and administrator settings.' },
  { q: 'Which n8n node types does SoterAI work with?', a: 'It is a standalone community node. You can place it before or after OpenAI, Anthropic, Ollama, custom LLM nodes or an AI Agent node. Only the data you map through SoterAI is inspected.' },
  { q: 'Will SoterAI slow down my n8n workflows?', a: 'Each guard step adds an API call and its network and processing time. No end-to-end n8n workflow latency is claimed here. Measure your own workflow, including errors and retries.' },
  { q: 'Does SoterAI work with n8n self-hosted deployments?', a: 'The node supports a custom Base URL for a self-hosted SoterAI API. Your data boundary still depends on the model endpoints, other workflow nodes and your deployment configuration.' },
  { q: 'What happens when the node detects an attack?', a: 'Items the node lets through go to Safe; stopped items go to Flagged. Configure both branches. Redact, Warn or Continue settings may let an item proceed, so detection is not always blocking.' },
];

const features = [
  { title: 'Prompt checks', body: 'Review instruction-override patterns in the text you pass before the model call, including retrieved content.' },
  { title: 'PII and secret redaction', body: 'Find recognized sensitive identifiers in supplied text and route the cleaned value downstream.' },
  { title: 'Output inspection', body: 'Review a model reply before sending, saving or passing it to another node.' },
  { title: 'Workflow audit', body: 'Inspect an exported workflow for configuration risks. A workflow audit is not a runtime containment boundary.' },
];

const exampleWorkflows = [
  { name: 'Basic analyze', body: 'Manual Trigger → SoterAI Analyze Text → IF High Risk.' },
  { name: 'Guard input webhook', body: 'Webhook → SoterAI Guard Input → IF Risk High → Respond to Webhook.' },
  { name: 'Guard output', body: 'Manual Trigger → AI Output Text → SoterAI Guard Output → Save Safe Output.' },
  { name: 'Secret / PII redaction', body: 'Manual Trigger → SoterAI Redact Secrets or PII → IF Secrets Found → Safe Output.' },
  { name: 'Universal AI firewall', body: 'Webhook → SoterAI Universal AI Firewall → blocked / allowed response branches.' },
  { name: 'Workflow security audit', body: 'Manual Trigger → SoterAI Audit n8n Workflow Security → posture report.' },
];

export default function Page() {
  return (
    <SaRoot>
      <JsonLd data={breadcrumbList([
        { name: 'Home', path: '/' }, { name: 'Integrations', path: '/integrations' },
        { name: 'n8n AI Security', path: '/integrations/n8n' },
      ])} />
      <JsonLd data={faqJsonLd(faqs)} />
      <JsonLd data={{
        '@context': 'https://schema.org', '@type': 'HowTo',
        name: 'How to install and use the SoterAI community node in n8n',
        description: 'Install the community package and configure guard steps for the text routed through an n8n workflow.',
        step: installSteps.map((item, i) => ({ '@type': 'HowToStep', position: i + 1, name: item.step, text: item.body })),
      }} />
      <main className="sa-page" style={{ paddingBlock: 'var(--sa-space-7) var(--sa-space-9)' }}>
        <header>
          <p className="sa-eyebrow">Integration · n8n <StatusBadge status={workflowSurface.status} /></p>
          <h1 className="sa-h1" style={{ marginTop: 'var(--sa-space-3)' }}>SoterAI community node for n8n.</h1>
          <p className="sa-lede" style={{ marginTop: 'var(--sa-space-4)' }}>
            Install <code>n8n-nodes-soterai</code> and put a guard before the prompt or after the reply
            you want to check. A reachable SoterAI API, credentials and explicit routing are required.
          </p>
          <div className="sa-hero__actions">
            <a href={NODE_NPM_URL} target="_blank" rel="noopener noreferrer" className="sa-btn sa-btn--primary">View the node →</a>
            <SaLinkButton href="/signup" variant="secondary">Get your API key</SaLinkButton>
          </div>
          <p className="sa-body sa-muted" style={{ marginTop: 'var(--sa-space-4)' }}>{STATUS_MEANING.find((item) => item.status === workflowSurface.status)?.meaning}</p>
        </header>
        <section className="sa-section" aria-labelledby="checks">
          <div className="sa-section__head"><h2 className="sa-h2" id="checks">What the node checks</h2></div>
          <ul className="sa-rules sa-rules--2">{features.map((item) => <li key={item.title}><h3>{item.title}</h3><p className="sa-body">{item.body}</p></li>)}</ul>
        </section>
        <section className="sa-section" aria-labelledby="install">
          <div className="sa-section__head"><h2 className="sa-h2" id="install">Install the node from n8n</h2></div>
          <ol className="sa-steps">{installSteps.map((item) => <li key={item.step}><div><h3>{item.step}</h3><p className="sa-body">{item.body}</p></div></li>)}</ol>
          <p className="sa-body" style={{ marginTop: 'var(--sa-space-5)' }}>Direct package link: <a className="sa-link" href={NODE_NPM_URL} target="_blank" rel="noopener noreferrer">{NODE_NPM_URL}</a></p>
        </section>
        <section className="sa-section" aria-labelledby="credentials">
          <div className="sa-section__head"><h2 className="sa-h2" id="credentials">Set up credentials</h2></div>
          <ol className="sa-steps">{setupSteps.map((item) => <li key={item.step}><div><h3>{item.step}</h3><p className="sa-body">{item.body}</p></div></li>)}</ol>
          <div style={{ marginTop: 'var(--sa-space-5)' }}><Callout title="Keep credentials out of exports">Use n8n credentials for the API key. Check workflow exports and screenshots before sharing them.</Callout></div>
        </section>
        <section className="sa-section" aria-labelledby="operations">
          <div className="sa-section__head"><h2 className="sa-h2" id="operations">Use the node in a workflow</h2></div>
          <DataTable caption="SoterAI n8n operations" columns={[{ key: 'name', header: 'Operation' }, { key: 'purpose', header: 'Purpose' }]} rows={operationRows.map(([name, purpose]) => ({ name, purpose }))} />
          <h3 className="sa-h3" style={{ marginBlock: 'var(--sa-space-6) var(--sa-space-3)' }}>Input and output placement</h3>
          <CodeBlock label="Workflow placement" code={`User/Webhook Input
  → SoterAI Universal AI Firewall (Input Text = user message)
  → LLM
  → SoterAI Universal AI Firewall (AI Output Text = model response)
  → Respond / Tool / Memory`} />
          <p className="sa-body" style={{ marginTop: 'var(--sa-space-4)' }}>
            Choose <strong>Universal AI Firewall (Best Protection)</strong>, map <strong>Input Text</strong>,
            and add <strong>AI Output Text (Optional)</strong> for the model response. <strong>Maximum Protection</strong>
            and <strong>On Threat = Block</strong> are settings to evaluate in your pilot, not a promise of complete protection.
            Optional RAG, tool, memory and destination fields are under <strong>Security Context</strong>.
          </p>
          <h3 className="sa-h3" style={{ marginBlock: 'var(--sa-space-6) var(--sa-space-3)' }}>Safe and Flagged outputs</h3>
          <CodeBlock label="Output routing" code={`                    ┌─ Safe ────► rest of your workflow
Webhook ──► SoterAI ─┤
                    └─ Flagged ─► respond "blocked", log, or leave unconnected`} />
          <ul className="sa-list sa-body" style={{ marginTop: 'var(--sa-space-4)' }}>
            <li>Safe contains items the node lets through. Use <code>{'{{ $json.outputText }}'}</code> downstream for the cleaned or redacted value.</li>
            <li>Flagged contains stopped items. Connect it to a response or logging branch, or leave it unconnected to drop them.</li>
            <li>Redact, Warn or Continue can keep an item on Safe. Test each setting; a Safe output is not a guarantee that the text is harmless.</li>
          </ul>
        </section>
        <section className="sa-section" aria-labelledby="examples">
          <div className="sa-section__head"><h2 className="sa-h2" id="examples">Example workflows</h2><p className="sa-body">Import a workflow from <code>examples/</code> in the package, then check its credentials and output branches.</p></div>
          <ul className="sa-rules sa-rules--2">{exampleWorkflows.map((item) => <li key={item.name}><h3>{item.name}</h3><p className="sa-body">{item.body}</p></li>)}</ul>
        </section>
        <section className="sa-section" aria-labelledby="limits">
          <div className="sa-section__head"><h2 className="sa-h2" id="limits">Limitations</h2></div>
          <Callout kind="limit" title="Only the routed data is inspected">Workflow branches that bypass the guard are out of scope. Detection can miss attacks or flag benign text. Each guard adds an API call. Test timeouts, errors, retries and both output branches before a production rollout.</Callout>
        </section>
        <section className="sa-section" aria-labelledby="faq">
          <div className="sa-section__head"><h2 className="sa-h2" id="faq">Frequently asked questions</h2></div>
          <Faq items={faqs} />
        </section>
        <nav className="sa-section" aria-label="Related integrations" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sa-space-4)' }}>
          {[
            ['AI Workflow Security', '/ai-workflow-security'], ['AI Agent Security', '/ai-agent-security'],
            ['Integrations', '/integrations'], ['Zapier Integration', '/integrations/zapier'],
            ['Make.com Integration', '/integrations/make'], ['Limitations', '/limitations'],
          ].map(([label, href]) => <Link key={href} className="sa-link" href={href}>{label}</Link>)}
        </nav>
        <section className="sa-section" aria-labelledby="pilot">
          <div className="sa-section__head"><h2 className="sa-h2" id="pilot">Start with a test workflow</h2><p className="sa-body">Install the community node, create your SoterAI project and check non-sensitive input before relying on the routing.</p></div>
          <div className="sa-hero__actions">
            <a href={NODE_NPM_URL} target="_blank" rel="noopener noreferrer" className="sa-btn sa-btn--primary">View the node →</a>
            <SaLinkButton href="/signup" variant="secondary">Get started free</SaLinkButton>
          </div>
        </section>
      </main>
    </SaRoot>
  );
}

