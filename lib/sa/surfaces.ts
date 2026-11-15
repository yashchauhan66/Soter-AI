import type { Status } from '@/components/sa/primitives';

/**
 * Where it runs, how mature each part is, and what it does not do yet.
 *
 * One list, used by the home page and the pricing page, so a status can never
 * differ between them.
 *
 * Two deliberate differences from lib/marketing/launchStatus.ts:
 *  - IDE Guard says "VS Code". The older copy said "all major IDEs", which the
 *    repo's own claims document (README-CLAIMS.md) does not support: it records
 *    62 of 63 real-agent and editor combinations as untested.
 *  - n8n, Make and Zapier are one row, because they share one status and one gap.
 *
 * `gap` is what a buyer needs to know before relying on it. Keep it blunt.
 */
export interface Surface {
  name: string;
  status: Status;
  does: string;
  gap: string;
  href: string;
}

export const SURFACES: Surface[] = [
  { name: 'API', status: 'Stable', does: 'Checks prompts, replies and retrieved text from your server.', gap: 'Needs an API key.', href: '/docs/quickstart' },
  { name: 'Audit evidence', status: 'Stable', does: 'Redacted logs and signed exports.', gap: 'Retention depends on the plan.', href: '/trust' },
  { name: 'IDE Guard', status: 'Beta', does: 'Finds secrets and personal data before they reach an AI assistant in VS Code.', gap: 'Detection only on some paths. Other editors not tested.', href: '/extensions/ide' },
  { name: 'Browser Guard', status: 'Beta', does: 'Visibility and control for AI use in Chrome and Edge.', gap: 'Tested on those two browsers only.', href: '/extensions/browser' },
  { name: 'n8n, Make, Zapier', status: 'Beta', does: 'Guard steps inside automation workflows.', gap: 'Interfaces may change.', href: '/integrations' },
  { name: 'MCP and agent guard', status: 'Labs', does: 'Risk review for tool calls before sensitive actions.', gap: 'Experimental. Do not rely on it in production.', href: '/mcp-security' },
];

/** What the three labels mean. Shown wherever a status is shown. */
export const STATUS_MEANING: Array<{ status: Status; meaning: string }> = [
  { status: 'Stable', meaning: 'Shipped and supported. It still does not give complete protection.' },
  { status: 'Beta', meaning: 'Works today, may change, and has had limited testing. Expect pilot-level support.' },
  { status: 'Labs', meaning: 'Experimental. Do not rely on it in production.' },
];
