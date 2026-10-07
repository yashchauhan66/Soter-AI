#!/usr/bin/env python3
"""Acceptance-criteria report: all eight goal-spec criteria, one held-out run, per arm.

Consumes the probability caches written by compare-v18-bases.py and re-decides through
*that file's* decision layer, imported rather than reimplemented. Two bespoke harnesses
scoring two different decision layers is exactly how the 2026-09-17 mis-scoring defect
got in (artifacts/ml/V17-DECISION-AND-ULTRA-PLAN.md section 1.6), so the layer is
imported and its sha256 recorded: edit it and this report's provenance changes.

No inference runs here.

The load-bearing rule: a criterion this evaluation set cannot measure is reported
UNMEASURABLE and is NEVER counted as a pass. `accepted` is true only when all eight
are PASS on the same run, which is what the spec's definition of done asks for.
"""
import argparse
import hashlib
import importlib.util
import json
import math
import os
import platform
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
DECISION_LAYER = Path(__file__).resolve().parent / "compare-v18-bases.py"
SPEC_VERSION = "soter-llm-security-goal-spec/2026-09-21"

# Targets transcribed from the goal spec. Values live here so a moved goalpost shows
# up as a diff in this file rather than as an unexplained change in a report.
TARGETS = {
    "latency_p95_cpu_ms": 50.0,
    "latency_p95_gpu_ms": 15.0,
    "latency_input_tokens": 4096,
    "f1": 0.97,
    "auc_roc": 0.99,
    "recall": 0.99,
    "fpr": 0.01,
    "ece": 0.05,
    "language_recall_spread": 0.05,
    "languages": 30,
}

# Deployment gate from lib/ml/onnxBackend.ts. An artifact above this ceiling cannot load
# in production at all: InferenceSession.create is never reached, the ML tier fails OPEN,
# and /api/health still answers healthy. So the ceiling is an acceptance input, not trivia.
#
# Reads the ceiling the deployment actually has rather than a constant that drifts from
# it. Precedence: an explicit env var, then .env.production (the production deployment's
# config, which is what an acceptance verdict is about), then .env, then the backend's own
# 512 MiB default. Raised 512 -> 640 MiB on 2026-09-21 to admit multilingual artifacts
# (v17-multilingual is 541,224,554 bytes and could not load at the old ceiling).
def read_env_file_value(path, key):
    if not path.exists():
        return None
    pattern = re.compile(rf'^\s*(?:export\s+)?{re.escape(key)}\s*=\s*(.*)$')
    found = None
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        match = pattern.match(line)
        if match:
            # Last occurrence wins, matching dotenv precedence.
            found = match.group(1).strip().strip('"').strip("'")
    return found


def coerce_ceiling(raw, source):
    try:
        value = int(raw)
    except ValueError:
        # Mirrors onnxBackend.ts, which now throws rather than admitting any artifact.
        raise SystemExit(
            f"SOTERAI_MODEL_MAX_BYTES must be an integer byte count, got {raw!r} "
            f"({source}). onnxBackend.ts fails closed on this; so does this harness.")
    if value <= 0:
        raise SystemExit(f"SOTERAI_MODEL_MAX_BYTES must be positive, got {value} ({source}).")
    return value, source


def deployed_model_ceiling():
    candidates = [
        (os.environ.get("SOTERAI_MODEL_MAX_BYTES"), "SOTERAI_MODEL_MAX_BYTES in the environment"),
        (read_env_file_value(ROOT / ".env.production", "SOTERAI_MODEL_MAX_BYTES"), ".env.production"),
        (read_env_file_value(ROOT / ".env", "SOTERAI_MODEL_MAX_BYTES"), ".env"),
    ]
    for raw, source in candidates:
        if raw:
            return coerce_ceiling(raw, source)
    return 536_870_912, "onnxBackend.ts default (SOTERAI_MODEL_MAX_BYTES unset everywhere)"


DEFAULT_MODEL_MAX_BYTES, MODEL_CEILING_SOURCE = deployed_model_ceiling()

# Spec attack families -> taxonomy labels. A family with no label is UNMAPPED: the
# taxonomy cannot express it, so no eval row can evidence coverage of it either.
SPEC_ATTACK_FAMILIES = {
    "direct-injection (OWASP LLM01)": ["PROMPT_INJECTION"],
    "indirect/RAG injection": ["RAG_POISONING"],
    "jailbreak (DAN/roleplay/hypothetical)": ["JAILBREAK"],
    "encoding (base64/unicode/leetspeak/homoglyph)": ["ENCODING_OBFUSCATION"],
    "multi-turn / context accumulation": ["MULTI_TURN_ESCALATION"],
    "tool-call / agentic injection": ["TOOL_CALL_ABUSE"],
    "system-prompt disclosure": ["SYSTEM_PROMPT_LEAK_ATTEMPT"],
    "model extraction": ["MODEL_EXTRACTION"],
    "data exfiltration": ["DATA_EXFILTRATION_ATTEMPT"],
    "sensitive-data egress (PII/secrets)": ["PII", "SECRET"],
    "payload splitting": [],
}

COMPETITORS = ["Meta PromptGuard 2", "Lakera Guard", "Azure AI Prompt Shields",
               "NVIDIA NeMo Guardrails"]

PASS, FAIL, UNMEASURABLE = "PASS", "FAIL", "UNMEASURABLE"


def sha(path):
    h = hashlib.sha256()
    with Path(path).open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def load_decision_layer():
    """Import compare-v18-bases.py for decisions()/metrics()/wilson()/RELIABLE."""
    spec = importlib.util.spec_from_file_location("compare_v18_bases", DECISION_LAYER)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    for required in ("decisions", "metrics", "wilson", "read_rows", "RELIABLE"):
        if not hasattr(module, required):
            raise RuntimeError(f"{DECISION_LAYER.name} is missing {required}(); decision layer moved")
    return module


def outcome(status, measured, target, note, **extra):
    return {"status": status, "measured": measured, "target": target, "note": note, **extra}


def rollup(parts):
    """A criterion is only as strong as its weakest part, and unmeasured is not passed."""
    if any(p["status"] == FAIL for p in parts):
        return FAIL
    if any(p["status"] == UNMEASURABLE for p in parts):
        return UNMEASURABLE
    return PASS


def auc_roc(scores, truth):
    """Rank-based AUC with averaged ties, so a tied block cannot inflate the area."""
    scores, truth = np.asarray(scores, dtype=float), np.asarray(truth, dtype=bool)
    positives, negatives = int(truth.sum()), int((~truth).sum())
    if not positives or not negatives:
        return None
    order = np.argsort(scores, kind="mergesort")
    ranks = np.empty(len(scores), dtype=float)
    ranks[order] = np.arange(1, len(scores) + 1, dtype=float)
    ordered = scores[order]
    start = 0
    while start < len(ordered):
        stop = start
        while stop + 1 < len(ordered) and ordered[stop + 1] == ordered[start]:
            stop += 1
        if stop > start:
            ranks[order[start:stop + 1]] = (start + stop + 2) / 2
        start = stop + 1
    return float((ranks[truth].sum() - positives * (positives + 1) / 2) / (positives * negatives))


def expected_calibration_error(probabilities, truth, bins=15):
    """Binary reliability on P(attack) -- the quantity the gate actually thresholds."""
    probabilities, truth = np.asarray(probabilities, dtype=float), np.asarray(truth, dtype=bool)
    edges = np.linspace(0.0, 1.0, bins + 1)
    error, per_bin = 0.0, []
    for lower, upper in zip(edges[:-1], edges[1:]):
        inside = (probabilities >= lower) if lower == 0.0 else (probabilities > lower)
        inside &= probabilities <= upper
        count = int(inside.sum())
        if not count:
            continue
        confidence, accuracy = float(probabilities[inside].mean()), float(truth[inside].mean())
        error += count / len(probabilities) * abs(confidence - accuracy)
        per_bin.append({"lower": float(lower), "upper": float(upper), "rows": count,
                        "mean_probability": confidence, "attack_rate": accuracy})
    return float(error), per_bin


def f1_score(measurement):
    tp, fp, fn = measurement["tp"], measurement["fp"], measurement["fn"]
    denominator = 2 * tp + fp + fn
    return (2 * tp / denominator) if denominator else None


def criterion_1_latency(cached):
    """p95 CPU inference latency. Dynamic padding is as deployed; fixed-256 is the counterfactual.

    CORRECTED 2026-09-21. This function previously graded the fixed-256 column as
    "as deployed" and asserted dynamic padding was not implemented. Both were wrong:
    encodeWindow(contentIds, padTo?) takes an optional pad width
    (lib/ml/bertTokenizer.ts), onnxBackend.ts:538 passes undefined whenever
    dynamicPadding is set, and onnxBackend.ts:346 defaults that flag to TRUE with no
    ML_ONNX_DYNAMIC_PADDING override in .env or .env.production. Production therefore
    runs the DYNAMIC column. Grading fixed-256 overstated deployed p95 by ~25% on v14
    (237.28ms vs 189.84ms). It does not change the verdict — both miss 50ms by >3x —
    which is why the error was recoverable, but a gate that mislabels which number is
    real cannot be used to certify the number that matters later.
    """
    latency = cached["latency"]
    fixed, dynamic = latency["fixed256"]["p95_ms"], latency["dynamic"]["p95_ms"]
    deployed = outcome(
        PASS if dynamic <= TARGETS["latency_p95_cpu_ms"] else FAIL, dynamic,
        TARGETS["latency_p95_cpu_ms"],
        "p95 of batch-one CPU inference with dynamic padding, which is what production "
        "runs: onnxBackend.ts:346 defaults dynamicPadding to true and no env file overrides it.")
    counterfactual = outcome(
        PASS if fixed <= TARGETS["latency_p95_cpu_ms"] else FAIL, fixed,
        TARGETS["latency_p95_cpu_ms"],
        "p95 if every input were padded to the full 256-token window, i.e. what "
        "ML_ONNX_DYNAMIC_PADDING=off would cost. Reported to bound the worst case, "
        "not as the deployed configuration.")
    # The spec asks for this at inputs up to 4k tokens.
    #
    # MEASURED 2026-09-23, was UNMEASURABLE. This part used to say "latency at 4k tokens
    # is not defined for this artifact and was not measured", which was true and useless:
    # it could not say WHICH WAY the criterion failed, and UNMEASURABLE never counts as
    # PASS, so the gate carried a permanent hole. scripts/ml/measure-4k-window.ts now
    # drives the real backend at 254/512/1024/2048/4096 content tokens in both window
    # configurations and the answer is FAIL three times over. See the artifact for rows.
    #
    # The trap it was built to avoid: as deployed, p95 at 4k tokens looks almost like p95
    # at 254 tokens, because tokens 255+ are dropped before the forward pass. Scoring
    # that as a 4k-token latency pass would have certified 50ms compliance on an input
    # the model never read. Coverage is therefore reported WITH every latency figure.
    window = _long_input_window_part()
    return {"status": rollup([deployed, window]), "parts": {
        "cpu_p95_as_deployed_dynamic_padding": deployed,
        "cpu_p95_fixed256_counterfactual": counterfactual,
        "input_window": window},
        "caveat": "Inference only. Excludes tokenization, rules tier, semantic veto and transport. "
                  "The input_window part is the exception: it calls backend.infer() directly, so "
                  "its figures INCLUDE tokenization, which is O(chars) and is why its cost still "
                  "rises with input length while the forward pass stays constant."}


def _long_input_window_part():
    """Grade the 4k-token dimension from the newest long-input measurement artifact.

    Refuses to invent a verdict: with no artifact this stays UNMEASURABLE and the
    criterion keeps failing, exactly as it did before the instrument existed.
    """
    reports = sorted((ROOT / "artifacts/ml").glob("long-input-latency*.json"))
    if not reports:
        return outcome(
            UNMEASURABLE, None, TARGETS["latency_input_tokens"],
            "No artifacts/ml/long-input-latency*.json. Run "
            "`npx tsx scripts/ml/measure-4k-window.ts` to measure p95 and coverage at "
            "inputs up to 4k tokens; until then this dimension is unmeasured, not passing.")
    report = json.loads(reports[-1].read_text(encoding="utf-8"))
    verdict = report["verdict"]
    off = verdict["as_deployed_sweep_off"]
    on = verdict["sweep_on_counterfactual"]
    cap = report["route_cap"]
    # Three independent failures. Any one of them is disqualifying on its own, so the
    # status is FAIL regardless of which the reader finds most damning.
    return outcome(
        FAIL, off["p95_ms"], TARGETS["latency_p95_cpu_ms"],
        f"MEASURED at 4,096 content tokens through the real backend "
        f"({Path(reports[-1]).name}), and it fails three independent ways. "
        f"(1) As deployed (sliding window off) p95 is {off['p95_ms']}ms while only "
        f"{off['coverage_at_4k'] * 100:.1f}% of the input is scored - the rest is truncated "
        f"before the forward pass, so this is not a 4k-token latency figure even though it "
        f"is over budget anyway. "
        f"(2) Turning the sweep on raises coverage to {on['coverage_at_4k'] * 100:.1f}% "
        f"across {on['windows']} windows and costs {on['p95_ms']}ms, "
        f"{on['p95_ms'] / TARGETS['latency_p95_cpu_ms']:.0f}x the target. "
        f"(3) A 4k-token input is refused before any tier sees it: "
        f"MAX_GUARD_TEXT_LENGTH is {cap['max_guard_text_length_chars']} chars, measured at "
        f"~{cap['measured_tokens_at_cap']} content tokens on this tokenizer. "
        f"The 256-token window is architectural, not a flag: closing this needs a "
        f"longer-context encoder.",
        coverage_at_4k=off["coverage_at_4k"],
        p95_ms_sweep_on=on["p95_ms"],
        coverage_sweep_on=on["coverage_at_4k"],
        route_cap_tokens=cap["measured_tokens_at_cap"],
        artifact=str(Path(reports[-1]).relative_to(ROOT)))


def criterion_2_market(competitor_scores):
    if not competitor_scores:
        return {"status": UNMEASURABLE, "parts": {}, "measured": None,
                "note": "No competitor has been scored on these rows. A head-to-head needs each "
                        "competitor run through this same battery and decision contract.",
                "missing": COMPETITORS,
                "history": "ProtectAI's DeBERTa has previously beaten SoterAI on a like-for-like "
                           "corpus; the in-repo ranking docs asserting otherwise were withdrawn."}
    return {"status": UNMEASURABLE, "parts": {}, "measured": list(competitor_scores),
            "note": "Competitor scores present but head-to-head comparison is not implemented here."}


def criterion_3_quality(measurement, attack_probability, truth):
    f1 = f1_score(measurement)
    auc = auc_roc(attack_probability, truth)
    return {"status": rollup([
        outcome(PASS if f1 is not None and f1 >= TARGETS["f1"] else FAIL, f1, TARGETS["f1"], ""),
        outcome(PASS if auc is not None and auc >= TARGETS["auc_roc"] else FAIL, auc,
                TARGETS["auc_roc"], "")]),
        "parts": {
            "f1": outcome(PASS if f1 is not None and f1 >= TARGETS["f1"] else FAIL, f1,
                          TARGETS["f1"], "Binary attack-vs-safe F1 at the evaluated gate."),
            "auc_roc": outcome(PASS if auc is not None and auc >= TARGETS["auc_roc"] else FAIL,
                               auc, TARGETS["auc_roc"],
                               "Threshold-free, on P(attack)=1-P(SAFE). Independent of the gate.")}}


def criterion_4_coverage(rows, truth, flags, labels, reliable, minimum_rows):
    """Per-family coverage. A family passes only if it is testable, admitted and detected."""
    row_labels = np.array([r["label"] for r in rows])
    families, per_label = {}, {}
    for label in sorted(set(row_labels[truth])):
        index = np.flatnonzero(row_labels == label)
        measurement = metrics_for(truth, flags, index)
        per_label[label] = measurement
        per_label[label]["production_admitted"] = label in reliable
    for family, mapped in SPEC_ATTACK_FAMILIES.items():
        if not mapped:
            families[family] = outcome(
                UNMEASURABLE, None, TARGETS["recall"],
                "No taxonomy label expresses this family, so no row can evidence coverage.")
            continue
        present = [label for label in mapped if label in per_label]
        if not present:
            families[family] = outcome(
                UNMEASURABLE, None, TARGETS["recall"],
                f"Taxonomy has {mapped} but this battery contains no rows for it.")
            continue
        attacks = sum(per_label[label]["attacks"] for label in present)
        caught = sum(per_label[label]["tp"] for label in present)
        recall = caught / attacks if attacks else None
        inert = [label for label in present if label not in reliable]
        if attacks < minimum_rows:
            status, note = UNMEASURABLE, f"Only {attacks} rows; below the {minimum_rows}-row floor."
        elif inert:
            status, note = FAIL, (f"{inert} is detected by the model but excluded from the INPUT "
                                  f"allowlist in lib/guard/mlAugment.ts, so production discards it: "
                                  f"the measured recall is not enforced.")
        elif recall is not None and recall >= TARGETS["recall"]:
            status, note = PASS, ""
        else:
            status, note = FAIL, "Recall below the spec floor."
        families[family] = outcome(status, recall, TARGETS["recall"], note,
                                   labels=present, attack_rows=attacks,
                                   production_admitted=not inert)
    untested = sorted(set(labels) - {"SAFE"} - set(per_label))
    return {"status": rollup(list(families.values())), "parts": families,
            "per_label": per_label,
            "taxonomy_labels_with_no_eval_rows": untested,
            "note": "A family passes only when it has enough rows to measure, is admitted to the "
                    "production INPUT allowlist, and clears the recall floor."}


def criterion_5_languages(rows, truth, minimum_rows):
    languages = [r.get("language") or r.get("lang") or "unknown" for r in rows]
    present, benign_capable = set(), set()
    for language in set(languages):
        index = np.flatnonzero(np.array(languages) == language)
        if language == "unknown":
            continue
        present.add(language)
        if int((~truth[index]).sum()) >= 1:
            benign_capable.add(language)
    attack_side = outcome(
        PASS if len(present) >= TARGETS["languages"] else FAIL, len(present),
        TARGETS["languages"], "Distinct annotated languages with any row in this battery.")
    # Over-defense is only visible where benign rows exist. Languages with attack rows but
    # no benign rows can only ever report recall, which is what made v14's 52.1% non-English
    # over-defense invisible to every gate before the multilingual battery existed.
    benign_side = outcome(
        PASS if len(benign_capable) >= TARGETS["languages"] else FAIL, len(benign_capable),
        TARGETS["languages"],
        "Languages carrying at least one benign row. Below this count, per-language FPR "
        "cannot be measured at all, whatever the attack-side coverage says.")
    return {"status": rollup([attack_side, benign_side]), "parts": {
        "languages_present": attack_side, "languages_with_benign_rows": benign_side},
        "languages": sorted(present),
        "languages_without_benign_rows": sorted(present - benign_capable),
        "note": "Eval-set coverage only. Training-corpus language coverage is a separate claim "
                "and is not evidenced by this file. FLORES-200 is not used here."}


def criterion_6_operating_point(measurement):
    recall, fpr = measurement["recall"], measurement["fpr"]
    recall_part = outcome(
        PASS if recall is not None and recall >= TARGETS["recall"] else FAIL, recall,
        TARGETS["recall"], "", wilson95=measurement["recall_wilson95"])
    fpr_part = outcome(
        PASS if fpr is not None and fpr < TARGETS["fpr"] else FAIL, fpr, TARGETS["fpr"], "",
        wilson95=measurement["fpr_wilson95"])
    return {"status": rollup([recall_part, fpr_part]), "parts": {
        "recall": recall_part, "false_positive_rate": fpr_part},
        "counts": {k: measurement[k] for k in ("attacks", "benign", "tp", "fn", "fp", "tn")},
        "note": "Reported together on the same rows at the same gate, as the spec requires."}


def _continual_learning_part():
    """Grade the continual-learning loop by INSPECTING the repo, not by describing it.

    This part used to be a hand-written narrative. Narratives rot: the previous one
    said "no intake exists", which was true when written and would have stayed in
    the report unchanged after the intake was built. So the wiring is now checked,
    and every claim below is a file read at report time.

    It deliberately CANNOT be closed by flipping a flag. Enabling CONTINUOUS_LEARNING
    makes the loop run; it does not show that anything was ever harvested in
    production. An instrument that turns green on a config change, with no evidence
    attached, is the "capability that reads as shipped and does nothing" failure this
    repo's capability registry exists to catch — so PASS additionally requires a
    health snapshot proving the queue was drained.
    """
    intake = ROOT / "lib/ml/continuousLearning/intake.ts"
    persistence = ROOT / "lib/guard/persistence.ts"
    worker = ROOT / "workers/continuousLearningWorker.ts"

    def contains(path, needle):
        return path.is_file() and needle in path.read_text(encoding="utf-8", errors="replace")

    # 1. Is there a cross-process transport at all? The worker's own buffer is
    #    module-local, so an in-process call from a route lands in a copy nothing
    #    drains — that was the real gap, and it is deeper than "wiring".
    has_transport = contains(intake, "OBSERVATION_QUEUE_KEY")
    # 2. Does a guard path actually call it? persistGuardResult() is the one choke
    #    point every guard route funnels through.
    has_caller = contains(persistence, "recordGuardObservation")
    # 3. Does the worker drain the SAME queue the route writes to?
    has_drain = contains(worker, "drainObservations")
    # 4. Is it switched on in a real env file? The *.example files do not count:
    #    documenting a switch is not setting it.
    enabled_in = sorted(
        path.name
        for path in (ROOT / ".env", ROOT / ".env.production", ROOT / ".env.local")
        if path.is_file()
        and re.search(r"^\s*CONTINUOUS_LEARNING\s*=\s*[\"']?on[\"']?\s*$",
                      path.read_text(encoding="utf-8", errors="replace"),
                      re.IGNORECASE | re.MULTILINE))
    # 5. Production evidence that rows were genuinely collected and drained.
    harvest_evidence = sorted((ROOT / "artifacts/ml").glob("continuous-learning-harvest*.json"))

    wiring = {"transport": has_transport, "route_caller": has_caller,
              "worker_drain": has_drain, "enabled_in": enabled_in or None,
              "harvest_evidence": [p.name for p in harvest_evidence] or None}

    if not (has_transport and has_caller and has_drain):
        missing = [name for name, ok in
                   (("transport", has_transport), ("route caller", has_caller),
                    ("worker drain", has_drain)) if not ok]
        return outcome(
            FAIL, "loop not connected", "online or continual learning pipeline",
            "The loop is implemented (harvest + promotionGate + rollout + a 4-tier worker "
            f"with a poison gate) but is missing: {', '.join(missing)}. Until a guard path "
            "writes observations somewhere the worker can read them, tier 2 drains an empty "
            "buffer forever and logs \"harvest: nothing observed\".", **wiring)

    if not enabled_in:
        return outcome(
            FAIL, "wired, off", "online or continual learning pipeline",
            "The loop is now CONNECTED end to end: lib/guard/persistence.ts calls "
            "recordGuardObservation() on every guard decision (one choke point, so a new "
            "route cannot silently miss it), rows travel over a Redis list, and the worker's "
            "harvest tier drains that same queue "
            "(tests/continuous-learning-intake.test.ts proves the round trip, including that "
            "a row is popped exactly once and that a queued row cannot claim a TRUSTED "
            "source). It is still FAIL because CONTINUOUS_LEARNING is not 'on' in any real "
            "env file, so nothing is collected in production. Model WEIGHTS remain out of "
            "scope for the worker by design (tier 4 needs a GPU and a shadow window), so "
            "this criterion tops out at 'the loop runs and quarantines candidates', never "
            "'the model retrains itself unattended'.", **wiring)

    if not harvest_evidence:
        return outcome(
            FAIL, "enabled, unproven", "online or continual learning pipeline",
            f"CONTINUOUS_LEARNING is on in {', '.join(enabled_in)} and the loop is wired, but "
            "no artifacts/ml/continuous-learning-harvest*.json records a tick that actually "
            "harvested production rows. Enabling a flag is not evidence that the queue is "
            "being written and drained; capture the worker's health payload (queueDepth plus "
            "a harvest summary with a non-zero candidate count) before this can pass.", **wiring)

    return outcome(
        PASS, "wired, enabled, harvesting", "online or continual learning pipeline",
        f"Wired end to end, enabled in {', '.join(enabled_in)}, and "
        f"{harvest_evidence[-1].name} records a harvest tick over production rows. Note the "
        "ceiling: the worker quarantines candidates and never promotes - weights still "
        "require evaluatePromotion() PROMOTE on a frozen eval run plus a staged rollout.",
        **wiring)


def criterion_7_adaptive(calibration):
    ood = calibration.get("ood") or {}
    ood_part = outcome(
        PASS if ood else FAIL, sorted(ood) or None, "an OOD/abstention layer",
        "Artifact ships an out-of-distribution entropy budget consumed by the abstention path."
        if ood else "No ood block in this artifact's calibration.json.")
    # An online/continual pipeline is a standing capability, not a number this run
    # produces, so it is graded by inspecting the repo at report time.
    #
    # HISTORY, because the reason this fails has changed twice and the earlier
    # wordings were each wrong later:
    #   2026-09-21 corrected "no continual-learning trigger is wired" -> the loop
    #              WAS fully built, just disconnected and off.
    #   2026-09-23 corrected "closing this is wiring and enablement" -> that
    #              understated it. recordObservation() buffers in a MODULE-LOCAL
    #              array inside a file with three top-level setInterval()s and
    #              http.createServer().listen(), so importing it into a Next.js
    #              route would have bound a port in the web process and filled a
    #              buffer the worker could never drain. It needed a real
    #              cross-process transport, which now exists.
    online_part = _continual_learning_part()
    return {"status": rollup([ood_part, online_part]),
            "parts": {"ood_layer": ood_part, "continual_learning": online_part}}


def criterion_8_ml_quality(rows, truth, flags, attack_probability, provenance, minimum_rows):
    ece, per_bin = expected_calibration_error(attack_probability, truth)
    ece_part = outcome(PASS if ece < TARGETS["ece"] else FAIL, ece, TARGETS["ece"],
                       "15-bin expected calibration error on P(attack).")
    languages = np.array([r.get("language") or r.get("lang") or "unknown" for r in rows])
    per_language, measurable = {}, {}
    for language in sorted(set(languages)):
        index = np.flatnonzero(languages == language)
        measurement = metrics_for(truth, flags, index)
        per_language[language] = measurement
        if measurement["attacks"] >= minimum_rows and measurement["recall"] is not None:
            measurable[language] = measurement["recall"]
    if len(measurable) < 2:
        variance_part = outcome(
            UNMEASURABLE, None, TARGETS["language_recall_spread"],
            f"Fewer than two languages carry the {minimum_rows} attack rows needed to compare.")
        spread = None
    else:
        spread = max(measurable.values()) - min(measurable.values())
        variance_part = outcome(
            PASS if spread < TARGETS["language_recall_spread"] else FAIL, spread,
            TARGETS["language_recall_spread"],
            f"max-min recall spread across {len(measurable)} languages with "
            f">= {minimum_rows} attack rows.",
            best=max(measurable, key=measurable.get), worst=min(measurable, key=measurable.get),
            stdev=float(np.std(list(measurable.values()))))
    missing = [key for key, value in provenance.items() if not value]
    reproducible_part = outcome(
        PASS if not missing else FAIL, sorted(provenance), "full provenance",
        "Rows, model, tokenizer, calibration and decision-layer digests all recorded."
        if not missing else f"Missing digests: {missing}")
    return {"status": rollup([ece_part, variance_part, reproducible_part]), "parts": {
        "calibration_ece": ece_part, "language_recall_spread": variance_part,
        "reproducible": reproducible_part},
        "per_language": per_language, "reliability_bins": per_bin,
        "language_recall_spread": spread}


def metrics_for(truth, flags, index):
    """metrics() over a row subset, with the decision layer's own counting."""
    return DECISIONS.metrics(truth[index], flags[index])


def evaluate_arm(name, cached, rows, truth, gate, minimum_rows, competitor_scores, max_model_bytes):
    labels = cached["identity"]["labels"]
    probabilities = np.asarray(cached["probabilities"], dtype=float)
    flags = DECISIONS.decisions(probabilities, labels, cached["content_lengths"],
                               cached["calibration"])[gate]
    attack_probability = 1.0 - probabilities[:, labels.index("SAFE")]
    measurement = DECISIONS.metrics(truth, flags)
    provenance = {
        "rows_sha256": cached["identity"]["rows_sha256"],
        "model_sha256": cached["identity"]["model_sha256"],
        "tokenizer_sha256": cached["identity"]["tokenizer_sha256"],
        "calibration_sha256": cached["identity"]["calibration_sha256"],
        "decision_layer_sha256": DECISION_LAYER_SHA,
    }
    criteria = {
        "1_latency": criterion_1_latency(cached),
        "2_strongest_in_market": criterion_2_market(competitor_scores),
        "3_performance": criterion_3_quality(measurement, attack_probability, truth),
        "4_attack_coverage": criterion_4_coverage(rows, truth, flags, labels,
                                                  DECISIONS.RELIABLE, minimum_rows),
        "5_languages": criterion_5_languages(rows, truth, minimum_rows),
        "6_recall_and_fpr": criterion_6_operating_point(measurement),
        "7_adaptive": criterion_7_adaptive(cached["calibration"]),
        "8_ml_quality": criterion_8_ml_quality(rows, truth, flags, attack_probability,
                                               provenance, minimum_rows),
    }
    blockers = []
    if cached["model_bytes"] > max_model_bytes:
        blockers.append(
            f"Artifact is {cached['model_bytes']:,} bytes against the "
            f"{max_model_bytes:,}-byte SOTERAI_MODEL_MAX_BYTES gate in lib/ml/onnxBackend.ts "
            f"(ceiling read from {MODEL_CEILING_SOURCE}). "
            f"It cannot load in production; the ML tier fails open and still reports healthy.")
    inert = sorted({label for label in set(r["label"] for r in rows)
                    if label != "SAFE" and label not in DECISIONS.RELIABLE})
    if inert:
        # NARROWED 2026-09-22. This used to end "so production discards those detections
        # regardless of model quality", which overstates the product impact in the same
        # direction the ML-tier pricing did. What is discarded is the ML TIER's
        # escalation; the rules tier still runs first and catches most of these rows.
        # Measured on this battery through the real path
        # (artifacts/ml/gate-widening-v14-realpath-2026-09-22.json): all 24 gold
        # DATA_EXFILTRATION_ATTEMPT rows are caught at product baseline, 19 of them by
        # rules alone, and admitting the label to the allowlist moved the product by
        # +1 attack and +1 false positive. The defect is real and worth naming — a
        # measured detection is thrown away, and ML recall for the family is capped at
        # zero — but it is NOT a claim that these attacks reach the user.
        blockers.append(
            f"Labels {inert} appear as attacks in this battery but are absent from the INPUT "
            f"allowlist, so the ML tier's detections for them are discarded (gatedBy="
            f"\"label-family\") and no retraining can raise ML recall for those families. "
            f"Product impact is smaller than that sounds: the rules tier runs first and "
            f"catches most of these rows, so widening the allowlist must be measured on the "
            f"real path (scripts/ml/measure-gate-widening.ts), never from ML-tier pricing "
            f"alone - on v14 the two differed by 37x.")
    statuses = [criterion["status"] for criterion in criteria.values()]
    return {
        "provenance": provenance,
        "model_bytes": cached["model_bytes"],
        "gate": gate,
        "headline": {"recall": measurement["recall"], "fpr": measurement["fpr"],
                     "f1": f1_score(measurement), "attacks": measurement["attacks"],
                     "benign": measurement["benign"]},
        "criteria": criteria,
        "deployment_blockers": blockers,
        "summary": {"passed": statuses.count(PASS), "failed": statuses.count(FAIL),
                    "unmeasurable": statuses.count(UNMEASURABLE), "total": len(statuses)},
        "accepted": all(status == PASS for status in statuses) and not blockers,
    }


def format_measured(value):
    if value is None:
        return "none"
    if isinstance(value, float):
        return f"{value:.4f}"
    if isinstance(value, list):
        return f"{len(value)} items" if len(value) > 6 else ", ".join(map(str, value))
    return str(value)


def print_explanation(report, minimum_rows):
    """Every failing and unmeasured part, which is step 3 of the iteration loop."""
    for name, arm in report["arms"].items():
        print(f"\n{'=' * 78}\n{name} -- {arm['summary']['passed']}/8 criteria pass\n{'=' * 78}")
        for key in sorted(arm["criteria"]):
            criterion = arm["criteria"][key]
            if criterion["status"] == PASS:
                continue
            print(f"\n  {key}  [{criterion['status']}]")
            for part_name, part in (criterion.get("parts") or {}).items():
                if part.get("status") == PASS:
                    continue
                print(f"    - {part_name}: {format_measured(part['measured'])} "
                      f"(target {format_measured(part['target'])}) [{part['status']}]")
                if part.get("note"):
                    print(f"        {part['note']}")
            if criterion.get("note"):
                print(f"    note: {criterion['note']}")
        language = arm["criteria"]["8_ml_quality"].get("per_language") or {}
        ranked = sorted(((m["recall"], code) for code, m in language.items()
                         if m["attacks"] >= minimum_rows and m["recall"] is not None))
        if ranked:
            worst = ", ".join(f"{code} {recall:.3f}" for recall, code in ranked[:5])
            best = ", ".join(f"{code} {recall:.3f}" for recall, code in reversed(ranked[-3:]))
            print(f"\n  weakest languages (>= {minimum_rows} attack rows): {worst}")
            print(f"  strongest: {best}")


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--explain", action="store_true",
                        help="Print every failing and unmeasured part per arm")
    parser.add_argument("--scores-dir", type=Path, required=True,
                        help="Directory of {arm}-scores.json caches from compare-v18-bases.py")
    parser.add_argument("--rows", type=Path, required=True,
                        help="The battery those caches were scored on")
    parser.add_argument("--out", type=Path, default=ROOT / "artifacts/ml/acceptance-report.json")
    parser.add_argument("--gate", default="shared_input_gate",
                        help="Operating point from the shared decision layer")
    parser.add_argument("--min-slice-rows", type=int, default=30,
                        help="Rows a slice needs before its rate is reported as measured")
    parser.add_argument("--max-model-bytes", type=int, default=DEFAULT_MODEL_MAX_BYTES)
    parser.add_argument("--competitor-scores", type=Path, nargs="*", default=[])
    args = parser.parse_args()

    rows = DECISIONS.read_rows(args.rows)
    truth = np.array([r["label"] != "SAFE" for r in rows])
    rows_digest = hashlib.sha256(
        json.dumps(rows, sort_keys=True, ensure_ascii=False).encode()).hexdigest()

    report = {
        "schema_version": 1,
        "spec_version": SPEC_VERSION,
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "host": platform.platform(),
        "rows_file": str(args.rows),
        "rows_file_sha256": sha(args.rows),
        "rows": len(rows),
        "gate": args.gate,
        "targets": TARGETS,
        "decision_layer": {"file": DECISION_LAYER.name, "sha256": DECISION_LAYER_SHA,
                           "reliable_labels": sorted(DECISIONS.RELIABLE)},
        "method": {
            "inference": "None. Cached probabilities only; each cache's rows_sha256 is checked "
                         "against the rows file before it is used.",
            "scope": "ML tier only. Rules tier and semantic veto are excluded, so these are not "
                     "product recall/FPR -- the product path scores differently in both directions.",
            "unmeasurable": "A criterion this set cannot measure is reported UNMEASURABLE and is "
                            "never counted as a pass.",
        },
        "arms": {},
    }

    caches = sorted(args.scores_dir.glob("*-scores.json"))
    if not caches:
        parser.error(f"No *-scores.json caches in {args.scores_dir}")
    for cache in caches:
        name = cache.name[:-len("-scores.json")]
        cached = json.loads(cache.read_text(encoding="utf-8"))
        if cached["identity"]["rows_sha256"] != rows_digest:
            raise SystemExit(
                f"{name}: cache was scored on different rows than {args.rows.name} "
                f"({cached['identity']['rows_sha256'][:12]} vs {rows_digest[:12]}). Refusing to "
                f"report: a cross-battery comparison is not a comparison.")
        if len(cached["probabilities"]) != len(rows):
            raise SystemExit(f"{name}: cache holds {len(cached['probabilities'])} rows, "
                             f"battery holds {len(rows)}")
        report["arms"][name] = evaluate_arm(name, cached, rows, truth, args.gate,
                                            args.min_slice_rows, args.competitor_scores,
                                            args.max_model_bytes)

    report["accepted_arms"] = sorted(n for n, a in report["arms"].items() if a["accepted"])
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, indent=2), encoding="utf-8")

    width = max(len(n) for n in report["arms"])
    print(f"\nAcceptance report -- {args.rows.name} ({len(rows)} rows, gate={args.gate})")
    print(f"decision layer {DECISION_LAYER.name}@{DECISION_LAYER_SHA[:12]}\n")
    print(f"{'arm'.ljust(width)}  " + "  ".join(f"AC{i}" for i in range(1, 9)) + "   pass  verdict")
    for name, arm in report["arms"].items():
        marks = []
        for key in sorted(arm["criteria"]):
            status = arm["criteria"][key]["status"]
            marks.append({PASS: " ok", FAIL: "  X", UNMEASURABLE: "  ?"}[status])
        verdict = "ACCEPTED" if arm["accepted"] else "REJECTED"
        print(f"{name.ljust(width)}  " + "  ".join(marks) +
              f"   {arm['summary']['passed']}/8  {verdict}")
    print("\nHeadline (ML tier only, not product recall/FPR):")
    for name, arm in report["arms"].items():
        head = arm["headline"]
        print(f"  {name.ljust(width)}  recall {head['recall']:.4f}  fpr {head['fpr']:.4f}  "
              f"f1 {head['f1']:.4f}")
    for name, arm in report["arms"].items():
        for blocker in arm["deployment_blockers"]:
            print(f"\n  BLOCKER [{name}] {blocker}")
    if args.explain:
        print_explanation(report, args.min_slice_rows)
    print(f"\nWritten: {args.out}")
    if not report["accepted_arms"]:
        print("No arm meets the acceptance criteria.")
        return 1
    print(f"Accepted: {', '.join(report['accepted_arms'])}")
    return 0


DECISIONS = load_decision_layer()
DECISION_LAYER_SHA = sha(DECISION_LAYER)

if __name__ == "__main__":
    sys.exit(main())
