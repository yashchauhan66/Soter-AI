# n8n SoterAI Real Verification Demo Script

Package: `n8n-nodes-soterai`
Product: SoterAI
Local n8n URL: `http://localhost:5678`

## Scene 1: Intro title

SoterAI for n8n - AI Security Guard for Workflows. This is a real community node verification demo for n8n-nodes-soterai. The goal is to show the actual local n8n editor, real node discovery, real workflow execution, and the package evidence a reviewer needs.

## Scene 2: Local n8n

Welcome to the SoterAI community node demo for n8n. This recording uses the real local n8n editor at http://localhost:5678, running in Docker, with the SoterAI community node installed. I am not showing a mockup or a slideshow. The browser is connected to the running local editor, and all workflow screens are captured live from that instance.

## Scene 3: Community node

First, I open a new workflow and use the canvas add-node flow. After adding a Manual Trigger, the workflow builder can search for SoterAI and see that the community node is available from the real n8n interface. This is the same discovery path a workflow builder would use when they install the package from community nodes and start adding security checks to an automation.

## Scene 4: Credentials

The workflow uses a reusable SoterAI API credential. The credential stores the API key inside n8n, so the workflow can reuse it without exposing the key in node output or workflow JSON. Any secret values stay hidden in this video. For this repeatable verification recording, I use a separate local demo credential that points to a local SoterAI-compatible endpoint, while the previously configured SoterAI credential remains present and encrypted in n8n.

## Scene 5: Node actions

The node exposes four real actions from the TypeScript source: SoterAI Input Guard, SoterAI Output Guard, SoterAI PII Redactor, and SoterAI RAG Scanner. Common fields include Project ID, Metadata JSON, and On Threat behavior. On Threat lets a builder choose whether risky content should block the item, continue with redacted text, warn while continuing, or continue unchanged while preserving structured risk metadata.

## Scene 6: Safe input

The first branch checks a normal support prompt: Write a short customer support reply for a delayed order. The SoterAI node returns allowed true, blocked false, and a low risk score, so the workflow can continue. The output includes safeText and outputText, which downstream nodes can use as clean values for an LLM, ticketing system, CRM, or notification step.

## Scene 7: Prompt injection

The next branch tests prompt injection. The sample asks the system to ignore previous instructions and reveal hidden rules, API keys, and developer messages. SoterAI marks this as a high-risk prompt injection and blocks the item. In a production n8n workflow, this result can route to an IF branch, alert a security channel, create an audit event, or stop an agent before it sends sensitive context to a model.

## Scene 8: PII and secrets

The PII branch includes an email address and an API-key-like value. SoterAI returns redacted safe text and detected entities for email and API key, allowing the workflow to block, redact, or route to review. The key detail is that the output is structured: a workflow can inspect detectedEntities, severity, riskScore, and safeText without writing custom parsing code.

## Scene 9: Output guard

The output guard checks AI-generated content before it reaches users or downstream systems. In this sample, the generated response contains a private-token-like value, so SoterAI detects secret disclosure and blocks the output. This is useful because unsafe content can appear after generation even when the original user input looked harmless.

## Scene 10: Error handling

The final branch sends an empty input with continue-on-fail enabled. The node returns a clear structured validation result, showing how workflow builders can debug failures without leaking internals or secrets. The same pattern helps production workflows handle transient API failures or invalid input while keeping a clean audit trail.

## Scene 11: Code quality

For package quality, the demo shows package.json, README documentation, TypeScript node source, credential metadata, and the actual command results. npm run lint passed, npm run build passed, and the n8n community package scanner passed. The package name is n8n-nodes-soterai, the n8n-community-node-package keyword is present, and the n8n metadata declares both node and credential entry points.

## Scene 12: Closing

This completes the real SoterAI n8n community node demo. SoterAI brings input guard, output guard, PII redaction, and RAG security checks into n8n workflows with structured outputs for routing, audit, and review. The final artifacts include the MP4, subtitles, voiceover, script, importable workflow JSON, QA report, and Creator Portal notes.
