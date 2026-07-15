# Phase 12 Customer Pilot Plan

## Target

- 5 paid or serious design partners.
- 20 developer beta users.
- 3 AI startup pilots.
- 2 security team evaluations.
- 1 enterprise POC.

## Pilot Funnel

1. Application: capture company, use case, AI surfaces, risk profile, and expected weekly scan volume.
2. Onboarding: create workspace, project, API key, and first guarded scan.
3. Activation: install one extension or run one n8n workflow.
4. Proof: collect blocked risks, false positives, false negatives, time to first value, bugs, and willingness to pay.
5. Review: classify feedback as P0/P1/P2 or evidence.

## Product Change

Added `POST /api/pilot/events`, backed by `ProductEvent`, for privacy-safe pilot telemetry. Raw prompts, secrets, tokens, inputs, outputs, and message/content fields are stripped.

## Event Names

- user_signed_up
- project_created
- api_key_created
- first_scan_completed
- extension_connected
- n8n_workflow_run
- risk_blocked
- false_positive_reported
- false_negative_reported
- upgrade_clicked
- demo_booked

## Evidence Required

Real pilot participants and usage proof are still required before enterprise GA.
