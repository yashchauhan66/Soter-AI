# F26a owner/default-client HTTP integration fixture contract

ADDITIVE TESTS ONLY. Six tests are authored against the existing service and client, so no missing-module baseline is expected. Root must capture their actual first execution before any corresponding fix. This is the existing F26a card, no replacement feature plan. Production, compiler, native, manifests, scripts, queue and ledger are untouched by the author.

`preCommitOwnerClient.integration.test.ts` invokes the real `runPreCommitClient` with its default HTTP adapter. It supplies only the announced private `runtime` / `worker` test paths. There is no request override and no clock override. Actual native executable/CLI/CJS bundle entry invocation remains a later root gate. These tests do not establish that the bundled worker's default filename is correct.

Each fixture retains a new synthetic ordinary root, manual SHA1 DIRC index, inert synthetic worker/runtime files, public signing pin and signed descriptor file. The worktree contains an unrelated synthetic private marker; no real values/profiles are used. Real `PreCommitOwnerService`, default canonical index preparation and real Ed25519 framing are used for positive and owner-refusal paths. Every scanner is an explicitly completed fake; no Git/other child or runtime file is executed. Same-lineage work supplies no independent evidence.

The tests cover:

1. Real live owner and real default client HTTP return ALLOW for a complete synthetic public index, using one genuine root-bound index and one fake completed scanner with final key reload.
2. Real owner signed BLOCK crosses the actual bounded HTTP route and remains BLOCK.
3. A valid retained descriptor after owner closure results in UNAVAILABLE, with zero scanner creation.
4. A descriptor published before owner flag withdrawal cannot admit a new scan; actual HTTP returns UNAVAILABLE with zero fake scanners.
5. An actual numeric-loopback HTTP server returns302 with `Location: http://example.invalid/...`. The client must return UNAVAILABLE after exactly one numeric-loopback connection/request, without following the location.
6. Five actual loopback response controls reject an8193-byte response, malformed JSON, unsupported content type, chunked framing, and a truncated declared body. Where relevant the body is a genuine signed ALLOW, isolating framing refusal from signature refusal.

The test-only `Socket.prototype.connect` guard permits only the captured numeric `127.0.0.1` port during each client call. It records and refuses any other attempted target before network I/O. Every test requires exactly one allowed connection and zero refused-target attempts; a redirect regression therefore fails safely without connecting externally. The real default HTTP adapter remains in use. Guards restore the original method in `finally`, and each owned listener closes via its normal server API. All files remain retained; no process signals or deletions occur.

Fake HTTP request witnesses assert the actual fixed POST route, exact numeric Host, canonical owner/session request parsing, default `.git/index` selector and no private marker or staged filename in the body. These are observed-route assertions, not a universal claim about unobserved reads or arbitrary network stacks.

The six fixtures deliberately do not wait through a60-second streaming/stall condition. The separate static review `pre-commit-client-http-review-01.md` reports the outer-timeout versus HTTP-request cleanup concern for a separately bounded lifecycle regression. Existing compiler/full/new VSIX/packaged CLI/actual Git/native/withdrawal/commit byte barriers remain open. No F26a completion, rating, OS boundary, same-user exclusion or final-check-to-Git atomicity claim follows from these tests.
