# SoterAI Witnessed-Benchmark Protocol

**Purpose:** Turn "self-reported numbers" into *tamper-evident evidence* any third
party can verify. This is the credibility layer that closes the gap vs vendors
who publish unaudited marketing benchmarks.

**Status:** First-class evidence layer. Not a completed external audit.
Produced artifacts are signed so a *future* independent witness can confirm
they were not altered after the run.

---

## 1. What "witnessed" means here

A witnessed run produces three things:

1. **Environment fingerprint** — Node version, OS, CPU, RAM, timezone.
   Any variance in these is visible in the evidence hash.
2. **Dataset checksums** — SHA-256 of every input corpus file *before and after*
   the run. A changed dataset changes the hash.
3. **Step output hashes** — SHA-256 of stdout/stderr of each benchmark command,
   plus per-step exit code and duration.

All three go into a single `evidenceHash`. If **any** input, environment detail,
or step output changes, the hash changes. That's the anti-tamper anchor.

## 2. How to produce a witnessed run

```bash
node scripts/witness/witnessed-benchmark.mjs
```

Outputs (committed under `artifacts/security/`):
- `witnessed-run-<date>.json` — full machine-readable evidence bundle
- `witnessed-run-<date>.md` — human-readable summary with the hash

## 3. How a third party verifies (3 steps)

1. Check out the same git commit.
2. Run the same command: `node scripts/witness/witnessed-benchmark.mjs`
3. Confirm the `evidenceHash` matches the published one.

Any of the following independently proves tampering:
- Mismatched evidence hash → something changed after the run.
- A step's recorded `stdoutSha256` differs from a re-run → log edited.
- Dataset checksum differs → corpus swapped.

## 4. What this does NOT claim

- ❌ It is **not** an already-performed independent audit.
- ❌ It is **not** a certification by an external body.
- ✅ It IS cryptographically anchored, reproducible evidence that this exact
  configuration of datasets + environment produced these exact logs on a
  stated date — evidence any independent party can validate.

## 5. Relation to existing evidence

- `scripts/generate-independent-validation-report.ts` — external corpus
  scoring (JailbreakBench/HarmBench). A witnessed run *anchors* that score.
- `scripts/eval/eval-heldout-blind.ts` — blind held-out evaluation.
- `benchmarks/results/latest.json` — public 3,200-case result (checksum'd
  into every witnessed run).

## 6. Adding a co-signer (optional, stronger)

For highest assurance, a witness can co-sign the evidence hash with their own
key. Include the co-signature in the JSON under `coSigners[]`. The protocol
then proves two parties saw the same evidence at the same time.
