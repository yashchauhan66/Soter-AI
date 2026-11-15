import type { Metadata } from 'next';
import Link from 'next/link';
import { PLAYGROUND_CTA_LABEL } from '@/lib/marketing/cta';
import { Callout, DataTable, SaLinkButton } from '@/components/sa/primitives';
import { SaRoot } from '@/components/sa/SaRoot';
import { JsonLd } from '@/components/seo/JsonLd';
import { buildMetadata } from '@/lib/seo/metadata';
import { breadcrumbList } from '@/lib/seo/schema';

/**
 * Trust center. It lists what exists and what does not, in that order of honesty:
 * certifications and audits first, then data handling, controls and deployment.
 *
 * What the old page showed and this one does not:
 *  - A green "OPERATIONAL" light and progress meters (100%, 100%, 90%). They were fixed
 *    values, not live data, and a meter for "OWASP aligned" had no measurement behind it.
 *    Live service status is on /status.
 *  - A "Secrets hygiene" control that said the repository is scanned for keys. Not verified.
 *
 * Title: 50 characters with the brand suffix. Description: 152.
 */
export const metadata: Metadata = buildMetadata({
  title: 'Trust Center: What We Hold and Do Not',
  description:
    'Certifications and audits we hold (none yet), how data is handled, the security controls we run, deployment options, and how to report a vulnerability.',
  path: '/trust',
});

const HELD: Array<{ item: string; status: string; note: React.ReactNode }> = [
  {
    item: 'SOC 2',
    status: 'Not held',
    note: (
      <>
        Readiness content only. See <Link className="sa-link" href="/compliance/soc2-readiness">SOC 2 readiness</Link>.
      </>
    ),
  },
  {
    item: 'ISO 27001',
    status: 'Not held',
    note: (
      <>
        Readiness content only. See <Link className="sa-link" href="/compliance/iso27001-readiness">ISO 27001 readiness</Link>.
      </>
    ),
  },
  { item: 'HIPAA', status: 'Not held', note: 'No HIPAA certification or business associate program is claimed.' },
  {
    item: 'External penetration test',
    status: 'No independent report',
    note: 'Self-testing is tracked separately. Enterprise claims stay blocked until an independent report exists.',
  },
  {
    item: 'Independent benchmark validation',
    status: 'None',
    note: (
      <>
        Every test is self-written. See the <Link className="sa-link" href="/benchmarks">numbers and their limits</Link>.
      </>
    ),
  },
  {
    item: 'OWASP LLM Top 10',
    status: 'Mapping, not certification',
    note: (
      <>
        An alignment mapping of what the engine does and does not cover. See{' '}
        <Link className="sa-link" href="/compliance/owasp-llm-top-10">OWASP LLM Top 10</Link>.
      </>
    ),
  },
  {
    item: 'Marketplace listing',
    status: 'Listed, Beta',
    note: 'IDE Guard is listed on the VS Code Marketplace. No marketplace approval or endorsement is claimed beyond the listing.',
  },
];

const DATA_HANDLING = [
  'Guard analysis runs inline. Request text is checked against detection rules and is not used to train models.',
  'Sensitive values such as personal data and secrets are redacted before logs are saved. Original text is not stored on redaction paths.',
  'Audit logs and reports are scoped per project and per organization, with ownership checks on every read.',
  'Retention is configurable. Enterprise workspaces can set automatic purge windows for guard logs.',
  'The public playground sends your text to the soterai.in server and is rate limited. Use sample data. To keep text on your own systems, self-host.',
];

const CONTROLS: Array<{ title: string; desc: string }> = [
  {
    title: 'Layered detection',
    desc: 'Rules for prompt injection, jailbreaks, encoding and obfuscation, multilingual attacks, personal data, secrets and unsafe output. Detection is heuristic and misses things.',
  },
  {
    title: 'Transport and headers',
    desc: 'HSTS in production, a strict Content-Security-Policy, X-Frame-Options DENY, nosniff and a locked-down Permissions-Policy.',
  },
  {
    title: 'Authentication and authorization',
    desc: 'Session-based sign-in with CSRF protection. Per-project API keys are stored only as hashes.',
  },
  {
    title: 'Signed audit exports',
    desc: 'HMAC-signed JSONL and CSV exports, so SIEM and compliance pipelines can check integrity.',
  },
  {
    title: 'Agent controls',
    desc: 'Tool-call authorization, agent passports and approvals for autonomous workflows before risky actions run. The MCP and agent guard is in Labs.',
  },
];

const DEPLOYMENT: Array<{ mode: string; detail: string }> = [
  { mode: 'Hosted by SoterAI', detail: 'Hosted guard API, dashboard and audit storage. The quickest way to start.' },
  { mode: 'Self-hosted', detail: 'Run the stack yourself with Docker, Postgres and Redis, with an optional vector store, for data residency and isolation.' },
  { mode: 'Hybrid', detail: 'Check text in your own code with the SDK, with central policy and audit.' },
];

export default function TrustPage() {
  return (
    <SaRoot>
      <JsonLd
        data={breadcrumbList([
          { name: 'Home', path: '/' },
          { name: 'Trust center', path: '/trust' },
        ])}
      />
      <main className="sa-page" style={{ paddingBlock: 'var(--sa-space-7) var(--sa-space-9)' }}>
        <header>
          <p className="sa-eyebrow">Evidence</p>
          <h1 className="sa-h1" style={{ marginTop: 'var(--sa-space-3)' }}>
            What we hold, and what we do not.
          </h1>
          <p className="sa-lede" style={{ marginTop: 'var(--sa-space-4)' }}>
            SoterAI is built and run by one person. This page lists the certifications and audits that exist (none yet), how data
            is handled, the controls we run, and how to report a vulnerability. You remain responsible for secure design, access
            control, monitoring and human oversight.
          </p>
          <div className="sa-hero__actions">
            <SaLinkButton href="/benchmarks" large>
              Read the numbers and limits
            </SaLinkButton>
            <SaLinkButton href="/status" variant="ghost">
              Live service status
            </SaLinkButton>
          </div>
        </header>

        <section className="sa-section" aria-labelledby="held">
          <div className="sa-section__head">
            <h2 className="sa-h2" id="held">
              Certifications and audits
            </h2>
            <p className="sa-body sa-muted">This table does not show live status. The status page does.</p>
          </div>
          <DataTable
            caption="Certifications, audits and listings: what exists today"
            columns={[
              { key: 'item', header: 'Item' },
              { key: 'status', header: 'Status' },
              { key: 'note', header: 'Note' },
            ]}
            rows={HELD}
          />
        </section>

        <section className="sa-section" aria-labelledby="data">
          <div className="sa-section__head">
            <h2 className="sa-h2" id="data">
              Data handling
            </h2>
          </div>
          <ul className="sa-rules">
            {DATA_HANDLING.map((d) => (
              <li key={d}>
                <p>{d}</p>
              </li>
            ))}
          </ul>
          <p className="sa-body sa-muted" style={{ marginTop: 'var(--sa-space-4)' }}>
            Terms and detail: <Link className="sa-link" href="/privacy">privacy policy</Link>,{' '}
            <Link className="sa-link" href="/subprocessors">subprocessors</Link>,{' '}
            <Link className="sa-link" href="/data-retention">data retention</Link>.
          </p>
        </section>

        <section className="sa-section" aria-labelledby="controls">
          <div className="sa-section__head">
            <h2 className="sa-h2" id="controls">
              Security controls
            </h2>
          </div>
          <ul className="sa-rules sa-rules--2">
            {CONTROLS.map((c) => (
              <li key={c.title}>
                <h3>{c.title}</h3>
                <p>{c.desc}</p>
              </li>
            ))}
          </ul>
          <p className="sa-body sa-muted" style={{ marginTop: 'var(--sa-space-4)' }}>
            More on <Link className="sa-link" href="/security">security</Link>. What the controls miss is on the{' '}
            <Link className="sa-link" href="/limitations">limits page</Link>.
          </p>
        </section>

        <section className="sa-section" aria-labelledby="deploy">
          <div className="sa-section__head">
            <h2 className="sa-h2" id="deploy">
              Deployment options
            </h2>
          </div>
          <ul className="sa-rules sa-rules--2">
            {DEPLOYMENT.map((d) => (
              <li key={d.mode}>
                <h3>{d.mode}</h3>
                <p>{d.detail}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="sa-section" aria-labelledby="disclosure">
          <div className="sa-section__head">
            <h2 className="sa-h2" id="disclosure">
              Report a vulnerability
            </h2>
          </div>
          <Callout kind="note" title="Security contact">
            Email <a className="sa-link" href="mailto:support@soterai.in">support@soterai.in</a> with the affected URL, the impact,
            steps to reproduce, and whether any data was accessed. Test only systems you own or may assess. Do not access, change,
            delete or copy data that is not yours. Read the{' '}
            <Link className="sa-link" href="/responsible-disclosure">full disclosure policy</Link>.
          </Callout>
        </section>

        <section className="sa-closing" aria-labelledby="closing">
          <h2 className="sa-h2" id="closing">
            Security questions before you ship?
          </h2>
          <div className="sa-hero__actions">
            <SaLinkButton href="/playground" large>
              {PLAYGROUND_CTA_LABEL}
            </SaLinkButton>
            <SaLinkButton href="/contact-sales" variant="secondary">
              Book a security review
            </SaLinkButton>
          </div>
        </section>
      </main>
    </SaRoot>
  );
}
