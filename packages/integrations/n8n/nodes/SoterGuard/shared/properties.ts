import type { INodeProperties } from "n8n-workflow";

/**
 * Shared property list for every SoterAI node version.
 *
 * Version-specific fields are gated with the reserved `@version` key in
 * `displayOptions` rather than by keeping two divergent property arrays. That
 * matters for a security node: one array means a field cannot accidentally exist
 * on one version and be missing on the other, and the execute path reads the
 * same parameter names either way.
 *
 * The rule for `@version`:
 *   [1]    -> only the original single-output node
 *   [2]    -> only the branching node
 *   absent -> both
 */
export const soterGuardProperties: INodeProperties[] = [
  {
    displayName: "Action",
    name: "action",
    type: "options",
    noDataExpression: true,
    options: [
      {
        name: "Analyze Text (Report Only)",
        value: "analyzeText",
        description: "Report risk for any text. Does not block — it sorts items into Safe and Flagged so you can decide",
        action: "Analyze text for AI security risks",
      },
      {
        name: "Audit N8N Workflow Security (Report Only)",
        value: "workflowAudit",
        description: "Score an exported n8n workflow for AI, tool, webhook, code, RAG, and data-leak risks. Runs locally and sends nothing",
        action: "Audit an n8n workflow for AI security risks",
      },
      {
        name: "Get RAG Risk Summary (Report Only)",
        value: "ragScanner",
        description: "Scan a document or chunk before adding it to a vector database. Untrusted documents leave through Flagged",
        action: "Scan RAG document for threats",
      },
      {
        name: "Guard Input (Start Here)",
        value: "inputGuard",
        description: "Check a user message before it reaches the LLM, and block or redact it. The usual first step",
        action: "Check user input for threats",
      },
      {
        name: "Guard Output",
        value: "outputGuard",
        description: "Check an AI response before it is sent to the user, and block or redact it",
        action: "Check AI output for threats",
      },
      {
        name: "Redact Secrets or PII (Report Only)",
        value: "piiRedactor",
        description: "Return a redacted copy of any text. Always continues — use the redacted output downstream",
        action: "Redact PII from text",
      },
      {
        name: "Universal AI Firewall (Advanced)",
        value: "universalGuard",
        description: "One guard covering prompt, RAG, tools, memory, output, and data leakage. Most powerful, most setup",
        action: "Protect an AI workflow end to end",
      },
    ],
    // Guard Input is the default rather than the Universal Firewall: it is the
    // smallest action that actually protects something (two fields, no JSON),
    // and it is where nearly every real workflow starts. Defaulting to a
    // report-only action would be worse — a new user would wire up the node,
    // see it "working", and never learn that nothing was ever blocked.
    default: "inputGuard",
  },

  // ---------------------------------------------------------------------
  // Per-action notices. These are the honesty layer of the UI: four of the
  // seven actions never block anything, and a user who assumes otherwise is
  // unprotected while believing they are protected.
  //
  // Version 1 has one output, so its notices have to teach the IF-node
  // workaround. Version 2 routes items itself, so its notices describe the
  // branch that already exists.
  // ---------------------------------------------------------------------
  {
    displayName:
      "This action only reports risk — it never blocks. To act on the result, add an IF node after this one and branch on <code>{{ $json.allowed }}</code>. To block automatically instead, use <b>Guard Input</b> or <b>Guard Output</b>.",
    name: "reportOnlyNotice",
    type: "notice",
    default: "",
    displayOptions: { show: { action: ["analyzeText", "ragScanner"], "@version": [1] } },
  },
  {
    displayName:
      "This action reports risk without blocking, but it still routes: anything it flags leaves through the <b>Flagged</b> output. Connect that output to stop the item, or leave it unconnected to drop it. No IF node needed.",
    name: "reportOnlyNoticeV2",
    type: "notice",
    default: "",
    displayOptions: { show: { action: ["analyzeText", "ragScanner"], "@version": [2] } },
  },
  {
    displayName:
      "This returns a redacted copy of the text and always continues. Use <code>{{ $json.outputText }}</code> downstream — the original text is not modified in place.",
    name: "redactNotice",
    type: "notice",
    default: "",
    displayOptions: { show: { action: ["piiRedactor"] } },
  },
  {
    displayName:
      "Runs entirely inside n8n. The workflow JSON is analysed locally and never sent to SoterAI, so this works without network access. It is a static review — it never executes the workflow or resolves a credential.",
    name: "auditNotice",
    type: "notice",
    default: "",
    displayOptions: { show: { action: ["workflowAudit"] } },
  },
  {
    displayName:
      "Blocking happens here: set <b>On Threat</b> below. Check <code>{{ $json.blocked }}</code> downstream, and use <code>{{ $json.outputText }}</code> as the safe text to pass on.",
    name: "enforcingNotice",
    type: "notice",
    default: "",
    displayOptions: { show: { action: ["inputGuard", "outputGuard", "universalGuard"], "@version": [1] } },
  },
  {
    displayName:
      "Blocked items leave through the <b>Flagged</b> output; everything else leaves through <b>Safe</b>. Wire <b>Safe</b> into the rest of your workflow and use <code>{{ $json.outputText }}</code> as the text to pass on. Choosing Redact, Warn, or Continue under <b>On Threat</b> keeps those items on <b>Safe</b> — that is what those settings are for.",
    name: "enforcingNoticeV2",
    type: "notice",
    default: "",
    displayOptions: { show: { action: ["inputGuard", "outputGuard", "universalGuard"], "@version": [2] } },
  },

  // Input Guard fields
  {
    displayName: "Input Text",
    name: "inputText",
    type: "string",
    typeOptions: { rows: 4 },
    default: "",
    required: true,
    placeholder: "={{ $json.chatInput }}",
    hint: "Usually an expression pointing at the previous node, such as {{ $json.chatInput }} or {{ $json.message }}",
    displayOptions: { show: { action: ["analyzeText", "inputGuard", "universalGuard"] } },
    description: "The user message to check for prompt injection, jailbreaks, and other threats",
  },

  // Output Guard fields
  {
    displayName: "AI Output Text",
    name: "outputText",
    type: "string",
    typeOptions: { rows: 4 },
    default: "",
    required: true,
    placeholder: "={{ $json.output }}",
    hint: "The LLM node's response, such as {{ $json.output }} or {{ $json.text }}",
    displayOptions: { show: { action: ["outputGuard"] } },
    description: "The AI-generated response to check before sending to the user",
  },
  {
    // Deliberately NOT the same label as the Guard Output field above. Two
    // fields sharing the name "AI Output Text" — one required, one optional —
    // is the single most confusing thing a new user can hit in this node.
    displayName: "AI Output Text (Optional)",
    name: "universalOutputText",
    type: "string",
    typeOptions: { rows: 4 },
    default: "",
    placeholder: "={{ $json.output }}",
    hint: "Leave empty to check the input only. Fill it in to check both directions in this one node",
    displayOptions: { show: { action: ["universalGuard"] } },
    description: "Optional AI response to check before sending, saving, or calling another tool",
  },
  {
    displayName: "Protection Profile",
    name: "protectionProfile",
    type: "options",
    options: [
      {
        name: "Balanced",
        value: "BALANCED",
        description: "Lower-friction protection for internal workflows and testing",
      },
      {
        name: "Maximum Protection",
        value: "MAXIMUM",
        description: "Strict fail-closed protection for production AI agents and public chatbots",
      },
      {
        name: "Strict",
        value: "STRICT",
        description: "Block critical threats and require review for high-risk behavior",
      },
    ],
    default: "MAXIMUM",
    hint: "Sets HOW MUCH gets flagged. 'On Threat' below sets WHAT HAPPENS once something is flagged",
    displayOptions: { show: { action: ["universalGuard"] } },
    description:
      "How sensitive detection should be. This controls how many things are treated as threats, not what the node does about them — that is 'On Threat'",
  },

  // PII Redactor fields
  {
    displayName: "Text",
    name: "piiText",
    type: "string",
    typeOptions: { rows: 4 },
    default: "",
    required: true,
    placeholder: "={{ $json.text }}",
    hint: "Any text to strip secrets and personal data from",
    displayOptions: { show: { action: ["piiRedactor"] } },
    description: "The text to scan and redact PII from",
  },
  // RAG Scanner fields
  {
    displayName: "Document Text",
    name: "ragText",
    type: "string",
    typeOptions: { rows: 4 },
    default: "",
    required: true,
    placeholder: "={{ $json.pageContent }}",
    hint: "The chunk or document body, such as {{ $json.pageContent }} from a loader node",
    displayOptions: { show: { action: ["ragScanner"] } },
    description: "Document or chunk text to scan before adding to a vector database",
  },
  {
    displayName: "Document ID",
    name: "documentId",
    type: "string",
    default: "",
    required: true,
    placeholder: "={{ $json.id }}",
    hint: "Any stable ID for this document, so repeat scans can be correlated",
    displayOptions: { show: { action: ["ragScanner"] } },
    description: "Stable identifier used to track the document scan",
  },
  {
    displayName: "Document Source",
    name: "documentSource",
    type: "options",
    options: [
      { name: "API", value: "api" },
      { name: "Email", value: "email" },
      { name: "File Upload", value: "upload" },
      { name: "Unknown", value: "unknown" },
      { name: "URL", value: "url" },
    ],
    default: "api",
    hint: "Be accurate — untrusted sources like Email and URL are held to a stricter standard",
    displayOptions: { show: { action: ["ragScanner"] } },
    description: "Where the document entered the RAG pipeline",
  },
  {
    displayName: "Workflow JSON",
    name: "workflowJson",
    type: "json",
    typeOptions: { rows: 10 },
    default: "={{JSON.stringify($json)}}",
    required: true,
    hint: "Defaults to the incoming item. To audit a saved workflow, paste its export from the n8n canvas menu",
    displayOptions: { show: { action: ["workflowAudit"] } },
    description: "Exported n8n workflow JSON to audit before production use",
  },

  // Common fields
  {
    displayName: "On Threat",
    name: "onThreat",
    type: "options",
    options: [
      { name: "Block", value: "BLOCK", description: "Stop the workflow item" },
      { name: "Continue", value: "CONTINUE", description: "Ignore the threat and continue" },
      { name: "Redact", value: "REDACT", description: "Continue with redacted safe text" },
      { name: "Warn", value: "WARN", description: "Continue but flag the threat in output" },
    ],
    default: "BLOCK",
    hint: "Sets WHAT HAPPENS when something is flagged. 'Protection Profile' sets how much gets flagged",
    displayOptions: { show: { action: ["inputGuard", "outputGuard", "universalGuard"] } },
    description: "What this node does locally once SoterAI flags a threat",
  },

  // ---------------------------------------------------------------------
  // Optional / advanced. Kept as top-level fields rather than folded into an
  // "Options" collection on purpose: moving a published parameter into a
  // collection silently orphans the values already saved in users' live
  // workflows, and for a security node that means protection quietly turning
  // itself off. They are gated by displayOptions instead, so each action only
  // shows the fields it actually reads.
  // ---------------------------------------------------------------------
  {
    displayName: "Allowed Topics",
    name: "allowedTopics",
    type: "string",
    default: "",
    placeholder: "billing, shipping, returns",
    hint: "Optional. Leave empty to keep the off-topic guard switched off",
    displayOptions: { show: { action: ["inputGuard", "universalGuard"] } },
    description:
      "Comma-separated subjects this assistant is meant to handle. An empty list means no topical scope is defined, not that everything is off-topic",
  },
  {
    displayName: "System Prompt Context",
    name: "systemPromptContext",
    type: "string",
    typeOptions: { rows: 2 },
    default: "",
    placeholder: "You are a billing support assistant for an Indian e-commerce store",
    hint: "Optional. Used only when Allowed Topics is not specific enough. Off-topic is advisory and never blocks on its own",
    displayOptions: { show: { action: ["inputGuard", "universalGuard"] } },
    description:
      "Your assistant's system prompt or role description, used to judge whether a message is in scope",
  },

  // Version 1 collected all four advanced layers as hand-written JSON. It stays
  // exactly as published so existing workflows keep working untouched.
  {
    displayName: "Security Context JSON",
    name: "securityContextJson",
    type: "json",
    typeOptions: { rows: 5 },
    default: "",
    placeholder:
      '{\n  "rag": { "text": "retrieved chunk", "documentId": "doc-1", "source": "upload" },\n  "tool": { "name": "email.send", "action": "send", "destination": "external" },\n  "output": { "destinationType": "FINAL_OUTPUT" }\n}',
    hint: "Optional. Leave empty to check the prompt and response only — every key below is independent",
    displayOptions: { show: { action: ["universalGuard"], "@version": [1] } },
    description:
      "Adds the RAG, tool-call, memory, and output-destination layers. Supported keys: rag, tool, memory, output",
  },

  // Version 2 replaces that JSON blob with guided fields. Each layer is an
  // independent section a user adds only if their workflow has that surface, so
  // the most advanced action no longer requires knowing a JSON schema by heart.
  {
    displayName: "Security Context",
    name: "securityContext",
    type: "fixedCollection",
    default: {},
    placeholder: "Add Security Layer",
    displayOptions: { show: { action: ["universalGuard"], "@version": [2] } },
    description:
      "Optional extra layers to check alongside the prompt and response. Add only the ones your workflow actually has — each is independent",
    options: [
      {
        displayName: "Retrieved Context (RAG)",
        name: "rag",
        values: [
          {
            displayName: "Retrieved Text",
            name: "text",
            type: "string",
            typeOptions: { rows: 3 },
            default: "",
            placeholder: "={{ $json.context }}",
            hint: "The chunk the vector store returned, before the model reads it",
            description: "Retrieved document text to scan for poisoning and hidden instructions",
          },
          {
            displayName: "Document ID",
            name: "documentId",
            type: "string",
            default: "",
            placeholder: "={{ $json.documentId }}",
            description: "Optional stable ID so repeat scans of the same document can be correlated",
          },
          {
            displayName: "Source",
            name: "source",
            type: "options",
            options: [
              { name: "API", value: "api" },
              { name: "Email", value: "email" },
              { name: "File Upload", value: "upload" },
              { name: "Unknown", value: "unknown" },
              { name: "URL", value: "url" },
            ],
            default: "api",
            hint: "Be accurate — Email and URL are treated as untrusted and held to a stricter standard",
            description: "Where this document entered the RAG pipeline",
          },
        ],
      },
      {
        displayName: "Tool Call",
        name: "tool",
        values: [
          {
            displayName: "Tool Name",
            name: "name",
            type: "string",
            default: "",
            placeholder: "email.send",
            hint: "Required once this layer is added",
            description: "The tool or function the AI wants to call",
          },
          {
            displayName: "Tool Action",
            name: "action",
            type: "string",
            default: "",
            placeholder: "send",
            hint: "Required once this layer is added",
            description: "What the call would do, such as send, write, delete, or query",
          },
          {
            displayName: "Destination",
            name: "destination",
            type: "options",
            options: [
              { name: "External (Leaves Your Systems)", value: "external" },
              { name: "Internal (Your Own Services)", value: "internal" },
              { name: "Local (Same Workflow)", value: "local" },
              { name: "Unknown", value: "unknown" },
            ],
            default: "external",
            hint: "External is judged most strictly, because that is where data actually leaves",
            description: "How far the tool call reaches",
          },
          {
            displayName: "Target",
            name: "target",
            type: "string",
            default: "",
            placeholder: "customer@example.com",
            description: "Optional recipient, URL, table, or file the call would act on",
          },
          {
            displayName: "Content",
            name: "content",
            type: "string",
            typeOptions: { rows: 2 },
            default: "",
            placeholder: "={{ $json.toolPayload }}",
            description: "Optional payload the AI generated for the call. Defaults to Input Text when empty",
          },
          {
            displayName: "Risk Context (JSON)",
            name: "riskContext",
            type: "json",
            typeOptions: { rows: 3 },
            default: "",
            placeholder: '{ "canSendMessage": true, "canModifyData": false, "canRunCode": false }',
            hint: "Optional capability flags describing what this tool is able to do",
            description: "JSON object of capability flags used to weigh how dangerous the call is",
          },
        ],
      },
      {
        displayName: "Memory Operation",
        name: "memory",
        values: [
          {
            displayName: "Operation",
            name: "action",
            type: "options",
            options: [
              { name: "Delete", value: "DELETE" },
              { name: "Read", value: "READ" },
              { name: "Store", value: "STORE" },
              { name: "Update", value: "UPDATE" },
            ],
            default: "STORE",
            hint: "Store and Update are where memory poisoning actually lands",
            description: "What the agent is doing to its memory",
          },
          {
            displayName: "Content",
            name: "content",
            type: "string",
            typeOptions: { rows: 2 },
            default: "",
            placeholder: "={{ $json.memory }}",
            description: "The text being written or read. Defaults to Input Text when empty",
          },
          {
            displayName: "Memory Type",
            name: "memoryType",
            type: "string",
            default: "",
            placeholder: "profile",
            description: "Optional label such as profile, conversation_summary, or custom",
          },
        ],
      },
      {
        displayName: "Output Destination",
        name: "output",
        values: [
          {
            displayName: "Destination Type",
            name: "destinationType",
            type: "options",
            // Mirrors SEMANTIC_DESTINATION_TYPES on the server, so a typo can no
            // longer silently downgrade an egress check to the default.
            options: [
              { name: "Browser Form", value: "BROWSER_FORM" },
              { name: "Custom", value: "CUSTOM" },
              { name: "Email", value: "EMAIL" },
              { name: "External API", value: "EXTERNAL_API" },
              { name: "File", value: "FILE" },
              { name: "Final Output (Back to the User)", value: "FINAL_OUTPUT" },
              { name: "Memory", value: "MEMORY" },
              { name: "Public Output", value: "PUBLIC_OUTPUT" },
              { name: "Tool", value: "TOOL" },
              { name: "Webhook", value: "WEBHOOK" },
            ],
            default: "FINAL_OUTPUT",
            hint: "Where the AI output goes next. Only used when AI Output Text is filled in",
            description: "The destination the AI response is about to reach, used for the data-leak check",
          },
          {
            displayName: "Destination Name",
            name: "destinationName",
            type: "string",
            default: "",
            placeholder: "customer email",
            description: "Optional human-readable label for this destination, used in audit records",
          },
          {
            displayName: "Protected Sources (JSON)",
            name: "protectedSources",
            type: "json",
            typeOptions: { rows: 3 },
            default: "",
            placeholder: '[{ "id": "crm", "content": "internal customer record text" }]',
            hint: "Optional. Private data the response must not leak, as a JSON array",
            description: "JSON array of confidential source snapshots to compare the output against",
          },
        ],
      },
    ],
  },

  {
    displayName: "Project ID",
    name: "projectId",
    type: "string",
    default: "",
    placeholder: "Leave empty to use the credential's project",
    hint: "Optional. Only needed when this node should report to a different project than the credential",
    displayOptions: { hide: { action: ["workflowAudit"] } },
    description: "SoterAI project ID, overriding the one set on the credential",
  },

  // Promoted out of Metadata JSON on version 2. Session ID is what switches on
  // multi-turn attack detection — an attack split across several innocuous-looking
  // messages — so it should not be something a user only discovers by reading a
  // hint on a JSON field.
  {
    displayName: "Session ID",
    name: "sessionId",
    type: "string",
    default: "",
    placeholder: "={{ $json.sessionId }}",
    hint: "Optional but recommended. Links a conversation's messages so attacks spread across several turns can be caught",
    displayOptions: { show: { "@version": [2] }, hide: { action: ["workflowAudit"] } },
    description:
      "Stable per-conversation ID. Without it each message is judged alone, so a slow multi-turn attack can pass one message at a time",
  },
  {
    displayName: "Metadata JSON",
    name: "metadata",
    type: "json",
    typeOptions: { rows: 2 },
    default: "",
    placeholder: '{ "userId": "{{ $json.userId }}", "sessionId": "{{ $json.sessionId }}" }',
    hint: "Optional. Pass sessionId to switch on multi-turn attack detection across a conversation",
    displayOptions: { show: { "@version": [1] }, hide: { action: ["workflowAudit"] } },
    description: "JSON object attached to the request for audit logging and session correlation",
  },
  {
    displayName: "Metadata JSON",
    name: "metadata",
    type: "json",
    typeOptions: { rows: 2 },
    default: "",
    placeholder: '{ "userId": "{{ $json.userId }}", "tenant": "acme" }',
    hint: "Optional. Extra fields for your own audit logs. Session ID has its own field above",
    displayOptions: { show: { "@version": [2] }, hide: { action: ["workflowAudit"] } },
    description: "JSON object attached to the request for audit logging. Secrets and long strings are redacted before sending",
  },

];
