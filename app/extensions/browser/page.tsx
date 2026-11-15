import type { Metadata } from 'next';
import Link from 'next/link';
import { Callout, DataTable, SaLinkButton, StatusBadge } from '@/components/sa/primitives';
import { SaRoot } from '@/components/sa/SaRoot';
import { buildMetadata } from '@/lib/seo/metadata';
import { STATUS_MEANING, SURFACES } from '@/lib/sa/surfaces';

const browserSurface = SURFACES.find((surface) => surface.href === '/extensions/browser')!;

export const metadata: Metadata = buildMetadata({
  title: 'Browser Guard for Chrome and Edge',
  description: 'Browser Guard (Beta) checks supplied AI text in Chrome and Edge. Review supported pages, redaction, privacy settings and coverage limits before use.',
  path: '/extensions/browser',
});
const CAPABILITIES = [
  { title: 'Prompt scanning', copy: 'Review recognized injection, jailbreak and sensitive-data patterns on supported AI pages. Checks depend on the page adapter and the text it can inspect.' },
  { title: 'Redaction preview', copy: 'Review detected secrets and PII, then use the available cleaned text. Detection can miss sensitive values or flag benign text.' },
  { title: 'Policy status', copy: 'Inspect cached policy and decision state in the side panel. Test the approval and send paths in your own configuration.' },
  { title: 'AI-use visibility', copy: 'Review supported AI activity and unapproved-tool signals. This is visibility within extension coverage, not a record of every application or browser action.' },
];
const PRIVACY_PROOF = [
  { label: 'Raw prompt to SoterAI', value: 'Not sent by default' },
  { label: 'Scanning location', value: 'In your browser first' },
  { label: 'Stored locally', value: 'Redacted preview, safe rewrite, hashes, policy cache' },
  { label: 'Backend audit event', value: 'Metadata, decision, risk score, redacted preview' },
];

export default function BrowserExtensionPage() {
  return (
    <SaRoot>
      <main className="sa-page" style={{ paddingBlock: 'var(--sa-space-7) var(--sa-space-9)' }}>
        <nav className="sa-label" aria-label="Breadcrumb" style={{ marginBottom: 'var(--sa-space-5)' }}><Link href="/" className="sa-link">SoterAI</Link> / Browser Guard</nav>
        <header>
          <p className="sa-eyebrow">Browser Guard <StatusBadge status={browserSurface.status} /> · Local-first</p>
          <h1 className="sa-h1" style={{ marginTop: 'var(--sa-space-3)' }}>Check AI text before you send it.</h1>
          <p className="sa-lede" style={{ marginTop: 'var(--sa-space-4)' }}>Browser Guard adds prompt checks, redaction previews and policy visibility on supported AI pages. Runtime testing is for Chrome and Edge only. It is not universal interception of every AI conversation.</p>
          <div className="sa-hero__actions"><SaLinkButton href="/extensions/browser/chrome" large>Install for Chrome →</SaLinkButton><SaLinkButton href="/extensions/browser/edge" variant="secondary">Install for Microsoft Edge</SaLinkButton></div>
          <p className="sa-body sa-muted" style={{ marginTop: 'var(--sa-space-4)' }}>{STATUS_MEANING.find((item) => item.status === browserSurface.status)?.meaning}</p>
        </header>

        <section className="sa-section" aria-labelledby="browsers">
          <div className="sa-section__head"><h2 className="sa-h2" id="browsers">Choose your browser</h2><p className="sa-body">Open the install guide and store listing for your browser. Review permissions and use non-sensitive content for your first check.</p></div>
          <ul className="sa-rules sa-rules--2">
            <li><Link href="/extensions/browser/chrome" className="sa-link" style={{ display: 'block', textDecoration: 'none' }}><h3>Google Chrome</h3><p className="sa-label">Chrome Web Store</p><p className="sa-body" style={{ marginTop: 'var(--sa-space-3)' }}>Use the Chrome install guide for store installation or the unpacked deployment option.</p><p className="sa-label" style={{ marginTop: 'var(--sa-space-4)' }}>Install for Chrome →</p></Link></li>
            <li><Link href="/extensions/browser/edge" className="sa-link" style={{ display: 'block', textDecoration: 'none' }}><h3>Microsoft Edge</h3><p className="sa-label">Edge Add-ons</p><p className="sa-body" style={{ marginTop: 'var(--sa-space-3)' }}>Use the Edge install guide for store installation or the unpacked deployment option.</p><p className="sa-label" style={{ marginTop: 'var(--sa-space-4)' }}>Install for Edge →</p></Link></li>
          </ul>
        </section>

        <section className="sa-section" aria-labelledby="checks">
          <div className="sa-section__head"><h2 className="sa-h2" id="checks">Checks and controls you can inspect</h2><p className="sa-body">Use the side panel to review scan history, policy status and self-test results. Check the actual send path on each AI page you plan to use.</p></div>
          <ul className="sa-rules sa-rules--2">{CAPABILITIES.map((item) => <li key={item.title}><h3>{item.title}</h3><p className="sa-body">{item.copy}</p></li>)}</ul>
          <div style={{ marginTop: 'var(--sa-space-5)' }}><Callout kind="limit" title="Limited browser and page coverage">{browserSurface.gap} Page changes, unsupported tools and paths that bypass the extension can leave text unchecked. A scan result does not guarantee that a prompt is harmless or that a secret cannot leave the machine.</Callout></div>
        </section>

        <section className="sa-section" aria-labelledby="privacy">
          <div className="sa-section__head"><h2 className="sa-h2" id="privacy">What does SoterAI receive by default?</h2><p className="sa-body">The extension starts with browser-local scanning and avoids retaining raw prompt text by default. Review your policy and any optional cloud settings before handling sensitive data.</p></div>
          <DataTable caption="Browser Guard default data boundary" columns={[{ key: 'label', header: 'Data path' }, { key: 'value', header: 'Default behavior' }]} rows={PRIVACY_PROOF} />
          <p className="sa-body" style={{ marginTop: 'var(--sa-space-5)' }}>This describes the extension&apos;s SoterAI data path, not the AI provider&apos;s. Sending a prompt to an AI tool still shares it with that tool. The extension does not replace the provider&apos;s privacy controls or your access policy.</p>
          <div className="sa-hero__actions"><SaLinkButton href="/privacy" variant="secondary">Read privacy policy ↗</SaLinkButton></div>
        </section>

        <section className="sa-section" aria-labelledby="other-surfaces">
          <div className="sa-section__head"><h2 className="sa-h2" id="other-surfaces">Put checks on the other paths you use</h2><p className="sa-body">IDE Guard, workflow guards and the REST API have different maturity and coverage boundaries. Combining them does not create complete protection.</p></div>
          <div className="sa-hero__actions"><SaLinkButton href="/extensions/ide" variant="secondary">IDE Guard</SaLinkButton><SaLinkButton href="/integrations" variant="secondary">Integrations</SaLinkButton><SaLinkButton href="/docs/rest-api" variant="secondary">REST API</SaLinkButton></div>
        </section>
      </main>
    </SaRoot>
  );
}
