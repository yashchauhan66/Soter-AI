# F21 native ownership and bounded processing clarification

This refines design01 within F21; no queue or catalog replacement. Workspace discovery and file identity/policy checks before consent are metadata-only. The 1MiB limit covers admitted/analyzed saved text; the canonical vault core also makes bounded freshness rereads. It is not a claim that aggregate filesystem reads are exactly 1MiB. Oversized/capped files yield PARTIAL; unsupported parse/binary/IO failures withhold the whole report. Findings are canonical-vault heuristic candidates, not live credentials. F22's source/config-family scanners remain separate.

Hygiene owns a distinct instance of the existing VaultManager, a private synchronous snapshot lease and its own withdrawal epoch. Queued core mutations recheck the supplied trusted lease at admission. Late same-key SecretStorage events compare key identity before withdrawing. A committed migration followed by metadata failure reports INCOMPLETE and retains canonical recovery, rather than claiming an atomic rollback. Existing saved denies survive owner disclosure restore. Export rereads the keyed ledger after its modal; same-user/cross-window races remain outside an OS transaction guarantee.

Nine advanced native commands use actual file/ordinal/provider pickers; command arguments never carry URI/content/finding/approval authority. One pending native command flow at a time. Workspace analysis has separate content-read consent; vault migration and disclosure restore retain their canonical second review. Native UI can show only safe fixed labels, heuristic metadata, and static checklists. No startup scan, source TextDocument or account operation. Flag-off withdraws pending work and preserves source protection/recovery/metadata.

Manual checklist sources fetched read-only on 2026-10-20 (not evidence of credential validity or performed rotation):

- OpenAI routine replacement/update/verify/revoke: https://developers.openai.com/api/docs/guides/production-best-practices ; suspected compromise: https://developers.openai.com/api/docs/guides/safety-best-practices
- Anthropic key management/storage/disable/delete: https://platform.claude.com/docs/en/manage-claude/authentication
- Google replacement/deploy/verify/disable/delete: https://ai.google.dev/gemini-api/docs/api-key
- AWS IAM replacement/deactivate/delete: https://docs.aws.amazon.com/IAM/latest/UserGuide/id-credentials-access-keys-update.html
- GitHub expiration/minimum permissions/token deletion: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens
- Stripe public publishable keys and Dashboard rotate/expire workflow: https://docs.stripe.com/keys

Checklists paraphrase official guidance and link it. They never accept a credential, perform network/account changes or mark rotation complete. Provider inference is heuristic. Stripe near-match exclusion requires both an explicit Stripe publishable/public name and a pk_test_/pk_live_ value; other key/token candidates remain eligible.
