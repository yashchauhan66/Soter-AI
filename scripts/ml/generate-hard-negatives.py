#!/usr/bin/env python3
"""
Generate a fresh corpus of BENIGN hard negatives for retraining the guard
classifier. The v2 model's failure mode is flagging legitimate security /
developer questions as attacks (56% FPR on the held-out benign set). These are
"hard negatives": text that is topically adjacent to attacks (security, secrets,
IAM, injection, audits) but is a genuine, harmless question or request.

IMPORTANT — methodological honesty:
  This generator MUST NOT reproduce the sentences in the frozen held-out benign
  set (scripts/guard-benchmark/ml-tier-honest-final.ts). It covers the same
  *category* (benign security prose) with independently authored templates so
  that a retrained model generalizes rather than memorizing the eval set.

Output: datasets/ml-hard-negatives.jsonl  (all label = "SAFE")
"""

import json
import itertools
from pathlib import Path

# Building blocks — combined combinatorially into many distinct benign questions.
# Deliberately phrased as ordinary practitioner questions, none copied from the
# held-out eval set.
LEADS = [
    "How do I", "What's the best way to", "Can you explain how to",
    "What's the recommended approach to", "Walk me through how to",
    "Is there a standard pattern to", "How should a team",
    "What are best practices for", "How would you", "What do I need to",
]

SECURITY_TASKS = [
    "rotate an API key without breaking live sessions",
    "set up least-privilege IAM roles for a new service",
    "store secrets safely in a CI pipeline",
    "audit which third-party integrations can read our data",
    "enable multi-factor authentication for an admin console",
    "configure a WAF in front of a public API",
    "harden a Postgres database against unauthorized access",
    "review a pull request for security issues",
    "set up TLS certificate pinning on a mobile client",
    "scan a container image for known vulnerabilities",
    "implement rate limiting to slow down brute-force attempts",
    "encrypt data at rest in an S3 bucket",
    "write a runbook for responding to a leaked credential",
    "choose between SOC 2 and ISO 27001 for a startup",
    "detect lateral movement using network telemetry",
    "design an incident-response plan for a small team",
    "prevent SQL injection in a parameterized query layer",
    "safely handle user-uploaded files on a server",
    "set up single sign-on with SAML for a dashboard",
    "log authentication events for a security audit",
    "explain how indirect prompt injection works for a training deck",
    "test our own app for injection flaws in a pentest",
    "revoke and reissue a compromised signing key",
    "configure least-privilege database grants for a reporting user",
    "validate JWTs correctly on an API gateway",
    "back up encryption keys without exposing them",
    "restrict a Kubernetes ingress to internal-only paths",
    "sanitize model output before rendering it as HTML",
]

DEV_TASKS = [
    "deploy a Docker container to a managed cloud service",
    "write unit tests for a date-formatting helper",
    "profile a slow database query in production",
    "structure a monorepo for several small services",
    "set up a linter and formatter in a TypeScript project",
    "cache API responses without serving stale data",
    "add pagination to a REST endpoint",
    "migrate a schema without downtime",
    "debug a memory leak in a long-running worker",
    "document an internal API for new engineers",
]

CLOSERS = ["", " in production", " for a small team", " on AWS", " step by step",
           " with minimal downtime", " following current best practice"]

def build():
    seen = set()
    rows = []
    for lead, task in itertools.product(LEADS, SECURITY_TASKS + DEV_TASKS):
        for closer in CLOSERS:
            text = f"{lead} {task}{closer}?"
            if text in seen:
                continue
            seen.add(text)
            rows.append({"text": text, "label": "SAFE"})
    return rows

if __name__ == "__main__":
    rows = build()
    out = Path("datasets/ml-hard-negatives.jsonl")
    with open(out, "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r) + "\n")
    print(f"Wrote {len(rows)} hard-negative benign rows to {out}")
