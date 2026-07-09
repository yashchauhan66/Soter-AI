import { Widget } from '@lumino/widgets';
import { ScanResult } from './broker';

/**
 * Read-only report panel for SoterAI IDE Guard.
 *
 * PLANNED / UNBUILT. It renders ONLY redacted, display-safe fields returned by
 * the broker: decision, risk score, categories, content hash, and the broker's
 * `evidencePreview`. Raw cell source, prompts, secrets, and notebook OUTPUTS are
 * never written into this panel — that is a blocking acceptance criterion in
 * docs/jupyterlab-test-report.md.
 */
export class ReportPanel extends Widget {
  private readonly list: HTMLElement;

  constructor() {
    super();
    this.id = 'soterai-guard-report';
    this.title.label = 'SoterAI Guard';
    this.title.caption = 'SoterAI IDE Guard — redacted findings';
    this.title.closable = true;
    this.addClass('soterai-report');

    const header = document.createElement('div');
    header.className = 'soterai-report-header';
    header.textContent =
      'Local-first findings from the authenticated loopback broker. ' +
      'Only redacted evidence is shown; nothing is uploaded to SoterAI Cloud by default.';
    this.node.appendChild(header);

    this.list = document.createElement('div');
    this.list.className = 'soterai-report-list';
    this.node.appendChild(this.list);

    this.empty();
  }

  private empty(): void {
    this.list.textContent = '';
    const placeholder = document.createElement('div');
    placeholder.className = 'soterai-report-empty';
    placeholder.textContent = 'No scans yet.';
    this.list.appendChild(placeholder);
  }

  /** Append a redacted scan result. Never pass raw content to this method. */
  reportScan(title: string, result: ScanResult): void {
    const lines: string[] = [
      `Decision: ${result.decision || 'unknown'}`,
      `Risk: ${result.riskScore ?? 0}`,
      `Safe: ${result.safe}`
    ];
    if (result.categories && result.categories.length > 0) {
      lines.push(`Categories: ${result.categories.join(', ')}`);
    }
    if (result.contentHash) {
      lines.push(`Content hash: ${result.contentHash}`);
    }
    if (result.evidencePreview) {
      lines.push(`Redacted evidence: ${result.evidencePreview}`);
    }
    this.appendBlock(title, lines.join('\n'), decisionClass(result.decision));
  }

  /** Append a plain status/notice line (no raw content). */
  reportNotice(title: string, body: string): void {
    this.appendBlock(title, body, 'soterai-notice');
  }

  private appendBlock(title: string, body: string, variantClass: string): void {
    const empty = this.list.querySelector('.soterai-report-empty');
    if (empty) {
      empty.remove();
    }
    const block = document.createElement('div');
    block.className = `soterai-report-item ${variantClass}`;

    const head = document.createElement('div');
    head.className = 'soterai-report-item-title';
    const time = new Date().toLocaleTimeString();
    head.textContent = `[${time}] ${title}`;

    const pre = document.createElement('pre');
    pre.className = 'soterai-report-item-body';
    pre.textContent = body;

    block.appendChild(head);
    block.appendChild(pre);
    this.list.insertBefore(block, this.list.firstChild);
  }
}

function decisionClass(decision: string): string {
  switch (decision) {
    case 'block':
      return 'soterai-decision-block';
    case 'approval_required':
    case 'redact':
    case 'warn':
      return 'soterai-decision-warn';
    case 'allow':
      return 'soterai-decision-allow';
    default:
      return 'soterai-decision-unknown';
  }
}
