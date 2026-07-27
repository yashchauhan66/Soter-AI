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
export declare class ReportPanel extends Widget {
    private readonly list;
    constructor();
    private empty;
    /** Append a redacted scan result. Never pass raw content to this method. */
    reportScan(title: string, result: ScanResult): void;
    /** Append a plain status/notice line (no raw content). */
    reportNotice(title: string, body: string): void;
    private appendBlock;
}
