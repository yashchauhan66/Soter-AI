export function runRegexDetectors(text, specs) {
    const findings = [];
    for (const spec of specs) {
        const pattern = ensureGlobal(spec.pattern);
        let match;
        while ((match = pattern.exec(text)) !== null) {
            const value = match[0];
            if (!value || (spec.validator && !spec.validator(value)))
                continue;
            findings.push({
                type: spec.type,
                label: spec.label,
                severity: spec.severity,
                score: spec.score,
                start: match.index,
                end: match.index + value.length,
                match: value,
                message: spec.message,
            });
        }
    }
    return findings;
}
function ensureGlobal(pattern) {
    return pattern.global ? pattern : new RegExp(pattern.source, `${pattern.flags}g`);
}
