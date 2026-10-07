#!/usr/bin/env python3
"""Tests for the offline decision layer in `v17_operating_points.py`.

Runs in ~1 s with no ONNX session: the decision layer is a pure function of a probability
vector, which is the whole reason the score matrix exists. Covers the parts that would
otherwise only be exercised after a 75-minute scoring run, plus the two claims the module
makes about itself.

MUTATION-CHECKED. A test that cannot fail is worse than no test, so `test_selfcheck_fires`
deliberately breaks the fast path and asserts the equivalence check NOTICES. Without that,
"fast path agrees with the reference" is an assertion about a comparison that was never
shown capable of returning False.

    python scripts/ml/test_v17_operating_points.py
"""
import json
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))

import v17_operating_points as OP  # noqa: E402

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}{('  -- ' + detail) if detail and not cond else ''}")
    if not cond:
        FAILURES.append(name)


def make_arms():
    import v14_vs_v17_10k_honest as H

    arms = []
    for name, d in H.ARMS:
        cal = json.loads((ROOT / d / "calibration.json").read_text(encoding="utf-8"))
        labels = sorted(cal["per_label_thresholds"].keys())
        if "SAFE" not in labels:
            labels = ["SAFE"] + labels
        arms.append(OP.Arm(name, d, labels, labels.index("SAFE")))
    return arms


def make_rows(arms, n=1500, seed=7):
    """Synthetic rows spanning every branch: confident attacks, flat OOD-ish vectors,
    SAFE argmax with high attack mass, truncated rows, and clean benigns."""
    rnd = random.Random(seed)
    k = len(arms[0].labels)
    rows = []
    for i in range(n):
        shape = i % 5
        raw = []
        for _ in arms:
            if shape == 0:  # confident attack on a random non-SAFE label
                v = [rnd.uniform(0.0001, 0.01) for _ in range(k)]
                v[rnd.randrange(1, k)] = rnd.uniform(0.6, 0.99)
            elif shape == 1:  # flat -> should abstain
                v = [rnd.uniform(0.9, 1.1) for _ in range(k)]
            elif shape == 2:  # confident SAFE
                v = [rnd.uniform(0.0001, 0.01) for _ in range(k)]
                v[arms[0].safe] = rnd.uniform(0.7, 0.99)
            elif shape == 3:  # SAFE argmax, but flat enough to carry attack mass
                v = [rnd.uniform(0.04, 0.08) for _ in range(k)]
                v[arms[0].safe] = 0.10
            else:  # marginal: sits near the 0.5 confidence floor
                v = [rnd.uniform(0.001, 0.02) for _ in range(k)]
                v[rnd.randrange(1, k)] = rnd.uniform(0.47, 0.53)
            s = sum(v)
            raw.append([round(x / s, 6) for x in v])
        rows.append(
            {
                "i": i,
                "label": "SAFE" if i % 3 == 0 else "PROMPT_INJECTION",
                "lang": "en" if i % 4 else "hi",
                "src": "synthetic",
                "sha": f"{i:016x}",
                "arms": {a.name: {"p": raw[j], "n": 300 if i % 7 == 0 else 50,
                                  "t": 1 if i % 7 == 0 else 0}
                         for j, a in enumerate(arms)},
            }
        )
    return rows


def main():
    arms = make_arms()
    rows = make_rows(arms)
    print(f"{len(rows)} synthetic rows x {len(arms)} arms, {len(arms[0].labels)} labels\n")

    print("q4 boundary (Number(x.toFixed(4)) at the backend -> mlAugment boundary)")
    check("q4 rounds up at the midpoint", OP.q4(0.49995) == 0.5)
    check("q4 does not round up below it", OP.q4(0.499949) == 0.4999)
    check("q4 is identity on exact values", OP.q4(0.85) == 0.85)

    print("\nmcnemar")
    check("symmetric", OP.mcnemar(3, 9) == OP.mcnemar(9, 3))
    check("no discordance -> p=1", OP.mcnemar(0, 0) == 1.0)
    check("equal split -> p=1", abs(OP.mcnemar(5, 5) - 1.0) < 1e-9)
    check("large imbalance is significant", OP.mcnemar(0, 25) < 0.001, f"got {OP.mcnemar(0,25)}")
    check("p is a probability", all(0 <= OP.mcnemar(b, c) <= 1 for b in range(6) for c in range(6)))

    print("\ndecision layer")
    a = arms[0]
    safe_vec = [0.0] * len(a.labels)
    safe_vec[a.safe] = 1.0
    hit, gate, _ = OP.flagged(a, safe_vec, False, mode="prod")
    check("certain SAFE is never flagged", (hit, gate) == (False, "SAFE_ARGMAX"))

    flat = [1.0 / len(a.labels)] * len(a.labels)
    hit, gate, _ = OP.flagged(a, flat, False, mode="prod")
    check("uniform vector is not flagged", not hit, f"gate={gate}")

    # A label OUTSIDE the INPUT allowlist must not flag however confident it is.
    outside = [l for l in a.labels if l not in OP.RELIABLE_INPUT and l != "SAFE"]
    if outside:
        v = [0.0001] * len(a.labels)
        v[a.labels.index(outside[0])] = 0.99
        hit, gate, _ = OP.flagged(a, v, False, mode="prod")
        check(f"allowlist blocks {outside[0]} at conf 0.99", (hit, gate) == (False, "NOT_IN_ALLOWLIST"))

    v = [0.0001] * len(a.labels)
    v[a.labels.index("PROMPT_INJECTION")] = 0.99
    hit, _, lab = OP.flagged(a, v, False, mode="prod")
    check("confident allowlisted attack flags", hit and lab == "PROMPT_INJECTION")

    # The per-label thresholds are inert on INPUT (rawPredictedLabel restore), so a row
    # sitting just BELOW its label threshold must still flag in prod and not in shipped.
    # To isolate thresholding from abstention, P(SAFE) is pushed low enough that the row
    # clears BOTH the arm's own tiny shipped entropy budget and the 0.85 attack-prob floor
    # -- otherwise "shipped does not flag" would be explained by abstention instead.
    for arm in arms:
        cand = [l for l in arm.thr if l in OP.RELIABLE_INPUT and arm.thr[l] > OP.q4(0.05)]
        if not cand:
            print(f"  SKIP  threshold-inertness on {arm.name}: no allowlisted label with a threshold")
            continue
        thr_lab = max(cand, key=lambda l: arm.thr[l])
        t = arm.thr[thr_lab]
        budget = arm.ood.get("binary_entropy_p95")
        p_safe = next((x for x in (0.005, 0.001, 0.0002, 0.00005)
                       if budget is None or OP.binent(1 - x) <= budget), None)
        if p_safe is None or t - 0.01 <= (1 - p_safe - (t - 0.01)) / (len(arm.labels) - 2):
            print(f"  SKIP  threshold-inertness on {arm.name}: no vector isolates the threshold")
            continue
        conf = t - 0.01
        rest = (1 - p_safe - conf) / (len(arm.labels) - 2)
        v = [rest] * len(arm.labels)
        v[arm.safe] = p_safe
        v[arm.labels.index(thr_lab)] = conf
        p_hit, p_gate, _ = OP.flagged(arm, v, False, mode="prod")
        s_hit, s_gate, _ = OP.flagged(arm, v, False, mode="shipped")
        check(
            f"{arm.name}: thresholds inert on INPUT ({thr_lab} thr={t:.4f}, conf={conf:.4f})",
            p_hit and not s_hit and s_gate == "BELOW_THRESHOLD",
            f"prod={p_hit}/{p_gate} shipped={s_hit}/{s_gate}",
        )

    print("\nscore / score_fast equivalence (the guarantee main() relies on)")
    for arm in arms:
        cache = OP.precompute(rows, arm)
        ref = OP.score(rows, arm, mode="prod")
        fast = OP.score_fast(rows, arm, cache)
        check(
            f"{arm.name}: identical verdicts on every row",
            (ref["tp"], ref["fp"], ref["_atk"], ref["_ben"]) == (fast["tp"], fast["fp"], fast["_atk"], fast["_ben"]),
            f"ref {ref['tp']}/{ref['fp']} vs fast {fast['tp']}/{fast['fp']}",
        )
        for b in (0.05, 0.20, 0.40, 0.6932):
            ref_b = OP.score(rows, arm, mode="prod", entropy_budget=b)
            fast_b = OP.score_fast(rows, arm, cache, entropy_budget=b)
            check(
                f"{arm.name}: equivalent at budget {b}",
                (ref_b["tp"], ref_b["fp"]) == (fast_b["tp"], fast_b["fp"]),
                f"ref {ref_b['tp']}/{ref_b['fp']} vs fast {fast_b['tp']}/{fast_b['fp']}",
            )

    print("\nmutation: the equivalence check must be capable of failing")
    # NOTE ON HOW THIS IS MUTATED. The obvious mutation -- reassign OP.CONF_FLOOR -- does
    # NOT work, and silently passes: `flagged` and `score_fast` read the SAME module
    # globals, so moving a floor moves both paths together and they stay in agreement.
    # (Measured: raising CONF_FLOOR by 0.2 changed zero verdicts, because a confident
    # non-SAFE argmax already clears the attack-probability floor and short-circuits the
    # OR.) What main() actually depends on is the COMPARISON, so the mutation has to be a
    # broken fast function, exercised through the comparison main() performs.
    arm = arms[0]
    cache = OP.precompute(rows, arm)
    ref = OP.score(rows, arm, mode="prod")

    def broken_fast(cache, drop_allowlist=False, ignore_abstention=False):
        """score_fast with one production rule deleted."""
        tp = fn = fp = tn = 0
        atk, ben = [], []
        for pname, c4, a4, p_attack, be, ent, trunc, is_atk in cache:
            hit = False
            if pname != "SAFE":
                abstained = False if ignore_abstention else (
                    max(p_attack, 1 - p_attack) < OP.ABSTAIN_FLOOR or be > OP.PROD_ENTROPY
                )
                if not abstained:
                    conf_ok = c4 >= OP.CONF_FLOOR or a4 >= OP.ATTACK_PROB_FLOOR
                    hit = conf_ok and (drop_allowlist or pname in OP.RELIABLE_INPUT)
            if is_atk:
                tp, fn = tp + hit, fn + (not hit)
                atk.append(hit)
            else:
                fp, tn = fp + hit, tn + (not hit)
                ben.append(not hit)
        return {"tp": tp, "fn": fn, "fp": fp, "tn": tn, "_atk": atk, "_ben": ben}

    def detects(b):
        """The exact comparison main() runs before it allows a sweep to report."""
        return (b["tp"], b["fp"]) != (ref["tp"], ref["fp"]) or b["_atk"] != ref["_atk"] or b["_ben"] != ref["_ben"]

    check("detects a fast path that skips the allowlist", detects(broken_fast(cache, drop_allowlist=True)))
    check("detects a fast path that skips abstention", detects(broken_fast(cache, ignore_abstention=True)))
    check("passes the correct fast path", not detects(OP.score_fast(rows, arm, cache)))

    print("\nmonotonicity: a looser abstention budget can only flag more")
    arm = arms[0]
    cache = OP.precompute(rows, arm)
    prev_tp = prev_fp = -1
    mono = True
    for b in [x / 50 for x in range(1, 35)]:
        s = OP.score_fast(rows, arm, cache, entropy_budget=b)
        if s["tp"] < prev_tp or s["fp"] < prev_fp:
            mono = False
            break
        prev_tp, prev_fp = s["tp"], s["fp"]
    check("recall and FPR are both non-decreasing in the budget", mono)

    print("\nsafe-argmax promotion probe (W12)")
    base = OP.score(rows, arms[0], mode="prod")
    probe = OP.safe_argmax_probe(rows, arms[0], base)
    floors = sorted(probe, key=float)
    check("a lower floor promotes at least as many rows",
          all(probe[floors[i]]["extraTp"] + probe[floors[i]]["extraFp"]
              >= probe[floors[i + 1]]["extraTp"] + probe[floors[i + 1]]["extraFp"]
              for i in range(len(floors) - 1)))
    check("promoted labels are all allowlisted",
          all(l in OP.RELIABLE_INPUT for v in probe.values() for l in v["promotedLabels"]))
    check("recall never decreases under promotion",
          all(v["recall"] >= base["recall"] - 1e-12 for v in probe.values()))

    print("\nallowlist widening can only add flags")
    wide = OP.RELIABLE_INPUT | {"MULTI_TURN_ESCALATION"}
    narrow = OP.score(rows, arms[0], mode="prod")
    wider = OP.score(rows, arms[0], mode="prod", allowlist=wide)
    check("MTE admission is monotone", wider["tp"] >= narrow["tp"] and wider["fp"] >= narrow["fp"])

    print()
    if FAILURES:
        print(f"{len(FAILURES)} FAILED: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all checks passed")


if __name__ == "__main__":
    main()
