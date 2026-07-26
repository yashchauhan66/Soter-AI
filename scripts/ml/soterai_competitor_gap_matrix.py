#!/usr/bin/env python3
"""Generate a compact competitor gap matrix from local benchmark artifacts.

The script deliberately separates directly comparable local benchmark artifacts
from directional vendor/documentation claims. It does not invent SoterAI scores
for benchmarks that have not been run in the same harness.
"""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path


@dataclass
class CompetitorResult:
    model: str
    balanced_score_pct: float | None
    prompt_injection_recall_pct: float | None
    jailbreak_recall_pct: float | None
    document_attack_recall_pct: float | None
    hard_negative_accuracy_pct: float | None
    source_file: str


def pct(value: float | None) -> str:
    return "Not measured" if value is None else f"{value:.2f}%"


def parse_result(path: Path) -> CompetitorResult:
    text = path.read_text(encoding="utf-8", errors="replace")
    model = re.search(r"Model:\s*([A-Za-z0-9_\-]+)", text)
    score = re.search(r"Score \(balanced\):\s*([0-9.]+)%", text)

    def category_recall(category: str) -> float | None:
        # Example row: prompt_injection False 1.000000 2 2
        #              True  0.896861 200 223
        pattern = rf"{re.escape(category)}\s+False\s+[0-9.]+\s+\d+\s+\d+\s+True\s+([0-9.]+)"
        match = re.search(pattern, text)
        if not match:
            pattern = rf"{re.escape(category)}\s+True\s+([0-9.]+)"
            match = re.search(pattern, text)
        return float(match.group(1)) * 100 if match else None

    def category_false_accuracy(category: str) -> float | None:
        pattern = rf"{re.escape(category)}\s+False\s+([0-9.]+)"
        match = re.search(pattern, text)
        return float(match.group(1)) * 100 if match else None

    return CompetitorResult(
        model=model.group(1) if model else path.stem,
        balanced_score_pct=float(score.group(1)) if score else None,
        prompt_injection_recall_pct=category_recall("prompt_injection"),
        jailbreak_recall_pct=category_recall("jailbreak"),
        document_attack_recall_pct=category_recall("documents"),
        hard_negative_accuracy_pct=category_false_accuracy("hard_negatives"),
        source_file=str(path),
    )


def generate_markdown(results: list[CompetitorResult]) -> str:
    ordered = sorted(results, key=lambda item: item.balanced_score_pct or -1, reverse=True)
    best = ordered[0] if ordered else None
    lines = [
        "# SoterAI ML Competitor Gap Matrix",
        "",
        "This matrix is generated from local PINT-style competitor artifacts when available.",
        "SoterAI is not assigned a PINT score here until it is run through the exact same harness.",
        "",
        "## Local PINT-Style Competitor Results",
        "",
        "| Competitor / Model | Balanced score | Prompt-injection recall | Jailbreak recall | Document attack recall | Hard-negative accuracy |",
        "| --- | ---: | ---: | ---: | ---: | ---: |",
    ]
    for item in ordered:
        lines.append(
            f"| `{item.model}` | {pct(item.balanced_score_pct)} | {pct(item.prompt_injection_recall_pct)} | "
            f"{pct(item.jailbreak_recall_pct)} | {pct(item.document_attack_recall_pct)} | {pct(item.hard_negative_accuracy_pct)} |"
        )
    lines.extend(
        [
            "",
            "## Immediate SoterAI Gaps",
            "",
            "| Gap | Strongest observed competitor evidence | SoterAI status | Required fix |",
            "| --- | --- | --- | --- |",
            f"| Same-harness PINT score | `{best.model}` at {pct(best.balanced_score_pct)} balanced score | Not directly measured in the same PINT harness | Add SoterAI adapter to the PINT harness and run it against the same cases. |"
            if best
            else "| Same-harness PINT score | Not available | Not measured | Run competitor benchmark harness. |",
            "| Prompt-injection benchmark parity | Lakera/Prompt Guard/Protect AI-style tools are directly benchmarked in PINT artifacts | SoterAI has strong internal guard metrics, but no same-harness PINT number in this matrix | Implement/reuse PINT adapter; record SoterAI balanced score and per-slice recalls. |",
            "| Multilingual ML generalization | Commercial cloud/API guards claim broad multilingual moderation; Lakera/Check Point docs describe continuously updated prompt defenses | SoterAI has strong Hinglish/Hindi rules but sparse real multilingual dataset coverage | Add real multilingual holdout, train only in Colab GPU/TPU, report per-language F1. |",
            "| Calibration | OpenAI moderation exposes category scores; cloud guardrails expose severities/thresholds | Heuristic backend calibration error improved but remains high | Add validation-based calibration and per-label thresholds. |",
            "| Runtime neural artifact integration | Prompt Guard 2 / Protect AI are deployable model artifacts | SoterAI PyTorch/ONNX artifacts exist, but default runtime remains heuristic/external API | Add versioned ONNX backend with checksum, timeout, parity tests, and fallback. |",
            "| Independent holdout | Strong external comparisons use benchmark-separated test cases | SoterAI augmented data has duplicates and template-heavy provenance | Build locked holdout with exact/near duplicate and source separation. |",
            "| Model supply-chain inspection | Google/AWS/HiddenLayer-like offerings cover broader platform controls | SoterAI has app/agent security depth, not full model file malware/backdoor scanning | Keep as platform gap or add model-artifact scanning separately. |",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate SoterAI competitor gap matrix.")
    parser.add_argument("--results-dir", default="tmp/pint-benchmark-20260720135111/results")
    parser.add_argument("--out-md", default="docs/SOTERAI-ML-COMPETITOR-GAP-MATRIX.md")
    parser.add_argument("--out-json", default="tmp/soterai-ml-competitor-gap-matrix.json")
    args = parser.parse_args()

    results_dir = Path(args.results_dir)
    results = [parse_result(path) for path in sorted(results_dir.glob("*.md"))] if results_dir.exists() else []
    markdown = generate_markdown(results)
    Path(args.out_md).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out_md).write_text(markdown + "\n", encoding="utf-8")
    payload = {"results_dir": str(results_dir), "competitors": [asdict(item) for item in results]}
    Path(args.out_json).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out_json).write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(markdown)


if __name__ == "__main__":
    main()
