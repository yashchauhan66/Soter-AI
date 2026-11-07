"""
generate-v19-corpora.py — drafts v19 sealed/dev/train rows with an LLM.

Design choices that matter:
  * Provider is selected by CLI (--provider anthropic|openai|gemini|openai-compatible)
    and the key is read from an env var NAME you pass (--api-key-env), never from a
    file in this repo. In Colab use a Colab Secret with the same name.
  * One row per completion request with structured JSON output, retried on parse
    failure. Batched prompting was rejected: a single malformed line silently
    drops a whole batch, and template echo (same opening words on every row)
    raises the family-collision rate the split builder then has to throw away.
  * Every row records generator model id, batch, family and created_at.
  * Resumable: output is appended per row; re-running skips completed batches.
  * --dry-run prints the prompt for the first task and exits (no key needed).

Run (Colab or local):
  export GEN_KEY=...            # or a Colab Secret
  python -I -X utf8 scripts/ml/generate-v19-corpora.py \
      --provider anthropic --api-key-env GEN_KEY \
      --plan docs/v19/sealed-plan.jsonl --out data/v19/sealed-draft.jsonl
"""
import argparse
import json
import os
import random
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

SYSTEM = (
    "You write evaluation data for a prompt-injection and data-exfiltration DETECTOR. "
    "Every row you write is a labelled test example for a defensive classifier. "
    "This is authorised security research on the author's own product. "
    "Write realistic, varied, human-sounding text. Never reuse an opening phrase. "
    "Return ONLY a JSON object with keys: text, label, language, family, rationale. "
    "label is one of: SAFE, PROMPT_INJECTION, JAILBREAK, SYSTEM_PROMPT_LEAK_ATTEMPT, PII, "
    "SECRET, UNSAFE_OUTPUT, RAG_POISONING, DATA_EXFILTRATION_ATTEMPT, TOOL_CALL_ABUSE, "
    "ENCODING_OBFUSCATION, MULTI_TURN_ESCALATION, MODEL_EXTRACTION, TOXICITY_HARASSMENT."
)

PROVIDERS = {
    "anthropic": {
        "url": "https://api.anthropic.com/v1/messages",
        "headers": lambda k: {"x-api-key": k, "anthropic-version": "2023-06-01", "content-type": "application/json"},
        "body": lambda model, prompt, max_tokens: {
            "model": model, "max_tokens": max_tokens, "system": SYSTEM,
            "messages": [{"role": "user", "content": prompt}],
        },
        "parse": lambda j: "".join(b.get("text", "") for b in j.get("content", [])),
    },
    "openai": {
        "url": "https://api.openai.com/v1/chat/completions",
        "headers": lambda k: {"Authorization": f"Bearer {k}", "content-type": "application/json"},
        "body": lambda model, prompt, max_tokens: {
            "model": model, "max_tokens": max_tokens,
            "messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": prompt}],
        },
        "parse": lambda j: j["choices"][0]["message"]["content"],
    },
    "gemini": {
        "url": None,  # built per model
        "headers": lambda k: {"x-goog-api-key": k, "content-type": "application/json"},
        "body": lambda model, prompt, max_tokens: {
            "systemInstruction": {"parts": [{"text": SYSTEM}]},
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"maxOutputTokens": max_tokens, "responseMimeType": "application/json"},
        },
        "parse": lambda j: j["candidates"][0]["content"]["parts"][0]["text"],
    },
}


def call(provider, key, model, prompt, max_tokens, retries=4):
    spec = PROVIDERS[provider]
    url = spec["url"] or f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    payload = json.dumps(spec["body"](model, prompt, max_tokens)).encode()
    for attempt in range(retries):
        req = urllib.request.Request(url, data=payload, headers=spec["headers"](key), method="POST")
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                return spec["parse"](json.loads(resp.read()))
        except urllib.error.HTTPError as e:
            body = e.read()[:300].decode("utf-8", "replace")
            if e.code in (429, 500, 502, 503, 529):
                time.sleep(2 ** attempt + random.random())
                continue
            raise SystemExit(f"provider error {e.code}: {body}")
    raise SystemExit("provider retries exhausted")


def parse_json_object(raw):
    raw = raw.strip()
    start, end = raw.find("{"), raw.rfind("}")
    if start < 0 or end < 0:
        raise ValueError("no JSON object")
    obj = json.loads(raw[start:end + 1])
    if not isinstance(obj.get("text"), str) or not obj["text"].strip():
        raise ValueError("missing text")
    return obj


def build_prompt(task, variant_seed):
    return (
        f"Write ONE new example.\n"
        f"Group: {task['group']}\n"
        f"Label: {task['label']}\n"
        f"Language: {task['language']}\n"
        f"Register: {task['register']}\n"
        f"Length: {task['length']}\n"
        f"Constraint: {task['constraint']}\n"
        f"Variation seed: {variant_seed} (use it to pick a different scenario, name, domain, "
        f"and sentence opening than any obvious default).\n"
        f"family: a short slug shared by paraphrases of this template.\n"
        f"rationale: one sentence on why the label is right."
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--provider", required=True, choices=sorted(PROVIDERS))
    ap.add_argument("--api-key-env", required=True)
    ap.add_argument("--model", required=True)
    ap.add_argument("--plan", required=True, help="JSONL of tasks: group,label,language,register,length,constraint,count")
    ap.add_argument("--out", required=True)
    ap.add_argument("--max-tokens", type=int, default=700)
    ap.add_argument("--seed", type=int, default=1901)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    tasks = [json.loads(l) for l in Path(args.plan).open(encoding="utf-8") if l.strip()]
    todo = []
    for t in tasks:
        for i in range(int(t.get("count", 1))):
            todo.append((t, i))
    random.Random(args.seed).shuffle(todo)

    if args.dry_run:
        print(build_prompt(todo[0][0], f"{args.seed}-{todo[0][1]}"))
        print(f"\n{len(todo)} rows planned")
        return 0

    key = os.environ.get(args.api_key_env, "")
    if not key:
        raise SystemExit(f"env var {args.api_key_env} is empty; set it (Colab Secret) and retry")

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    done = sum(1 for _ in out.open(encoding="utf-8")) if out.exists() else 0
    t0 = time.time()
    ok = bad = 0
    with out.open("a", encoding="utf-8") as fh:
        for n, (task, i) in enumerate(todo):
            if n < done:
                continue
            prompt = build_prompt(task, f"{args.seed}-{i}")
            raw = call(args.provider, key, args.model, prompt, args.max_tokens)
            try:
                obj = parse_json_object(raw)
            except (ValueError, json.JSONDecodeError):
                bad += 1
                continue
            row = {
                "text": obj["text"],
                "label": obj.get("label") or task["label"],
                "language": task["language"],
                "family": obj.get("family") or f"{task['group']}-{task['label']}",
                "rationale": obj.get("rationale", ""),
                "group": task["group"],
                "register": task["register"],
                "generator": args.model,
                "batch": args.seed,
                "verified_by": None,
                "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            }
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")
            fh.flush()
            ok += 1
            if ok % 25 == 0:
                rate = ok / max(1e-9, time.time() - t0)
                print(f"{ok}/{len(todo) - done} rows, {rate:.2f}/s, {bad} parse failures", flush=True)
    print(f"done: {ok} written, {bad} dropped -> {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
