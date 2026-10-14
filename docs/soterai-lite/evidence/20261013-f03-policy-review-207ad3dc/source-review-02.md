# F03 follow-up source review

Independence LOW: same-lineage read-only reviewer. No concrete blocker found in invalid-root transition notification deduplication. The first invalid transition still revokes owned masked views even without session grants; repeated invalid reads do not emit another refresh, and valid recovery rearms. Root-specific generic revocation and manual-intent S27 remain unchanged. RF01–RF04 safely bound host-like rereads and cover concurrent failures/recovery/disabled policy. Actual earlier renderer OOM cause is UNVERIFIED.

Native fixture correction: accepted permanence is captured only after an actual public managed read enrolls F02 defaults, with explicit schema2/manual/policy positive assertions. Source-drift case changes a comment only, preserving its exact unchanged-permanence assertion. All original deny, masked-value, native diff, real cooldown and restart assertions remain. Prior failing host drivers/results are retained.
