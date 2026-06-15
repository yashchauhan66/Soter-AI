# Phase 10 Demo Script

Target duration: 10-15 minutes. Use only synthetic data and owned demo projects.

## 0:00-1:30 - Frame the Problem

AI chatbots can be manipulated through prompt injection, sensitive-data leakage, unsafe outputs, and malicious document instructions. CyberRakshak Guard provides OWASP LLM Top 10 aligned defense-in-depth risk reduction; it does not guarantee complete protection.

## 1:30-3:00 - Baseline

Show a normal user request and the expected chatbot answer. Explain where the Guard API sits before and after the model call.

## 3:00-5:00 - Safe Attack Example

Use an approved synthetic prompt such as an instruction-override attempt. Do not target a third-party service. Show the unprotected demo behavior, then run the same example through CyberRakshak Guard.

## 5:00-7:00 - Guard Decision

Show action, risk score, findings, redacted text, and safe fallback. Use fictional PII or dummy credentials for redaction.

## 7:00-9:00 - Dashboard and Evidence

Open logs, blocked attempts, policy, request IDs, redactions, and feedback controls. Explain that reports contain redacted evidence, not raw secrets.

## 9:00-10:30 - Report and Agency Value

Show the client-friendly report, badge rules, client separation, and white-label option. Do not imply certification.

## 10:30-12:00 - Integration

Show the SDK/API pattern for input guard, model call, and output guard. Explain webhooks, async reporting, and expected latency measurement.

## 12:00-15:00 - Qualification and CTA

Ask:

- Which owned chatbot or RAG workflow would be safest to evaluate?
- What data must never be stored or exposed?
- Who owns technical integration and purchase approval?
- What result would justify paying after 14 days?

Close: "Let's protect one owned chatbot for 14 days, scan at least 100 messages, generate a report, and decide from measured results."
