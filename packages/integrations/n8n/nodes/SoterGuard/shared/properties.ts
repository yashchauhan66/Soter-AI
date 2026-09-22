import type { INodeProperties } from "n8n-workflow";

import { IGNORABLE_ENTITIES } from "./localEngine";

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
 *
 * Every `name` and every option `value` here is a storage key: it appears in the
 * JSON of workflows people have already saved. A `displayName` is only ever read
 * by a human, so it can be reworded at will. That asymmetry is why the tidy-up
 * below renames labels freely and does not touch a single value.
 */
export const soterGuardProperties: INodeProperties[] = [
  {
    displayName: "Action",
    name: "action",
    type: "options",
    noDataExpression: true,
    // Order is deliberate, not alphabetical: the everyday guard actions come
    // first (Guard Input is where nearly every workflow starts), and the advanced
    // agent-access actions sit at the bottom. n8n's linter wants options sorted
    // alphabetically, but task order is the better UX here, so that one rule is
    // turned off for this list on purpose.
    // eslint-disable-next-line n8n-nodes-base/node-param-options-type-unsorted-items
    options: [
      {
        name: "Guard Input",
        value: "inputGuard",
        description: "Check a user's message before it reaches the AI, and block or clean it. Start here.",
        action: "Check user input for threats",
      },
      {
        name: "Guard Output",
        value: "outputGuard",
        description: 'Check the AI\'s reply before the user sees it, and block or clean it',
        action: "Check AI output for threats",
      },
      {
        name: "Universal AI Firewall",
        value: "universalGuard",
        description: "All-in-one guard for prompt, files, tools, memory, output, and data leaks. Most complete.",
        action: "Protect an AI workflow end to end",
      },
      {
        name: "Analyze Text",
        value: "analyzeText",
        description: 'Score any text for risk without blocking — Safe and risky items are split so you decide',
        action: "Analyze text for AI security risks",
      },
      {
        name: "Redact PII and Secrets",
        value: "piiRedactor",
        description: "Get a cleaned copy of text with personal data and secrets removed. Use it downstream.",
        action: "Redact PII from text",
      },
      {
        name: "Scan RAG Document",
        value: "ragScanner",
        description: "Check a document before adding it to a knowledge base. Poisoned files are flagged.",
        action: "Scan RAG document for threats",
      },
      {
        name: "Audit Workflow Security",
        value: "workflowAudit",
        description: "Score a workflow's AI, tool, webhook, code, and data-leak risks. Runs locally, sends nothing.",
        action: "Audit an n8n workflow for AI security risks",
      },
      {
        name: "Register Agent",
        value: "enrollIdentity",
        description: 'Give an AI agent a reusable identity with a safe, least-privilege starting policy',
        action: "Register an agent identity",
      },
      {
        name: "Issue Access Pass",
        value: "issuePassport",
        description: 'Give a registered agent a short-lived access pass for one session',
        action: "Issue an agent access pass",
      },
      {
        name: "Validate Access",
        value: "validatePassport",
        description: 'Check that an agent\'s session pass is still valid, and whether an action is allowed',
        action: "Validate an agent access pass",
      },
      {
        name: "Check Tool Call",
        value: "toolCall",
        description: 'Check one tool call an agent wants to make before it runs',
        action: "Check an agent tool call",
      },
      {
        name: "Revoke Access",
        value: "revokePassport",
        description: 'Cancel an agent\'s access pass when the task ends or something looks wrong',
        action: "Revoke an agent access pass",
      },
    ],
    // Guard Input is the default rather than the Universal Firewall: it is the
    // smallest action that actually protects something (two fields, no JSON),
    // and it is where nearly every real workflow starts. Defaulting to a
    // report-only action would be worse — a new user would wire up the node,
    // see it "working", and never learn that nothing was ever blocked.
    //
    // It is also why the label no longer says "(Start Here)": it is already
    // selected when the node is dropped on the canvas.
    default: "inputGuard",
  },

  // ---------------------------------------------------------------------
  // Engine choice. Second field on purpose: after "what should this check",
  // "where does the checking happen" is the next thing a reviewer needs to
  // know, and it decides whether the node needs a credential at all.
  //
  // `noDataExpression` because the engine and the performance options are read
  // once per execution, from the first item. An expression here would look
  // per-item and silently not be — worse than not offering it.
  // ---------------------------------------------------------------------
  {
    displayName: "Detection Engine",
    name: "detectionEngine",
    type: "options",
    noDataExpression: true,
    options: [
      {
        name: "Auto — Cloud, Local Fallback (Recommended)",
        value: "AUTO",
        description: "Use the cloud, and fall back to the local engine only when the cloud cannot be reached. No item is left unchecked. The right default for almost everyone.",
      },
      {
        name: "Cloud Only",
        value: "CLOUD",
        description: "Full detection through the SoterAI API — ML tier, cross-turn tracking, reputation, incident history — and fail the item on an outage rather than fall back. Strongest, but needs a reachable API.",
      },
      {
        name: "Local Only (No API Key, No Network)",
        value: "LOCAL",
        description: "Run the bundled rule engine inside n8n. Nothing leaves your instance and no credential is needed. Pattern-based, so weaker than Cloud.",
      },
    ],
    default: "AUTO",
    // The audit action is local in every mode, so offering the choice there
    // would imply a difference that does not exist.
    displayOptions: { hide: { action: ["workflowAudit", "enrollIdentity", "issuePassport", "validatePassport", "revokePassport"] } },
    // "Recommended" now sits on the same option as the default, rather than on
    // Cloud while the default was Auto — a reader should never see the box
    // pre-set to one thing and told to pick another.
    description: "Where detection runs. Auto (cloud with local fallback) suits almost everyone.",
  },

  {
    displayName: "Agent Name",
    name: "agentName",
    type: "string",
    default: "",
    required: true,
    placeholder: "Customer Support Agent",
    displayOptions: { show: { action: ["enrollIdentity"] } },
    description: "Unique human-readable identity name within the SoterAI project",
  },
  {
    displayName: "Agent Type",
    name: "agentType",
    type: "options",
    options: [
      { name: "Browser Agent", value: "BROWSER_AGENT" },
      { name: "Chatbot", value: "CHATBOT" },
      { name: "Coding Agent", value: "CODING_AGENT" },
      { name: "Computer Use", value: "COMPUTER_USE" },
      { name: "Custom", value: "CUSTOM" },
      { name: "MCP Agent", value: "MCP_AGENT" },
      { name: "RAG Agent", value: "RAG_AGENT" },
    ],
    default: "CUSTOM",
    displayOptions: { show: { action: ["enrollIdentity"] } },
    description: "Agent category recorded on the identity",
  },
  {
    displayName: "Agent Description",
    name: "agentDescription",
    type: "string",
    typeOptions: { rows: 2 },
    default: "",
    displayOptions: { show: { action: ["enrollIdentity"] } },
    description: "Optional purpose and ownership description",
  },
  {
    displayName: "Agent Identity ID",
    name: "agentIdentityId",
    type: "string",
    default: "",
    required: true,
    placeholder: "={{ $json.agentIdentityID }}",
    displayOptions: { show: { action: ["issuePassport"] } },
    description: "Identity ID returned by Register Agent",
  },
  {
    displayName: "Access Pass Lifetime (Seconds)",
    name: "passportTtlSeconds",
    type: "number",
    typeOptions: { minValue: 60, maxValue: 86400 },
    default: 3600,
    displayOptions: { show: { action: ["issuePassport"] } },
    description: "Short lifetime for the issued credential (60 seconds to 24 hours)",
  },
  {
    displayName: "Policy Preset",
    name: "passportPolicyPreset",
    type: "options",
    options: [
      { name: "Coding Agent", value: "CODING" },
      { name: "Custom JSON Only", value: "CUSTOM" },
      { name: "Customer Support", value: "SUPPORT" },
      { name: "Read Only (Recommended)", value: "READ_ONLY" },
    ],
    default: "READ_ONLY",
    displayOptions: { show: { action: ["enrollIdentity", "issuePassport"] } },
    description: "Least-privilege starting policy. Access Policy JSON overrides keys from this preset.",
  },
  {
    displayName: "Access Policy (JSON)",
    name: "passportPolicy",
    type: "json",
    typeOptions: { rows: 5 },
    default: "",
    placeholder: '{ "allowedTools": ["rag.search"], "approvalRequiredTools": ["gmail.send"], "blockedTools": ["terminal.run"] }',
    displayOptions: { show: { action: ["enrollIdentity", "issuePassport"] } },
    description: "Optional policy keys: allowedTools, blockedTools, approvalRequiredTools, allowedDomains, blockedDomains, dataScopes, memoryScopes",
  },
  // Tool Name and Tool Action are split by action, not shared, so the required
  // star tells the truth. Check Tool Call rejects an empty name or action
  // (execute.ts throws "Tool Name and Tool Action are required"), so it carries
  // the star; Validate Access sends them only when present, so there they are
  // genuinely optional and must not be starred. Same storage key either way, so
  // nothing saved is affected.
  {
    displayName: "Tool Name",
    name: "toolName",
    type: "string",
    default: "",
    placeholder: "gmail.send",
    required: true,
    displayOptions: { show: { action: ["toolCall"] } },
    description: "Tool or function the agent plans to call",
  },
  {
    displayName: "Tool Name",
    name: "toolName",
    type: "string",
    default: "",
    placeholder: "gmail.send",
    displayOptions: { show: { action: ["validatePassport"] } },
    description: "Optional tool or function to check the pass against",
  },
  {
    displayName: "Tool Action",
    name: "toolAction",
    type: "string",
    default: "",
    placeholder: "send_email",
    required: true,
    displayOptions: { show: { action: ["toolCall"] } },
    description: "Action the tool will perform",
  },
  {
    displayName: "Tool Action",
    name: "toolAction",
    type: "string",
    default: "",
    placeholder: "send_email",
    displayOptions: { show: { action: ["validatePassport"] } },
    description: "Optional action to check the pass against",
  },
  {
    displayName: "Tool Content",
    name: "toolContent",
    type: "string",
    typeOptions: { rows: 3 },
    default: "",
    placeholder: "={{ $json.arguments }}",
    displayOptions: { show: { action: ["toolCall", "validatePassport"] } },
    description: "Optional tool arguments or payload to inspect",
  },
  {
    displayName: "Tool Target",
    name: "toolTarget",
    type: "string",
    default: "",
    displayOptions: { show: { action: ["toolCall", "validatePassport"] } },
    description: "Optional URL, recipient, file, table, or resource",
  },
  {
    displayName: "Tool Destination",
    name: "toolDestination",
    type: "options",
    options: [
      { name: "External", value: "external" },
      { name: "Internal", value: "internal" },
      { name: "Local", value: "local" },
      { name: "Unknown", value: "unknown" },
    ],
    default: "unknown",
    displayOptions: { show: { action: ["toolCall", "validatePassport"] } },
    description: "How far the planned call reaches",
  },
  {
    displayName: "Access Pass ID",
    name: "passportId",
    type: "string",
    default: "",
    placeholder: "={{ $json.passportID }}",
    displayOptions: { show: { action: ["revokePassport"] } },
    description: "Access pass ID to revoke. Optional when Session ID is provided.",
  },
  {
    displayName: "Revocation Reason",
    name: "revokeReason",
    type: "string",
    default: "",
    placeholder: "Task completed or credential suspected compromised",
    displayOptions: { show: { action: ["revokePassport"] } },
    description: "Audit-safe reason for revocation",
  },
  {
    displayName: "Access Pass Token",
    name: "passportToken",
    type: "string",
    typeOptions: { password: true },
    default: "",
    placeholder: "={{ $json.passportToken }}",
    displayOptions: { show: { action: ["toolCall", "universalGuard", "validatePassport"] } },
    description: "Raw short-lived token returned by Issue Access Pass. Use an expression; do not hard-code it in workflow JSON.",
  },
  // ---------------------------------------------------------------------
  // Per-action notices. These are the honesty layer of the UI: four of the
  // actions never block anything, and a user who assumes otherwise is
  // unprotected while believing they are protected. That claim is worth a
  // notice; anything that is merely useful was moved to a field `hint`, which
  // is why there are fewer of these than there used to be.
  //
  // Version 1 has one output, so its notices have to teach the IF-node
  // workaround. Version 2 routes items itself, so its notices describe the
  // branch that already exists.
  // ---------------------------------------------------------------------
  {
    displayName:
      "Reports risk but never blocks. Add an IF node after this one and branch on <code>{{ $json.allowed }}</code>, or use <b>Guard Input</b> / <b>Guard Output</b> to block automatically.",
    name: "reportOnlyNotice",
    type: "notice",
    default: "",
    displayOptions: { show: { action: ["analyzeText", "ragScanner"], "@version": [1] } },
  },
  {
    displayName:
      "Reports risk without blocking, but it still routes: anything it flags leaves through <b>Flagged</b>. Connect that output to stop the item, or leave it unconnected to drop it.",
    name: "reportOnlyNoticeV2",
    type: "notice",
    default: "",
    displayOptions: { show: { action: ["analyzeText", "ragScanner"], "@version": [2] } },
  },
  {
    displayName:
      "The workflow JSON is analysed in-process and never sent to SoterAI. Static review only — it never executes the workflow or resolves a credential.",
    name: "auditNotice",
    type: "notice",
    default: "",
    displayOptions: { show: { action: ["workflowAudit"] } },
  },
  {
    displayName:
      "<b>Step 1 of 5:</b> Register the agent once, then pass <code>{{ $json.agentIdentityId }}</code> to <b>Issue Access Pass</b>.",
    name: "enrollIdentityNotice",
    type: "notice",
    default: "",
    displayOptions: { show: { action: ["enrollIdentity"] } },
  },
  {
    displayName:
      "<b>Step 2 of 5:</b> Issue a short-lived access pass for one session. Pass <code>sessionId</code> and <code>passportToken</code> by expression; never paste the token into workflow JSON.",
    name: "issuePassportNotice",
    type: "notice",
    default: "",
    displayOptions: { show: { action: ["issuePassport"] } },
  },
  {
    displayName:
      "<b>Step 3 of 5:</b> Validate the session and token. Tool Name and Tool Action are optional — add them to test authorization for a specific planned call.",
    name: "validatePassportNotice",
    type: "notice",
    default: "",
    displayOptions: { show: { action: ["validatePassport"] } },
  },
  {
    displayName:
      "<b>Step 4 of 5:</b> Put this immediately before the real tool. ALLOW leaves through <b>Safe</b>; blocked, invalid, or approval-required calls leave through <b>Flagged</b>.",
    name: "toolCallNotice",
    type: "notice",
    default: "",
    displayOptions: { show: { action: ["toolCall"] } },
  },
  {
    displayName:
      "<b>Step 5 of 5:</b> Revoke by Session ID or Access Pass ID when the task ends. Successful revocation returns <code>PASSPORT_REVOKED</code> on <b>Safe</b>.",
    name: "revokePassportNotice",
    type: "notice",
    default: "",
    displayOptions: { show: { action: ["revokePassport"] } },
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
    description: "How strict detection is. Maximum suits production and public chatbots.",
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
    // Replaces what used to be a separate notice above this field. The same
    // sentence, attached to the input it is about, is one fewer text wall.
    hint: "Always continues. The redacted copy arrives as {{ $json.outputText }} — this text is never modified in place",
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
    // Placeholder suggests `documentId`, the field name the bundled example
    // workflows use. A bare lowercase "id" token is rejected by n8n's
    // placeholder lint, and `$json.id` cannot be written here for the same
    // reason — users whose items carry `id` can still type it themselves.
    placeholder: "={{ $json.documentId }}",
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
    // Names the field that sets the customer-facing wording. Without this
    // pointer people look for a "Custom Block Message" field next to On Threat,
    // do not find one, and conclude the node cannot do it — the reply override
    // has been in Customer Replies all along.
    hint: "Sets WHAT HAPPENS once something is flagged. To change the wording a customer sees, use Customer Replies below",
    displayOptions: { show: { action: ["inputGuard", "outputGuard", "universalGuard"] } },
    description: "What this node does locally once SoterAI flags a threat",
  },
  {
    displayName: "Sensitivity",
    name: "sensitivity",
    type: "options",
    options: [
      {
        name: "Balanced (Default)",
        value: "BALANCED",
        description: "Stop anything the engine judges unsafe. Same behaviour as every previous version of this node.",
      },
      {
        name: "Lenient (Fewest Blocks)",
        value: "LENIENT",
        description:
          "Stop only confident, high-risk verdicts. Borderline findings are reported and the message continues — best for public helpdesks where a wrong block costs a customer.",
      },
      {
        name: "Strict (Most Blocks)",
        value: "STRICT",
        description: "Also act on findings Balanced would only report. Expect more false positives.",
      },
    ],
    default: "BALANCED",
    hint: "Sets HOW MUCH gets flagged. 'On Threat' above sets WHAT HAPPENS to it",
    displayOptions: { show: { action: ["inputGuard", "outputGuard"] } },
    description: "How much risk is enough to act on. Live secrets and clear attacks are always acted on.",
  },

  // ---------------------------------------------------------------------
  // Optional / advanced detection scope, versions 1 and 2.
  //
  // On those versions these are top-level fields, and they must stay that way:
  // a field's `name` is the storage key in saved workflow JSON, so moving a
  // published parameter into a collection silently orphans the values already
  // saved in users' live workflows — for a security node, protection quietly
  // turning itself off. They are gated by displayOptions instead, so each action
  // only shows the fields it actually reads.
  //
  // Version 3 presents the identical five fields inside an "Advanced Detection"
  // collection (defined further below, gated to @version 3) so a guard opens
  // showing only its common fields. execute.ts reads them from the collection
  // when the node is v3 and from these top-level fields otherwise, so no saved
  // v1/v2 workflow is touched. The `@version` gate here is what keeps the two
  // layouts from both rendering on the same node.
  // ---------------------------------------------------------------------
  {
    // Renamed from "Allowed Topics". The old label read like a general
    // allow-list, so authors reached for it to keep an identifier — adding
    // "bank account no" here and expecting account numbers to stop being
    // redacted. It has only ever meant subjects. "Semantic" says which kind of
    // allow-list this is, and the hint points at the other one.
    displayName: "Allowed Semantic Topics",
    name: "allowedTopics",
    type: "string",
    default: "",
    placeholder: "billing, shipping, returns, order status",
    hint: "Subjects, not data types. To stop an identifier being redacted, use Ignored Identifiers below",
    displayOptions: { show: { "@version": [1, 2], action: ["inputGuard", "universalGuard"] } },
    description: "Subjects this assistant handles, comma-separated. Leave empty for no topic scope.",
  },
  {
    displayName: "Topic Handling",
    name: "topicHandling",
    type: "options",
    options: [
      {
        name: "Advisory Only",
        value: "ADVISORY",
        description: "Report whether the message was in scope and change nothing else",
      },
      {
        name: "Stay on Topic",
        value: "RESTRICT",
        description: "Also treat an out-of-scope message as something to act on. Reported as OFF_TOPIC, never as a threat.",
      },
      {
        name: "Trust My Topics (Default)",
        value: "TRUST",
        description:
          "Stop treating ordinary questions about your own topics as attacks. The usual fix for a helpdesk that blocks its own customers.",
      },
      {
        name: "Trust My Topics and Stay on Topic",
        value: "TRUST_AND_RESTRICT",
        description: "Both of the above: in-scope questions run freely, out-of-scope ones are acted on",
      },
    ],
    default: "TRUST",
    // Carries what used to be a whole notice below this block: Local names each
    // withdrawn rule in suppressedFindings, Cloud scores the topics server-side
    // and returns no per-rule list.
    hint: "Does nothing while Allowed Semantic Topics is empty. Anything withdrawn is listed under suppressedFindings",
    displayOptions: { show: { "@version": [1, 2], action: ["inputGuard", "universalGuard"] } },
    description: "What your allowed topics do to the verdict. Never withdraws a clear attack pattern.",
  },
  {
    displayName: "System Prompt Context",
    name: "systemPromptContext",
    type: "string",
    typeOptions: { rows: 2 },
    default: "",
    placeholder: "You are a billing support assistant for an Indian e-commerce store",
    hint: "Optional. Use it when the topic list is not specific enough — its words widen the topic vocabulary",
    displayOptions: { show: { "@version": [1, 2], action: ["inputGuard", "universalGuard"] } },
    description: 'Your assistant\'s role, used to judge whether a message is in scope',
  },

  // ---------------------------------------------------------------------
  // The redaction allow-list. Separate from the topic list because they answer
  // different questions: topics decide whether a message is in scope, this
  // decides whether a particular kind of identifier is treated as sensitive at
  // all. A bank helpdesk that cannot see an account number cannot look up an
  // account, and that is a legitimate configuration — but only for identifiers,
  // never for live credentials, which is why the list of choices is fixed and
  // API keys, private keys, and tokens are not on it.
  //
  // Options come from the engine's own catalogue, so the dropdown and what the
  // redactor honours cannot drift apart. Version-3 copy lives in the collection
  // below; see the note on Allowed Semantic Topics above.
  // ---------------------------------------------------------------------
  {
    displayName: "Ignored Identifiers",
    name: "ignoredEntities",
    type: "multiOptions",
    default: [],
    options: IGNORABLE_ENTITIES.map((entity) => ({ name: entity.label, value: entity.key })),
    hint: "Leave empty to redact everything. Credentials — API keys, private keys, tokens — can never be ignored",
    displayOptions: { show: { "@version": [1, 2], action: ["inputGuard", "outputGuard", "universalGuard", "piiRedactor"] } },
    description: "Identifier types to leave unredacted. Credentials can never be ignored.",
  },
  {
    displayName: "Always Allow",
    name: "alwaysAllow",
    type: "string",
    typeOptions: { rows: 4 },
    default: "",
    placeholder: "where is my order?\nhow do I reset my password?",
    hint: "One message per line. Matched on the WHOLE message, ignoring case and a trailing '?'",
    displayOptions: { show: { "@version": [1, 2], action: ["inputGuard", "universalGuard"] } },
    description: "Whole messages that skip detection entirely. Whole-message match, not keywords.",
  },
  {
    // Version-3 only. The Ignored Identifiers dropdown covers identifier *types*;
    // this covers the exact words an author types — a company name that looks
    // like a surname, an internal order id, a product codename — that redaction
    // would otherwise remove. Kept verbatim wherever they appear. A line carrying
    // a credential is refused, not kept, so this can never leave a live secret in
    // the clear. Sourced by propertiesV3 into the v3 Options collection; the
    // @version [3] gate keeps it off the v1/v2 panels entirely.
    displayName: "Ignored Words or Phrases",
    name: "ignoredWords",
    type: "string",
    typeOptions: { rows: 3 },
    default: "",
    placeholder: "Acme Corp\nORD-12345\nProject Bluebird",
    hint: "One per line, case-insensitive. Never applies to credentials — a line containing an API key, token, or private key is refused, not kept. Values survive in Local mode; in Cloud mode the server may redact them before the node sees them.",
    displayOptions: { show: { "@version": [3], action: ["inputGuard", "outputGuard", "universalGuard", "piiRedactor"] } },
    description: "Literal words or phrases to leave unredacted wherever they appear",
  },
  {
    // Version-3 only, and off, because turning it on changes whether items stop.
    //
    // On Threat has never reached a secret or a personal detail. The engine
    // answers those with "redact and continue" — the item is fine, the text just
    // carried something that should not travel — so `allowed` stays true and the
    // On Threat switch, which only runs for an item the engine refused, never
    // sees it. The panel says On Threat decides "what happens once SoterAI flags
    // a threat", and a live API key is flagged, so Block reading as "continue
    // anyway" is the field breaking its own promise on the one category this
    // product is named for.
    //
    // It cannot simply be fixed in place: On Threat defaults to Block, so making
    // it apply would turn every saved workflow into one that stops any message
    // containing an email address. Hence a switch, default off, where off is
    // exactly what every published version already does.
    displayName: "Also Enforce On Sensitive Data",
    name: "enforceOnSensitiveData",
    type: "boolean",
    default: false,
    hint: "Off: a secret or personal detail is always removed and the item continues, whatever On Threat says. On: On Threat decides — Block stops the item and routes it to Flagged. The cleaned text is used either way; this never passes an unredacted secret through.",
    displayOptions: { show: { "@version": [3], action: ["inputGuard", "outputGuard", "universalGuard"] } },
    description: "Whether On Threat also acts on an item whose only finding is a secret or personal data",
  },

  // ---------------------------------------------------------------------
  // Customer-facing wording. A new collection rather than new top-level
  // fields: nothing here was ever published, so grouping orphans nothing, and
  // seven optional sentences would otherwise dominate the panel for the
  // majority of users who never change them.
  // ---------------------------------------------------------------------
  {
    displayName: "Customer Replies",
    name: "userMessages",
    type: "collection",
    placeholder: "Add Reply",
    default: {},
    displayOptions: { show: { action: ["inputGuard", "outputGuard", "universalGuard", "analyzeText"] } },
    description: 'Your own wording for the customer-facing message, replacing the built-in English',
    options: [
      {
        displayName: "Allowed Message",
        name: "allowed",
        type: "string",
        default: "",
        placeholder: "Thanks! Checking that for you now.",
        description: "Shown when the message passed",
      },
      {
        displayName: "Blocked Message",
        name: "blocked",
        type: "string",
        default: "",
        placeholder: "Sorry, I can't help with that one. Please rephrase it and try again.",
        description:
          "The custom block message. Used for any stopped message with no more specific reply set below, so on its own it replaces every block message the node produces.",
      },
      {
        displayName: "Off-Topic Message",
        name: "offTopic",
        type: "string",
        default: "",
        placeholder: "I can only help with orders, billing and returns.",
        description: "Shown when Topic Handling stopped a message for being out of scope. Nothing was judged dangerous.",
      },
      {
        displayName: "Prompt Injection Message",
        name: "promptInjection",
        type: "string",
        default: "",
        placeholder: "I can only help with normal support questions.",
        description: "Shown for prompt injection, jailbreak, or system-prompt extraction attempts",
      },
      {
        displayName: "Redacted Message",
        name: "redacted",
        type: "string",
        default: "",
        placeholder: "I've removed some private details so we can continue safely.",
        description: "Shown when sensitive data was removed and the message continued",
      },
      {
        displayName: "Rephrase Needed Message",
        name: "needsRephrase",
        type: "string",
        default: "",
        placeholder: "Could you rewrite that without the private details?",
        description: "Shown when the verdict was to ask for a safer version rather than to stop outright",
      },
      {
        displayName: "Sensitive Data Message",
        name: "sensitiveData",
        type: "string",
        default: "",
        placeholder: "Please don't share passwords or card numbers here.",
        description: "Shown when a secret, card number, or personal identifier was the reason",
      },
    ],
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
      "Adds the RAG, tool-call, memory, and output-destination layers. Supported keys: rag, tool, memory, output.",
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
      "Optional extra layers to check alongside the prompt and response. Add only the ones your workflow actually has — each is independent.",
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
            displayName: "Content",
            name: "content",
            type: "string",
            typeOptions: { rows: 2 },
            default: "",
            placeholder: "={{ $json.toolPayload }}",
            description: "Optional payload the AI generated for the call. Defaults to Input Text when empty.",
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
            displayName: "Risk Context (JSON)",
            name: "riskContext",
            type: "json",
            typeOptions: { rows: 3 },
            default: "",
            placeholder: '{ "canSendMessage": true, "canModifyData": false, "canRunCode": false }',
            hint: "Optional capability flags describing what this tool is able to do",
            description: "JSON object of capability flags used to weigh how dangerous the call is",
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
            displayName: "Tool Action",
            name: "action",
            type: "string",
            default: "",
            placeholder: "send",
            hint: "Required once this layer is added",
            description: "What the call would do, such as send, write, delete, or query",
          },
          {
            displayName: "Tool Name",
            name: "name",
            type: "string",
            default: "",
            placeholder: "email.send",
            hint: "Required once this layer is added",
            description: "The tool or function the AI wants to call",
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
            description: "The text being written or read. Defaults to Input Text when empty.",
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
            // Literal request payload. `sourceId` is the canonical identifier
            // key the node reads first (`id` and `name` are also accepted);
            // a bare lowercase "id" token is rejected by n8n's placeholder
            // lint, so the example uses the canonical key.
            placeholder: '[{ "sourceId": "crm", "content": "internal customer record text" }]',
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
  // Session ID is split so its required star is honest. Validate Access refuses
  // to run without it (execute.ts throws "Session ID is required to validate a
  // passport"), so that one variant is required and starred. Everywhere else the
  // node sends it only when present — it is optional but recommended for guards —
  // so that variant carries no star. Same storage key, and the two are mutually
  // exclusive by action, so exactly one ever renders.
  {
    displayName: "Session ID",
    name: "sessionId",
    type: "string",
    default: "",
    placeholder: "={{ $json.sessionId }}",
    required: true,
    displayOptions: { show: { "@version": [2, 3], action: ["validatePassport"] } },
    description: "Stable per-conversation ID the pass was issued against. Validation is refused without it.",
  },
  {
    displayName: "Session ID",
    name: "sessionId",
    type: "string",
    default: "",
    placeholder: "={{ $json.sessionId }}",
    hint: "Optional but recommended for guards, so a multi-turn attack cannot pass one message at a time. Revoke accepts this or the Access Pass ID.",
    displayOptions: { show: { "@version": [2, 3] }, hide: { action: ["workflowAudit", "enrollIdentity", "validatePassport"] } },
    description:
      "Stable per-conversation ID. Without it each message is judged alone, so a slow multi-turn attack can pass one message at a time.",
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
    displayOptions: { show: { "@version": [2, 3] }, hide: { action: ["workflowAudit"] } },
    description: "JSON object attached to the request for audit logging. Secrets and long strings are redacted before sending.",
  },

  // ---------------------------------------------------------------------
  // Advanced Detection, version 3 only. The same five fields the v1/v2 panel
  // shows at the top level (Allowed Semantic Topics, Topic Handling, System
  // Prompt Context, Ignored Identifiers, Always Allow), folded into a collection
  // so a guard opens showing only its common fields and the author reaches for
  // these only when they need them.
  //
  // Safe to group here — and only here — because this is a NEW typeVersion: a v3
  // node has never been saved with these as top-level keys, so nothing is
  // orphaned. v1/v2 nodes keep their flat fields (gated @version [1,2] above) and
  // are untouched. execute.ts reads these from the collection when the node is
  // v3 (readDetectionOption) and from the flat fields otherwise, so the two
  // layouts are behaviourally identical.
  //
  // Inner fields keep the exact per-action visibility the flat fields had, via a
  // leading-slash `/action` path that reads the root-level Action — the same
  // pattern the Options collection uses for `/detectionEngine`. The collection
  // itself shows only for the four actions that read any of these, so it never
  // appears as an empty dropdown on an action that ignores all five.
  // ---------------------------------------------------------------------
  {
    displayName: "Advanced Detection",
    name: "advancedDetection",
    type: "collection",
    placeholder: "Add Detection Option",
    default: {},
    displayOptions: {
      show: { "@version": [3], action: ["inputGuard", "outputGuard", "universalGuard", "piiRedactor"] },
    },
    description: "Topic scope, redaction allow-list, and always-allow phrases. All optional.",
    // Inner options are ordered alphabetically by displayName to satisfy the n8n
    // linter (node-param-collection-type-unsorted-items). Order inside a
    // collection is display-only — n8n stores the values as an object keyed by
    // `name` — so this is not a storage change.
    options: [
      {
        displayName: "Allowed Semantic Topics",
        name: "allowedTopics",
        type: "string",
        default: "",
        placeholder: "billing, shipping, returns, order status",
        hint: "Subjects, not data types. To stop an identifier being redacted, use Ignored Identifiers below",
        displayOptions: { show: { "/action": ["inputGuard", "universalGuard"] } },
        description: "Subjects this assistant handles, comma-separated. Leave empty for no topic scope.",
      },
      {
        displayName: "Always Allow",
        name: "alwaysAllow",
        type: "string",
        typeOptions: { rows: 4 },
        default: "",
        placeholder: "where is my order?\nhow do I reset my password?",
        hint: "One message per line. Matched on the WHOLE message, ignoring case and a trailing '?'",
        displayOptions: { show: { "/action": ["inputGuard", "universalGuard"] } },
        description: "Whole messages that skip detection entirely. Whole-message match, not keywords.",
      },
      {
        displayName: "Ignored Identifiers",
        name: "ignoredEntities",
        type: "multiOptions",
        default: [],
        options: IGNORABLE_ENTITIES.map((entity) => ({ name: entity.label, value: entity.key })),
        hint: "Leave empty to redact everything. Credentials — API keys, private keys, tokens — can never be ignored",
        displayOptions: { show: { "/action": ["inputGuard", "outputGuard", "universalGuard", "piiRedactor"] } },
        description: "Identifier types to leave unredacted. Credentials can never be ignored.",
      },
      {
        displayName: "System Prompt Context",
        name: "systemPromptContext",
        type: "string",
        typeOptions: { rows: 2 },
        default: "",
        placeholder: "You are a billing support assistant for an Indian e-commerce store",
        hint: "Optional. Use it when the topic list is not specific enough — its words widen the topic vocabulary",
        displayOptions: { show: { "/action": ["inputGuard", "universalGuard"] } },
        description: 'Your assistant\'s role, used to judge whether a message is in scope',
      },
      {
        displayName: "Topic Handling",
        name: "topicHandling",
        type: "options",
        options: [
          {
            name: "Advisory Only",
            value: "ADVISORY",
            description: "Report whether the message was in scope and change nothing else",
          },
          {
            name: "Stay on Topic",
            value: "RESTRICT",
            description: "Also treat an out-of-scope message as something to act on. Reported as OFF_TOPIC, never as a threat.",
          },
          {
            name: "Trust My Topics (Default)",
            value: "TRUST",
            description:
              "Stop treating ordinary questions about your own topics as attacks. The usual fix for a helpdesk that blocks its own customers.",
          },
          {
            name: "Trust My Topics and Stay on Topic",
            value: "TRUST_AND_RESTRICT",
            description: "Both of the above: in-scope questions run freely, out-of-scope ones are acted on",
          },
        ],
        default: "TRUST",
        hint: "Does nothing while Allowed Semantic Topics is empty. Anything withdrawn is listed under suppressedFindings",
        displayOptions: { show: { "/action": ["inputGuard", "universalGuard"] } },
        description: "What your allowed topics do to the verdict. Never withdraws a clear attack pattern.",
      },
    ],
  },

  // ---------------------------------------------------------------------
  // Performance and transport. A collection, because every option in it is
  // new in this version — nothing here was ever a top-level field, so nothing
  // saved in an existing workflow can be orphaned by grouping them.
  //
  // Every default reproduces the previous version's behaviour exactly, so
  // upgrading changes nothing until the user opens this and asks for more.
  // ---------------------------------------------------------------------
  {
    displayName: "Options",
    name: "advancedOptions",
    type: "collection",
    placeholder: "Add Option",
    default: {},
    displayOptions: { hide: { action: ["workflowAudit"] } },
    options: [
      {
        displayName: "Include Raw API Response",
        name: "includeRawResponse",
        type: "boolean",
        default: true,
        description:
          "Whether to attach the full API response as rawResponse. It is recursively sanitized first, but turning it off keeps run data smaller on high-volume workflows.",
      },
      {
        displayName: "Items in Parallel",
        name: "batchConcurrency",
        type: "number",
        typeOptions: { minValue: 1, maxValue: 20 },
        default: 1,
        description:
          "How many input items to check at the same time. The default of 1 is sequential, so a hundred items are a hundred requests one after another, not a burst. Raising it is the single biggest speed win on large batches; a 429 is retried after the interval the API asks for either way. Order of the output items never changes.",
      },
      {
        displayName: "Layers in Parallel",
        name: "parallelLayers",
        type: "boolean",
        default: true,
        description:
          "Whether the Universal AI Firewall runs its optional layers at the same time instead of one after another. Turn it off if your plan's per-minute rate limit is tight.",
      },
      {
        // Only meaningful in Auto — Cloud already fails and Local is already
        // local — so it is hidden elsewhere rather than sitting there doing
        // nothing. The leading slash reads the root-level engine parameter.
        //
        // Default false, and it has to stay false: every published version of
        // this node has failed open, and flipping that on upgrade would turn a
        // ten-minute API outage into a stopped production workflow for people
        // who never asked for it.
        displayName: "Never Downgrade to Local",
        name: "neverDowngradeToLocal",
        type: "boolean",
        default: false,
        displayOptions: { show: { "/detectionEngine": ["AUTO"] } },
        description:
          "Whether to fail an item instead of answering it with the local engine when the cloud cannot be reached. For workflows under a compliance commitment that every message is checked by the full engine. With n8n's Continue On Fail set, failed items still leave through the Flagged output rather than Safe.",
      },
      {
        displayName: "Request Timeout (Ms)",
        name: "requestTimeoutMs",
        type: "number",
        typeOptions: { minValue: 1000, maxValue: 120000 },
        default: 20000,
        description: "How long to wait for each API call before giving up. In Auto mode a timeout is what triggers the local fallback.",
      },
      {
        displayName: "Reuse Identical Items",
        name: "reuseIdenticalItems",
        type: "boolean",
        default: true,
        description:
          "Whether two identical items in the same execution reuse one API call. The reused item is marked reusedResult so it is never mistaken for a second independent check.",
      },
    ],
  },

];
