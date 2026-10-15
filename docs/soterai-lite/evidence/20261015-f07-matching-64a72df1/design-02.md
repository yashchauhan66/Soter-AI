# F07 clarification 02 — before baseline and production

The new engine's `provider` category means a canonical provider/credential format. Exclude `generic_api_key`, `password_assignment` and bare-UUID `heroku_key`, in addition to `high_entropy_token` and `opaque_credential`. Otherwise generic assignments bypass the newly frozen entropy controls, and public UUIDs acquire a false provider finding. Existing OutputFilter's legacy classifier stays unchanged. Reason: read-only canonical-rule inventory exposed these additional broad shapes while tests were being authored; no fixture results existed, and no thresholds or budgets changed.

Charge canonical provider scanning conservatively as 64 input-length passes (more than its current 45 declarations); entropy as one pass. Exact work-budget overflow is WITHHELD before running the passes. Matches on a decoded view conservatively cover the entire original encoded token/string. No decoded values are copied into metadata.
