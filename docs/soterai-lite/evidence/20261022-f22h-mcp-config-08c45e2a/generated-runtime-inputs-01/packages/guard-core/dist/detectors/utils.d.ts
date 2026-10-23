import type { DetectorMatch, RegexDetectorSpec } from "../types";
/**
 * Shared regex detector runner.
 * Runs all specs against text and returns matches with confidence scores.
 * Ensures global flag, deduplicates results.
 */
export declare function runRegexDetectors(text: string, specs: RegexDetectorSpec[]): DetectorMatch[];
/**
 * Deduplicate findings by type+position+value.
 * Keep highest score when duplicate.
 */
export declare function deduplicateMatches(matches: DetectorMatch[]): DetectorMatch[];
/**
 * Collapse overlapping matches so a single secret matched by several patterns
 * (e.g. strict `openai_api_key` + broad `ai_api_key`) is not scored twice.
 * Within an overlapping cluster the highest-scoring match wins. Non-overlapping
 * matches are all preserved. Input is assumed already type-deduplicated.
 */
export declare function collapseOverlappingMatches(matches: DetectorMatch[]): DetectorMatch[];
/**
 * Generate a redacted evidence string.
 * Never expose the raw match value.
 */
export declare function redactEvidence(match: string, type: string): string;
/**
 * Generate finding ID from detector type and position.
 */
export declare function findingId(detectorName: string, type: string, start: number): string;
//# sourceMappingURL=utils.d.ts.map