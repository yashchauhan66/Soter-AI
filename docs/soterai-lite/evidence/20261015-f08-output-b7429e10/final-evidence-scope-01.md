# F08 final evidence scope

The final product source is the source covered by focused-after-02 and typecheck-01, then full-tests-01 and artifact01. After typecheck, two native-fixture description strings were narrowed: S08 proves incomplete final UTF-8 (control failures have unit coverage); S10 proves fresh sequential-operation isolation (unit R16 separately interleaves instances). No native code logic or type structure changed. No later compiler PASS is invented for those string-only edits.

The final native run uses fresh prebuilt-host-02 and host-build-02, preserving build01. The final source fixture and build02 both carry the narrowed descriptions. This test-only build does not change the packaged runtime. Production self-test oracles and scripted native flag changes remain LOW independence; no independent sink, actual shell stream, gateway route or human-presence proof.

Completion-buffered output is not a live interactive passthrough. Managed input buffers, limits, unsupported terminal-editing controls and callback-observed withdrawal are part of the frozen contract. Independent uploads and original native terminal paths remain unmanaged. All earlier failures and scope-review notes are retained.
