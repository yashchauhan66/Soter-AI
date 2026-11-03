# Read-only F31b review

2 November2026. Review agent `/root/f31b_readonly_review` inspected current product/package sources against the existing B01-B18 specification. Same-lineage LOW independence; no edits, tests or host launches by that reviewer. This is not independent release acceptance.

Concrete findings retained before correction:

- Shipped canonical/Lite auto-vault setting description claims "only protection" for CLI readers; walkthrough integrate promises unconditional restore and uses obsolete monitoring-only coverage; vault page overstates placeholders beyond successfully migrated selected values.
- Owner publishing runbook still describes unwired pre-release metadata/detached-only SBOM and its legacy15-entry CLI rejects final18 packages.
- Final XML auditor uses regex without well-formedness admission; malformed tail, second document root and unknown entity reproduce acceptance in all three synthetic negative checks (`xml-review-before-01.txt`: actual3FAIL, no skips). Actual installed-vsce integration does not replace these controls.
- Future input-graph limitation: two nested copies with the same dependency name/version refuse because license/notice joins are ambiguous. Current three-library graph is unique. This fail-closed limitation is retained, not a claim of arbitrary dependency-graph compatibility.

README, PRIVACY, owner-selected full BUSL and pre-commit new-grant withdrawal showed no additional concrete blocker in this review. Final exact-object production/native/claims acceptance remains required. No current feature DONE or release-ready assertion.
