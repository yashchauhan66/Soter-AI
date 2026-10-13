# Same-lineage plan review

Scope: plan only. Independence: LOW. No product code, test execution, real files/secrets, profile installation or external model session was reviewed/executed here.

The source-design reviewer and evidence/test-design reviewer independently read the draft IMPLEMENTATION-PLAN.md. Both found the required adapter-test/login timing and vault-output ordering dependencies. The evidence reviewer also checked category minima, final handoff and publication requirements; the source reviewer checked terminal enforcement wording.

Findings and addressed plan changes:

1. Required actual-tool tests cannot be postponed to L6 while an adapter becomes DONE. The revised per-card gate permits genuinely exercised actual-tool loopback tests where supported; otherwise the current card remains ACTIVE/BLOCKED-HUMAN and production implementation stops. Component mocks do not substitute; no agent login is authorized.
2. Vault app runtime needed future registered-value matching and streaming redaction. The queue now orders F07 matching, F08 redaction, F09 runtime injection. Later references use that order.
3. Shell profiles/hooks do not mediate arbitrary native execution. F10 refusal is scoped to the cooperative checked-command dispatcher and grammar, while bypass/absolute-path/native interpreter/independent upload rows remain uncovered. No universal protected-shell badge.
4. L6 handoff now names docs/soterai-lite/independent-review-report/ and an exact resume L7 payload with artifact/catalog/configuration identity, independent report, smoke/benchmark/usability/screen-reader evidence, symlink/platform/publish decisions.
5. Publication preparation explicitly includes publisher/ID configuration, token custody or secure automation, win32-x64, pre-release first and Open VSX; no agent publication.
6. Clean-profile default onboarding target is under 120 seconds, with zero admin prompts and extra installs; optional workflows have separately measured cost. Final VSIX SHA-256 is recomputed immediately before final reporting.

Review notes: 44 draft checks satisfy the original 42 category minima; catalog is not frozen yet. Frozen applicability, conservative STRONG/mutation assessment, exact-object evidence, skip handling, disk STOP and no interim numerical rating remain required. A flag-off availability failure alone does not establish prevention sensitivity; rollback never exposes originals.

This records planning review and its revisions, not independent product verification or completed user requirements.
