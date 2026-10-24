import type { DetectorMatch, Finding } from "./types";
/**
 * Evidence minimizer — converts raw detector matches into safe Findings.
 * Raw match content is redacted before being stored/displayed.
 */
export declare function minimizeEvidence(matches: DetectorMatch[], detectorName: string): Finding[];
/**
 * Create evidence preview from findings without raw content.
 * Max 200 chars.
 */
export declare function createEvidencePreview(findings: Finding[]): string;
//# sourceMappingURL=EvidenceMinimizer.d.ts.map