import type { DetectorMatch, RegexDetectorSpec } from "../types";

/**
 * Shared regex detector runner.
 * Runs all specs against text and returns matches with confidence scores.
 * Ensures global flag, deduplicates results.
 */
export function runRegexDetectors(text: string, specs: RegexDetectorSpec[]): DetectorMatch[] {
    const matches: DetectorMatch[] = [];
    for (const spec of specs) {
        const pattern = ensureGlobal(spec.pattern);
        let m: RegExpExecArray | null;
        while ((m = pattern.exec(text)) !== null) {
            const value = m[0];
            if (!value) continue;
            if (spec.validator && !spec.validator(value)) continue;
            matches.push({
                type: spec.type,
                label: spec.label,
                severity: spec.severity,
                score: spec.score,
                start: m.index,
                end: m.index + value.length,
                match: value,
                message: spec.message,
                confidence: spec.confidence ?? 0.9,
            });
        }
    }
    return matches;
}

/**
 * Deduplicate findings by type+position+value.
 * Keep highest score when duplicate.
 */
export function deduplicateMatches(matches: DetectorMatch[]): DetectorMatch[] {
    const seen = new Set<string>();
    return matches
        .sort((a, b) => a.start - b.start || b.score - a.score)
        .filter((m) => {
            const key = `${m.type}:${m.start}:${m.end}:${m.match}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
}

/**
 * Collapse overlapping matches so a single secret matched by several patterns
 * (e.g. strict `openai_api_key` + broad `ai_api_key`) is not scored twice.
 * Within an overlapping cluster the highest-scoring match wins. Non-overlapping
 * matches are all preserved. Input is assumed already type-deduplicated.
 */
export function collapseOverlappingMatches(matches: DetectorMatch[]): DetectorMatch[] {
    const sorted = [...matches].sort((a, b) => a.start - b.start || b.score - a.score);
    const kept: DetectorMatch[] = [];
    for (const m of sorted) {
        const overlap = kept.find((k) => m.start < k.end && k.start < m.end);
        if (!overlap) {
            kept.push(m);
            continue;
        }
        // Replace the kept match if this one scores higher for the same span.
        if (m.score > overlap.score) {
            kept[kept.indexOf(overlap)] = m;
        }
    }
    return kept.sort((a, b) => a.start - b.start);
}

/**
 * Generate a redacted evidence string.
 * Never expose the raw match value.
 */
export function redactEvidence(match: string, type: string): string {
    if (match.length <= 4) return `[${type.toUpperCase()}_DETECTED]`;
    const first2 = match.slice(0, 2);
    const last2 = match.slice(-2);
    return `${first2}${"*".repeat(Math.min(match.length - 4, 20))}${last2}`;
}

/**
 * Generate finding ID from detector type and position.
 */
export function findingId(detectorName: string, type: string, start: number): string {
    return `${detectorName}-${type}-${start}`;
}

function ensureGlobal(pattern: RegExp): RegExp {
    return pattern.global ? new RegExp(pattern.source, pattern.flags) : new RegExp(pattern.source, `${pattern.flags}g`);
}
