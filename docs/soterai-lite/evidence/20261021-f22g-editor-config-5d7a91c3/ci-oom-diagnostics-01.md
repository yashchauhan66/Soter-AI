# F22g owned CI renderer failure evidence

The exact three owned logs and six synthetic fixture files are retained byte-for-byte in ci-oom-owned-snapshots-01. Known log hashes match; source bytes/timestamps during capture are stable.

main.log line 12 records the renderer gone with reason oom/code -536870904 at 2026-10-22 12:19:48.920 IST (06:49:48.920 UTC). SoterAI activation appears in window1 at12:19:44.282 and window2 at12:20:14.513. The first host reports renderer MessagePort closure; the second reports a renderer termination message.

All six synthetic fixture files remain present; their recorded creation timestamps fall between first activation and logged renderer failure. Current secret.yml equals the driver's first malformed test value. First-activation observations were not retained; the second retained result has0 observations and NativeCiDriverFailure. This establishes neither CI25PASS nor zero assertions executed across both activations. The actual primary process closure records exit0/bothEOF/signals0.

An exclusive-create EEXIST on re-entry is an inference from the unchanged wx initialization and surviving files, not an established exception. The renderer failure trigger/root cause beyond the logged oom reason remains UNESTABLISHED. No failure is regraded; independence remains LOW.
