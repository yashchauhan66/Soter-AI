# n8n SoterAI Verification Demo Script

Package: `n8n-nodes-soterai`
Product: SoterAI
Local n8n URL: `http://localhost:5678`

## Scene 1: SoterAI for n8n

Visual label: Community node verification demo

Voiceover: Welcome to the SoterAI community node demo for n8n. SoterAI helps n8n builders add AI security checks to workflows, including prompt injection detection, jailbreak detection, secrets and PII detection, and AI output guarding. This video is structured for community-node verification first, so the focus is on the installed node, real configuration shape, supported actions, workflow usage, structured output, error behavior, and package quality evidence.

Approximate duration: 11.8 seconds

## Scene 2: Local n8n Setup

Visual label: Community node installed

Voiceover: In this demo, n8n is running locally through Docker. The local editor is reachable at http://localhost:5678, and the community node package n8n-nodes-soterai is installed in this n8n instance and ready to use inside workflows. A reviewer should be able to see that this is the local n8n editor experience, not a mock application or standalone marketing page. The video also keeps the browser view clean and avoids exposing any personal account or credential details.

Approximate duration: 12.6 seconds

## Scene 3: Add SoterAI Node

Visual label: Node searchable from canvas

Voiceover: From the workflow canvas, users can search for SoterAI, add the node, and configure it like any other n8n node. The goal is to make AI security checks accessible without custom code or manual HTTP requests. In a typical AI automation, this node can sit before an LLM call, after an LLM call, or before content is stored in retrieval systems. That placement makes it practical for chatbots, support workflows, internal agents, and data-processing automations.

Approximate duration: 12.0 seconds

## Scene 4: Credentials

Visual label: Reusable SoterAI API credential

Voiceover: The node uses a reusable SoterAI credential. Users add their API key once, store it securely inside n8n credentials, and reuse it across workflows. The API key is hidden in this recording for security. The credential type exposes an API key field, a Base URL field for the SoterAI endpoint, and an optional Project ID. The node can also override the project per step, which is useful when one n8n instance routes work across multiple projects or tenants.

Approximate duration: 12.1 seconds

## Scene 5: Node Actions

Visual label: Full action scope

Voiceover: The SoterAI node is designed for no-code workflow builders. It exposes four clear actions: Input Guard, Output Guard, PII Redactor, and RAG Scanner. The fields use readable labels, helpful descriptions, and structured outputs that can be used by later workflow nodes such as IF, Slack, email, CRM, database, or logging steps. The guard actions also include On Threat behavior. Builders can block the item, continue with redacted text, warn while continuing, or continue unchanged while still preserving the security result for audit and routing.

Approximate duration: 14.1 seconds

## Scene 6: Safe Input

Visual label: Low-risk prompt allowed

Voiceover: First, here is a normal business prompt. SoterAI analyzes the input and returns a low-risk result. The workflow can continue because this prompt does not contain attack behavior or sensitive data. The important output fields are allowed, blocked, riskScore, categories, reason, safeText, and outputText. Downstream nodes can use outputText as the clean value to send to an LLM or another business system, while the raw response remains available for advanced logging.

Approximate duration: 11.6 seconds

## Scene 7: Prompt Injection

Visual label: Risky input routed to blocked branch

Voiceover: Next, this prompt attempts to override instructions and extract hidden system information. SoterAI detects the prompt-injection behavior and returns a high-risk decision. In n8n, the result can route the workflow to a blocked branch, send an alert, or save a security log. This is the pattern reviewers should look for in security nodes: the node does not only return text, it returns a decision that later workflow steps can evaluate. That makes the result actionable in a visual automation.

Approximate duration: 11.9 seconds

## Scene 8: PII and Secrets

Visual label: Sensitive data detection

Voiceover: SoterAI can also detect sensitive information before it is sent to an AI model or external service. In this example, the node identifies an email address and an API-key-like secret, allowing the workflow to redact, block, or review the request. The PII Redactor action returns safeText and detectedEntities, so a workflow can pass forward a safer value while still retaining enough metadata for security review, ticketing, or compliance logs.

Approximate duration: 11.0 seconds

## Scene 9: Output Guard

Visual label: AI response checked before delivery

Voiceover: The output guard is useful after an AI model generates a response. It checks the final AI output before it reaches a user, chat tool, CRM, ticketing system, or another automation step. This is important because unsafe content can appear after generation even when the original input looked harmless. In the demo sample, the generated response contains a private-token-like value, so the output guard marks the response as unsafe and the workflow can prevent delivery.

Approximate duration: 11.4 seconds

## Scene 10: Error Handling

Visual label: Clear workflow-builder feedback

Voiceover: If a required field is missing or the request fails, the node returns a clear user-facing error. This helps workflow builders debug issues quickly without exposing unnecessary internal details. The implementation checks HTTP response status, parses the returned message when available, and supports n8n continue-on-fail behavior. When continue-on-fail is enabled, a failed item can continue as structured error JSON instead of stopping the entire run.

Approximate duration: 11.1 seconds

## Scene 11: Code Quality

Visual label: Package metadata and checks

Voiceover: Finally, here is a quick package overview. The package follows the n8n community node structure, includes nodes and credentials metadata, provides documentation and examples, uses TypeScript, and includes validation and error handling. The package also passes the available local checks and the n8n community package scanner. Specifically, the package name starts with n8n-nodes, the keyword n8n-community-node-package is present, the n8n section declares both the credential and node entry points, and the README explains installation, authentication, actions, outputs, privacy, and support.

Approximate duration: 15.1 seconds

## Scene 12: SoterAI for n8n

Visual label: Verification demo complete

Voiceover: This completes the SoterAI n8n community node verification demo. SoterAI helps workflow builders add AI security checks directly inside n8n, making it easier to build safer AI agents, chatbots, customer support workflows, and internal automations. For submission, the MP4, subtitle file, script, checklist, workflow export, and Creator Portal notes are included in the final folder so the review package is easy to inspect and upload.

Approximate duration: 11.5 seconds
