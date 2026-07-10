# Use Cases

**Date:** 2026-07-10

> These describe **capabilities** (defense-in-depth), not guarantees. SoterAI reduces risk; it does not make any system completely secure, and false positives/negatives remain possible. See [`../marketing-claims-policy.md`](../marketing-claims-policy.md).

## Use Case 1: AI Chatbot Protection

**Scenario:** Company deploys AI chatbot for customer support

**Problem:** Prompt injection could bypass safety rules, leaking internal data

**SoterAI Solution:**
- Input Guard blocks prompt injection attempts
- Output Guard prevents sensitive data leakage
- PII Redactor removes personal information
- Dashboard monitors all interactions

**Value:** Secure customer-facing AI without sacrificing functionality

## Use Case 2: Developer AI Tools

**Scenario:** Engineering team uses ChatGPT, Claude, and Copilot

**Problem:** Developers paste code with secrets, API keys, and proprietary logic

**SoterAI Solution:**
- Browser extension intercepts prompts before they reach AI tools
- VS Code extension scans code before AI suggestions
- Canary tokens detect if secrets leak
- Emergency lockdown blocks all AI tools if needed

**Value:** Developers use AI productively without risking data leaks

## Use Case 3: RAG Knowledge Base Security

**Scenario:** Company builds internal knowledge base with RAG

**Problem:** Malicious documents could poison the knowledge base

**SoterAI Solution:**
- Document scanner detects prompt injection in uploads
- Quarantine workflow requires security review before indexing
- Grounding guard prevents citation of untrusted sources
- Retrieval audit logs all access

**Value:** Materially reduces the risk of knowledge-base manipulation (not an absolute guarantee)

## Use Case 4: Agent Workflow Security

**Scenario:** Company deploys AI agents with tool access

**Problem:** Agents could perform unauthorized actions or be hijacked

**SoterAI Solution:**
- Agent Firewall validates every tool call
- Escrow requires human approval for high-risk actions
- Tool Chain Detection spots multi-step attacks
- Canary tokens detect agent compromise

**Value:** Helps keep AI agents within their intended scope (with human approval on high-risk actions)

## Use Case 5: Enterprise Compliance

**Scenario:** Enterprise needs to meet SOC2/ISO requirements for AI usage

**Problem:** No visibility into how employees use AI tools

**SoterAI Solution:**
- Shadow AI Scanner discovers unauthorized AI usage
- Usage Governance tracks all AI interactions
- Audit logs provide compliance evidence
- SSO/SCIM integration with existing identity systems

**Value:** Compliant AI usage with full audit trail
