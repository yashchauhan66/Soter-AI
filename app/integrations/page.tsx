import type { Metadata } from 'next';
import Link from 'next/link';
import { PLAYGROUND_CTA_LABEL } from '@/lib/marketing/cta';
import { DataTable, SaLinkButton, StatusBadge, type Status } from '@/components/sa/primitives';
import { SaRoot } from '@/components/sa/SaRoot';
import { JsonLd } from '@/components/seo/JsonLd';
import { buildMetadata } from '@/lib/seo/metadata';
import { breadcrumbList } from '@/lib/seo/schema';

/**
 * Integrations hub. One table per kind of place the engine can run, each row with its
 * status. Statuses follow public/llms.txt: the REST API and SDKs are Stable; the IDE and
 * browser extensions, and the n8n, Make and Zapier guards, are Beta.
 *
 * Title: 52 characters with the brand suffix. Description: 150.
 */
export const metadata: Metadata = buildMetadata({
  title: 'Integrations: n8n, Make, Zapier, SDKs, IDE',
  description:
    'Where SoterAI runs: n8n, Make and Zapier workflows, JavaScript and Python SDKs, framework middleware, VS Code and Chrome. Each row shows its status.',
  path: '/integrations',
});

interface Row {
  name: string;
  href: string;
  status: Status | null;
  does: string;
  note: string;
}

const WORKFLOWS: Row[] = [
  {
    name: 'n8n',
    href: '/integrations/n8n',
    status: 'Beta',
    does: 'A community node that checks prompts and replies inside an n8n workflow.',
    note: 'Package n8n-nodes-soterai. Needs a reachable API and a key.',
  },
  {
    name: 'Make',
    href: '/integrations/make',
    status: 'Beta',
    does: 'Calls the API from a scenario through the HTTP module.',
    note: 'A guide, not a native module.',
  },
  {
    name: 'Zapier',
    href: '/integrations/zapier',
    status: 'Beta',
    does: 'Checks the input and output of an AI step in a Zap.',
    note: 'A guide, not a native app.',
  },
];

const CODE: Row[] = [
  {
    name: 'REST API',
    href: '/docs/rest-api',
    status: 'Stable',
    does: 'Works from any language or tool that can send an HTTP request.',
    note: 'Needs an API key.',
  },
  {
    name: 'JavaScript and TypeScript SDK',
    href: '/docs/js',
    status: 'Stable',
    does: 'Check input, check output, decide whether to block. Also used with LangChain.',
    note: 'Package @soterai/core.',
  },
  {
    name: 'Python SDK',
    href: '/docs/python',
    status: 'Stable',
    does: 'A protect_chat helper that wraps your model call.',
    note: 'Package soter.',
  },
  {
    name: 'Next.js and the Vercel AI SDK',
    href: '/docs/nextjs',
    status: 'Stable',
    does: 'Middleware for routes that call a model.',
    note: 'No streaming latency has been measured.',
  },
  {
    name: 'FastAPI',
    href: '/docs/fastapi',
    status: 'Stable',
    does: 'Python middleware for FastAPI apps that call a model.',
    note: 'See the docs for the current version.',
  },
  {
    name: 'Express',
    href: '/docs/express',
    status: 'Stable',
    does: 'Node.js middleware for Express routes that call a model.',
    note: 'See the docs for the current version.',
  },
  {
    name: 'WordPress',
    href: '/docs/wordpress',
    status: null,
    does: 'A plugin for sites that use an AI model.',
    note: 'No status is published for this one. Read the docs before you rely on it.',
  },
];

const EDITORS: Row[] = [
  {
    name: 'IDE Guard',
    href: '/extensions/ide',
    status: 'Beta',
    does: 'Finds secrets and personal data before they reach an AI assistant in VS Code.',
    note: 'Other editors are not tested.',
  },
  {
    name: 'Browser Guard',
    href: '/extensions/browser',
    status: 'Beta',
    does: 'Visibility and control for AI use in Chrome and Edge.',
    note: 'Tested on those two browsers only.',
  },
];

function table(caption: string, rows: Row[]) {
  return (
    <DataTable
      caption={caption}
      columns={[
        { key: 'name', header: 'Integration' },
        { key: 'status', header: 'Status' },
        { key: 'does', header: 'What it does' },
        { key: 'note', header: 'Note' },
      ]}
      rows={rows.map((r) => ({
        name: (
          <Link className="sa-link" href={r.href}>
            {r.name}
          </Link>
        ),
        status: r.status ? <StatusBadge status={r.status} /> : 'Not rated',
        does: r.does,
        note: r.note,
      }))}
    />
  );
}

export default function IntegrationsPage() {
  return (
    <SaRoot>
      <JsonLd
        data={breadcrumbList([
          { name: 'Home', path: '/' },
          { name: 'Integrations', path: '/integrations' },
        ])}
      />
      <main className="sa-page" style={{ paddingBlock: 'var(--sa-space-7) var(--sa-space-9)' }}>
        <header>
          <p className="sa-eyebrow">Integrations</p>
          <h1 className="sa-h1" style={{ marginTop: 'var(--sa-space-3)' }}>
            Put the check where your team already works.
          </h1>
          <p className="sa-lede" style={{ marginTop: 'var(--sa-space-4)' }}>
            One engine and one policy, reached from workflows, code, an editor or a browser. Each row shows how mature it is and what it
            does not do yet.
          </p>
          <div className="sa-hero__actions">
            <SaLinkButton href="/docs/quickstart" large>
              Open the quickstart
            </SaLinkButton>
            <SaLinkButton href="/playground" variant="ghost">
              {PLAYGROUND_CTA_LABEL}
            </SaLinkButton>
          </div>
        </header>

        <section className="sa-section" aria-labelledby="workflows">
          <div className="sa-section__head">
            <h2 className="sa-h2" id="workflows">
              Automation workflows
            </h2>
            <p className="sa-body sa-muted">
              Guard steps for people who build with n8n, Make or Zapier. Interfaces may change while these are in Beta.
            </p>
          </div>
          {table('Automation workflow integrations and their status', WORKFLOWS)}
        </section>

        <section className="sa-section" aria-labelledby="code">
          <div className="sa-section__head">
            <h2 className="sa-h2" id="code">
              Code, SDKs and frameworks
            </h2>
          </div>
          {table('SDK and framework integrations and their status', CODE)}
        </section>

        <section className="sa-section" aria-labelledby="editors">
          <div className="sa-section__head">
            <h2 className="sa-h2" id="editors">
              Editors and browsers
            </h2>
          </div>
          {table('Editor and browser extensions and their status', EDITORS)}
        </section>

        <section className="sa-section" aria-labelledby="missing">
          <div className="sa-section__head">
            <h2 className="sa-h2" id="missing">
              Not on the list?
            </h2>
            <p className="sa-body">
              Anything that can send an HTTP request can call the <Link className="sa-link" href="/docs/rest-api">REST API</Link>.
              If you want a native integration, <Link className="sa-link" href="/contact">tell us which one</Link>. Nothing is promised
              on a date.
            </p>
          </div>
          <p className="sa-body sa-muted">
            What Stable, Beta and Labs mean is on the <Link className="sa-link" href="/limitations">limits page</Link>.
          </p>
        </section>
      </main>
    </SaRoot>
  );
}
