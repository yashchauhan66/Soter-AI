#!/usr/bin/env python3
"""Reconstruct the v15 batch file from a workflow journal.

WHY THIS EXISTS
    The generation workflow's task registration expires, but its journal.jsonl keeps
    one {"type":"result"} line per completed agent with the full return value. This
    turns that journal into the {batches:[{key,cleanTrain,cleanTest}]} shape that
    assemble-v15-corpus.py consumes.

WHICH ROWS WIN
    Two agent kinds appear in the journal:
      GEN    -> {trainRows, testRows, notes}
      VERIFY -> {cleanTrain, cleanTest, dropped, dropReasons}
    The VERIFY output is AUTHORITATIVE: it is the adversarial pass that removed
    mislabeled rows, and using the GEN rows instead would silently reinstate the
    exact label noise the verify stage was added to remove. A GEN batch is used ONLY
    when its verifier never returned (the workflow reported 3 agent failures), and
    every such fallback is reported loudly rather than folded in silently.

PAIRING
    Verify results are matched to their generator by ROW CONTENT (the set of texts a
    verifier kept must be a subset of what one generator produced), not by journal
    order — order pairing breaks the moment one agent in the pipeline fails.

USAGE
    python scripts/ml/extract-workflow-batches.py \
        --journal <path>/journal.jsonl --out artifacts/ml/v15-batches.json
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path


def norm(t: str) -> str:
    return " ".join((t or "").split()).strip().lower()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--journal", required=True)
    ap.add_argument("--out", default="artifacts/ml/v15-batches.json")
    args = ap.parse_args()

    events = []
    with open(args.journal, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                events.append(json.loads(line))

    gens: list[dict] = []
    verifies: list[dict] = []
    failed = 0
    for e in events:
        if e.get("type") == "failed":
            failed += 1
            continue
        if e.get("type") != "result":
            continue
        v = e.get("value") or e.get("result")
        if not isinstance(v, dict):
            continue
        rec = {"key": str(e.get("key") or "")[:24], "agentId": e.get("agentId"), "value": v}
        if "trainRows" in v or "testRows" in v:
            gens.append(rec)
        elif "cleanTrain" in v or "cleanTest" in v:
            verifies.append(rec)

    print(f"journal: {len(events)} events -> {len(gens)} generated, {len(verifies)} verified, {failed} failed")

    # Pair each verify to the generator whose rows it audited, by text overlap.
    gen_index = []
    for g in gens:
        texts = {norm(r.get("text", "")) for r in (g["value"].get("trainRows") or [])}
        gen_index.append((g, texts))

    used_gen: set[int] = set()
    batches: list[dict] = []
    unpaired_verifies = 0
    for vr in verifies:
        vtexts = {norm(r.get("text", "")) for r in (vr["value"].get("cleanTrain") or [])}
        best_i, best_overlap = -1, 0.0
        for i, (g, gtexts) in enumerate(gen_index):
            if not vtexts or not gtexts:
                continue
            ov = len(vtexts & gtexts) / max(1, len(vtexts))
            if ov > best_overlap:
                best_i, best_overlap = i, ov
        key = f"verified-{len(batches):02d}"
        if best_i >= 0 and best_overlap >= 0.5:
            used_gen.add(best_i)
            notes = gen_index[best_i][0]["value"].get("notes") or ""
            key = f"dim{best_i:02d}-verified"
        else:
            unpaired_verifies += 1
            notes = ""
        batches.append({
            "key": key,
            "source": "verify",
            "overlapWithGen": round(best_overlap, 3),
            "cleanTrain": vr["value"].get("cleanTrain") or [],
            "cleanTest": vr["value"].get("cleanTest") or [],
            "dropped": vr["value"].get("dropped"),
            "notes": notes[:400],
        })

    # Generators whose verifier never returned: keep the rows but mark them UNVERIFIED
    # so the provenance is visible in the corpus report.
    fallbacks = []
    for i, (g, _t) in enumerate(gen_index):
        if i in used_gen:
            continue
        fallbacks.append(i)
        batches.append({
            "key": f"dim{i:02d}-UNVERIFIED",
            "source": "gen-unverified",
            "cleanTrain": g["value"].get("trainRows") or [],
            "cleanTest": g["value"].get("testRows") or [],
            "notes": (g["value"].get("notes") or "")[:400],
        })

    train_total = sum(len(b["cleanTrain"]) for b in batches)
    test_total = sum(len(b["cleanTest"]) for b in batches)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"batches": batches}, ensure_ascii=False), encoding="utf-8")

    print(f"  paired verified batches : {len(batches) - len(fallbacks)}")
    if unpaired_verifies:
        print(f"  [warn] {unpaired_verifies} verify results could not be paired to a generator")
    if fallbacks:
        print(f"  [WARN] {len(fallbacks)} dimension(s) had NO verify pass and are included UNVERIFIED:")
        for i in fallbacks:
            n = (gen_index[i][0]['value'].get('notes') or '')[:90].replace("\n", " ")
            print(f"         dim{i:02d}: {len(gen_index[i][0]['value'].get('trainRows') or [])} train rows — {n}")
    print(f"  rows: train {train_total}   battery {test_total}")
    print(f"[write] {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
