# SoterAI Lite candidate report

Updated 6 November 2026. **Release NOT_READY; rating PENDING.** Candidate: [soterai-lite-0.7.0-resumed-20261106-attempt02.vsix](../../packages/soterai-lite/soterai-lite-0.7.0-resumed-20261106-attempt02.vsix), 1,742,104 bytes, SHA-256 `011f96d19d42dbefc2e56eb5399bf5c7f16a09d6b71b8bae5be9d66b2f3769ec`. Available native host: Windows 10.0.26300, Code 1.145.1. Current native acceptance must have its own exact-object receipt. Earlier Code 1.144.1/1.145.0 results remain historical.

The current candidate has 1,111 frozen inputs and 4,892 component tests: 4,888 PASS, zero FAIL, four privileged-symlink SKIP. The full suite executed before one description-only manifest synchronization; the accepted receipt explicitly reuses that execution after proving no runtime source change. Fresh compiler, 110 metadata tests, 55 package tests, build and exact package inspection passed. Backend qualification is retained by identical input bytes; it is not a fresh backend execution.

[Full suite](evidence/20261106-remaining-queue/candidate-01/full-suite-acceptance-02.json) and [exact package qualification](evidence/20261106-remaining-queue/candidate-01/current-package-qualification-01.json). The package contains 18 entries and four runtimes with SBOM, notices and privacy documentation.

Four scripted Node/Express and Next.js ON/OFF cases passed using actual Express 5.2.1 routing over bounded in-memory Node HTTP transport and actual NextRequest/NextResponse. Six component stream boundaries passed; 128 selected reads from a synthetic 4,096-file tree took 3548.7181 ms against the predeclared 60,000 ms component budget. No model calls or listening server occurred. These results do not measure installed startup, actual AI-tool transport or human coding performance.

F26a is now a default-off owner-reviewed pre-commit candidate. Capability metadata no longer blocks install/resume; native acceptance is separate. F32 installation, trust and restore lifecycle remain subject to their current acceptance receipts. Historical affected-family, CustomDocument10 and reliability30 native results refer to the earlier artifact and cannot be promoted to this rebuilt archive.

All 264 catalog tool-pairs remain UNVERIFIED. Actual routes, per-pair applicability, public/negative controls, leak oracles and prevention-sensitive mutations remain required. The retained unmanaged baseline is eight scoped blocks and nine confirmed leaks.

The audit retains 42 affected builder-dependency associations: 17 HIGH, 19 MODERATE and six LOW. All 42 raw responses were rehashed. Three bundled libraries have no affected association in that retained lookup; this is not a fresh vulnerability-free audit. Remediation OPEN; owner risk acceptance NOT_GRANTED.

The new neutral packet is byte-verified, with 393 manifest entries and 394 files. Independent verdict NOT_PROVIDED; builder evidence has LOW independence. Human smoke/logins, two real-agent trials, five-user usability, actual screen reader and platform/release decisions remain outstanding.

Lite targets accidental exposure on cooperative routes. Same-user original reads, unmanaged inheritance/history, independent clients/uploads, other original buffers, unknown transforms and past exposure remain outside its boundary. No final rating or publication is authorized by this report. Original L6 requires the human handoff, followed by STOP for actual human results.

[Evidence index](RELEASE-EVIDENCE.json), [human actions](HUMAN-ACTIONS.md) and [current claims](evidence/20261106-remaining-queue/final/CURRENT-CLAIMS.md). Frozen packaged documents remain historical build inputs; this dated supplement records later evidence.
