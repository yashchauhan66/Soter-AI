# Open items

Tracked, deliberate gaps. Everything here is a known limitation with a stated
reason, not an unreviewed bug.

The previous contents of this file were a progress tracker for the MCP inline
gateway with all seven phases unchecked — `packages/mcp-gateway/` has shipped
since, and `tests/mcp-gateway.test.ts` runs green in the default suite, so the
tracker was describing work that no longer existed.

## Detection

- [ ] **RAG poisoning has no text-only detector.** `analyzeText` recognises a
      poisoned retrieval payload by its *goal* (`DATA_EXFILTRATION`,
      `PROMPT_INJECTION`) but never by its delivery channel, because nothing
      detects "this instruction is attributed to retrieved content". The channel
      is only recovered when the caller supplies provenance
      (`source: "RETRIEVED_DOCUMENT"`), which the RAG routes do and
      `tests/guard/rag-poisoning-expanded.test.ts` covers. The oracle in
      `lib/classifiers/evaluation.ts` special-cases these rows, so benchmark
      numbers for RAG_POISONING measure the harness, not the guard. See the note
      in `tests/classifiers/heuristic-ml-backend.test.ts`.

- [ ] **Promote `models/ml-classifier-v14` to the default artifact.** It is the
      newest model, has 14 labels against v3's 9, and calibrates better
      (ECE 0.0027). Blocking it: `eval_results.json` marks most per-label
      thresholds `"threshold_inert": true` at 0.05, i.e. never calibrated, and
      three labels sit well below the rest — ENCODING_OBFUSCATION 0.68 recall,
      MULTI_TURN_ESCALATION 0.72, MODEL_EXTRACTION 0.70 at 0.78 precision. Needs
      `npm run ml:verify:v4` and `npm run benchmark:honest` against the held-out
      corpora before `DEFAULT_MODEL_DIR` in `lib/ml/modelVersion.ts` moves.

- [ ] **Close the blind held-out recall gap.** 61.54% on the never-tuned set
      (n=26) against 98.40% on the tuned corpora. The small blind set is itself a
      problem: at n=26 the confidence interval is far too wide to steer on. Grow
      it past 300 rows first, then treat the number as a target.

## Dependencies

- [ ] **`fast-uri` and `qs` still resolve to advisory-affected versions in the
      lockfile.** Both are dev-only — `npm audit --omit=dev` reports zero — and
      `overrides` in package.json already declare the patched ranges. npm keeps
      the existing resolutions until the lockfile is regenerated from scratch, so
      fold that into the next dependency sweep rather than a standalone full-lock
      rewrite.

## Repository

- [ ] **The git pack is ~1 GB.** `.gitignore` excludes these now, but they were
      committed before that rule and gitignore does not untrack history:
      `models/_ml-classifier-v3-backup-v5prev/pytorch_model.bin` and
      `models/_ml-classifier-v3-backup-preV6/pytorch_model.bin` (90.9 MB each,
      just under GitHub's 100 MB hard limit), four
      `datasets/ml-augmented-v*.jsonl` (~55 MB), and
      `reports/ml-v1-freeze/train.manifest.json` (18.8 MB). Removing them needs a
      history rewrite (`git filter-repo`) plus a force-push and a re-clone by
      every collaborator — a coordinated action, not a drive-by.

- [ ] **`models/` carries four dead artifact directories**:
      `_ml-classifier-v3-backup-preV6`, `_ml-classifier-v3-backup-v5prev`,
      `_never`, `_v6_extract`. Untracking them is part of the same history pass
      above.
