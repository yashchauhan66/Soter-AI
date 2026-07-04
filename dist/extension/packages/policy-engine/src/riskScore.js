export function severityForRiskScore(score) {
    if (score >= 85)
        return "critical";
    if (score >= 60)
        return "high";
    if (score >= 30)
        return "medium";
    if (score > 0)
        return "low";
    return "info";
}
export function thresholdAction(score, thresholds) {
    if (score >= thresholds.block)
        return "block";
    if (score >= thresholds.requireApproval)
        return "require_approval";
    if (score >= thresholds.redact)
        return "redact";
    if (score >= thresholds.warn)
        return "warn";
    return "allow";
}
