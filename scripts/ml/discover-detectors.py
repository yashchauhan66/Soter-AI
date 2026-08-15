#!/usr/bin/env python3
"""
Discover every externally-runnable prompt-injection / jailbreak detector on the Hub.

WHY THIS EXISTS
  A "worldwide ranking" is only worth publishing if the field was enumerated by
  evidence rather than by whichever three model names came to mind. This script
  asks the Hub itself, sorted by downloads, and reports what is ACTUALLY runnable
  today: ungated, sequence-classification, downloadable weights.

  It deliberately reports the models it CANNOT run too (gated, wrong head,
  generative-only). A competitor omitted because it was inconvenient is a rigged
  ranking; a competitor listed as UNMEASURABLE with the reason is an honest one.

WHAT IT DOES NOT DO
  It does not score anything. Ranking happens in benchmark-vs-lakera.py on frozen
  rows. This only answers "who is in the field, and which of them can be measured".
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

SEARCH_TERMS = [
    "prompt-injection",
    "prompt injection",
    "jailbreak",
    "prompt-guard",
    "promptguard",
    "llm-guard",
    "injection-detector",
    "guardrail",
]

# Heads we can score with a P(attack) threshold. Generative guards (Llama-Guard,
# ShieldGemma) answer in text, not logits — a different harness, not a filter bug.
CLASSIFIER_ARCH_HINT = "ForSequenceClassification"


def main() -> int:
    # Windows consoles default to cp1252, which cannot encode the em-dashes this
    # script prints in its "not runnable" reasons — that raised UnicodeEncodeError
    # AFTER discovery succeeded and killed the run before the artifact was written.
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

    try:
        from huggingface_hub import HfApi
    except ImportError:
        print("[ERROR] pip install huggingface_hub", file=sys.stderr)
        return 2

    api = HfApi()
    seen: dict[str, dict] = {}

    for term in SEARCH_TERMS:
        try:
            # `direction=-1` is not accepted by every huggingface_hub version, and
            # sort="downloads" already returns descending. Passing it raised TypeError
            # on this install and every search silently yielded nothing.
            for m in api.list_models(search=term, sort="downloads", limit=60):
                if m.id in seen:
                    continue
                seen[m.id] = {
                    "id": m.id,
                    "downloads": getattr(m, "downloads", 0) or 0,
                    "likes": getattr(m, "likes", 0) or 0,
                    "gated": None,
                    "arch": None,
                    "id2label": None,
                    "runnable": None,
                    "reason": None,
                }
        except Exception as exc:  # noqa: BLE001
            print(f"[warn] search '{term}' failed: {type(exc).__name__}: {exc}", file=sys.stderr)

    print(f"[discover] {len(seen)} unique candidates from {len(SEARCH_TERMS)} searches")
    # An empty landscape means discovery FAILED, not that the field is empty. Writing
    # the artifact anyway leaves a file that reads as "no competitors exist" — which is
    # exactly the flattering-by-omission result this script is supposed to prevent.
    if not seen:
        print(
            "[FATAL] no candidates found — every search failed. Refusing to write an\n"
            "        empty landscape that would read as 'no competitors exist'.",
            file=sys.stderr,
        )
        return 1

    # Rank by downloads first so the expensive per-model metadata calls are spent on
    # the models anyone actually deploys.
    ordered = sorted(seen.values(), key=lambda r: -r["downloads"])[:90]

    for row in ordered:
        try:
            info = api.model_info(row["id"], files_metadata=False)
            row["gated"] = bool(getattr(info, "gated", False))
            cfg = getattr(info, "config", None) or {}
            archs = cfg.get("architectures") or []
            row["arch"] = archs[0] if archs else None
            label = (cfg.get("id2label") or {}) if isinstance(cfg, dict) else {}
            row["id2label"] = label or None

            if row["gated"]:
                row["runnable"], row["reason"] = False, "gated — needs manual approval"
            elif not row["arch"]:
                row["runnable"], row["reason"] = False, "no architecture in config"
            elif CLASSIFIER_ARCH_HINT not in row["arch"]:
                row["runnable"], row["reason"] = False, f"not a classifier head ({row['arch']})"
            else:
                row["runnable"], row["reason"] = True, "ungated sequence classifier"
        except Exception as exc:  # noqa: BLE001
            row["runnable"], row["reason"] = False, f"{type(exc).__name__}: {str(exc)[:80]}"

    runnable = [r for r in ordered if r["runnable"]]
    blocked = [r for r in ordered if not r["runnable"]]

    # Persist BEFORE printing. Discovery costs ~90 network round-trips; a console
    # encoding error while rendering the summary must not throw that away (it did
    # exactly that once, crashing on a non-cp1252 glyph after all the work was done).
    out = Path("artifacts/ml/detector-landscape.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        json.dumps({"runnable": runnable, "not_runnable": blocked}, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"[write] {out}")

    print(f"\n{'=' * 78}\n  RUNNABLE TODAY ({len(runnable)})\n{'=' * 78}")
    for r in runnable:
        print(f"  {r['downloads']:>9,} dl  {r['likes']:>4} likes  {r['id']}")
        print(f"                          labels={r['id2label']}")

    print(f"\n{'=' * 78}\n  NOT RUNNABLE ({len(blocked)}) - reported, not hidden\n{'=' * 78}")
    for r in blocked[:40]:
        print(f"  {r['downloads']:>9,} dl  {r['id']:<58} {r['reason']}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
