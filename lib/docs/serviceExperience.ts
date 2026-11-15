export interface ServiceAuthentication {
  kind: "session" | "api-key" | "admin-session" | "dashboard-session" | "public";
  label: string;
  description: string;
  permission?: string;
}

export interface ServiceExperience {
  dashboardHref: string;
  dashboardLabel: string;
  authentication: ServiceAuthentication;
  setup: Array<{ heading: string; body: string }>;
  validation: Array<{ heading: string; body: string }>;
  integrationNotes: string[];
  limitations: string[];
  /** Repository evidence for the catalog audit, not a runtime-verification claim. */
  sourceFiles: string[];
}

function session(permission: string): ServiceAuthentication {
  return {
    kind: "session",
    label: "Dashboard session",
    description: `Use a signed-in application session with ${permission} permission. An x-api-key header does not authenticate this route.`,
    permission,
  };
}

const projectApiKey: ServiceAuthentication = {
  kind: "api-key",
  label: "Project API key",
  description: "Send x-api-key from a trusted backend. The key identifies the project; a dashboard session does not replace it. Keep the key out of browser code and agent prompts.",
};

export const SERVICE_EXPERIENCE: Record<string, ServiceExperience> = {
  "guard-logs": {
    dashboardHref: "/dashboard/logs",
    dashboardLabel: "Guard Logs",
    authentication: session("logs:read"),
    setup: [
      {"heading": "Select the investigation scope", "body": "Open Guard Logs with a signed-in account. Select the relevant project and choose a date range that includes a known request."},
      {"heading": "Apply a reproducible filter", "body": "Filter by direction and decision before narrowing by risk type. Record the filter values alongside any incident notes so another reviewer can repeat the query."},
    ],
    validation: [
      {"heading": "Locate a known event", "body": "Send a synthetic request through the project Guard integration, retain the response, and check that its direction, decision, and time appear after persistence completes."},
      {"heading": "Check pagination and exclusions", "body": "Use Next page when a cursor is returned and confirm the selected project stays unchanged. Do not expect a standalone Memory check or the Firewall inspect preview to appear here."},
    ],
    integrationNotes: [
      "GET /api/logs is a session-authenticated dashboard API with logs:read permission. Supply projectId only for a project in the active organization.",
      "The response is { logs, nextCursor }, not a bare array. There is no free-text query parameter or permanent-retention guarantee in this route.",
    ],
    limitations: [
      "Persistence and retention depend on the configured event-store path. A successful Guard response does not prove that every background log write has completed.",
      "This is not a raw-content recovery tool or a universal audit stream for every SoterAI feature.",
    ],
    sourceFiles: [
      "app/api/logs/route.ts",
      "app/dashboard/logs/page.tsx",
      "lib/auth/guards.ts",
      "lib/guard/logFilters.ts",
      "app/api/guard/input/route.ts",
    ],
  },
  "reports": {
    dashboardHref: "/dashboard/reports",
    dashboardLabel: "Reports",
    authentication: session("reports:read"),
    setup: [
      {"heading": "Choose the project and month", "body": "Open Reports for a project you can read. Check the selected period and ensure there is recorded Guard activity to summarize."},
      {"heading": "Allow generation to finish", "body": "If generation is queued, wait for the background worker and refresh the report. Configure monthly delivery separately if the deployment supports its worker and mail setup."},
    ],
    validation: [
      {"heading": "Distinguish accepted from completed", "body": "Check whether the request returned HTTP 202 or a report object. After the worker finishes, confirm the report period and project match the request."},
      {"heading": "Reconcile the result", "body": "Compare report totals with recorded activity for the same period. Open the generated report or white-label view and check its actual contents before sharing it."},
    ],
    integrationNotes: [
      "GET /api/reports requires a session and reports:read permission. Despite using GET, a cache miss enqueues work and updates onboarding records.",
      "month must be 1–12 and year must be 2020–2200. An invalid period returns HTTP 400 with ‘Invalid report month or year.’ A 202 response requires a functioning background worker.",
    ],
    limitations: [
      "The current dashboard scheduling workflow is monthly; the catalog does not promise arbitrary daily or weekly schedules.",
      "Reports summarize available records. Recommendations and OWASP alignment are not independent testing, certification, or proof that a system is secure.",
    ],
    sourceFiles: [
      "app/api/reports/route.ts",
      "app/dashboard/reports/page.tsx",
      "lib/auth/guards.ts",
      "components/dashboard/ScheduledReportManager.tsx",
      "app/api/scheduled-reports/route.ts",
    ],
  },
  "detection-feedback": {
    dashboardHref: "/dashboard/detection-feedback",
    dashboardLabel: "Detection Feedback",
    authentication: session("feedback:create"),
    setup: [
      {"heading": "Identify the disputed decision", "body": "Find the recorded Guard decision and note its guardLogId. Use synthetic or sanitized context when explaining why the observed decision was wrong."},
      {"heading": "Submit a bounded review note", "body": "Choose a supported feedback label and, if useful, a note of at most 500 characters. Open Detection Feedback to review the saved label and status."},
    ],
    validation: [
      {"heading": "Confirm the saved label", "body": "Check the HTTP 201 response and the matching feedback row. Re-submitting for the same log and author should update that feedback rather than create a second opinion."},
      {"heading": "Keep training and review separate", "body": "Confirm the review state is PENDING, then use your review process to decide on a policy change. Feedback submission does not trigger model training in this route."},
    ],
    integrationNotes: [
      "POST /api/feedback takes guardLogId, feedback, and optional note. It uses session authorization, not an API key or the legacy correct/correctAction payload.",
      "The dashboard is a read-only quality view. Feedback retains project and author identifiers; it is not anonymous. A missing stored GuardLog returns HTTP 404, ‘Guard log not found.’",
    ],
    limitations: [
      "No bulk feedback endpoint or automatic retraining is established by this route.",
      "The feedback endpoint reads the stored GuardLog table; event-store-only entries may not be available for feedback. Label rates reflect reviewed samples, not all traffic.",
    ],
    sourceFiles: [
      "app/api/feedback/route.ts",
      "app/dashboard/detection-feedback/page.tsx",
      "lib/ops/quality.ts",
      "lib/auth/guards.ts",
    ],
  },
  "customer-success": {
    dashboardHref: "/dashboard/customer-success",
    dashboardLabel: "Customer Success",
    authentication: { kind: "dashboard-session", label: "Dashboard only", description: "Sign in to view the active organization's onboarding, support, and usage records. There is no dedicated customer-success API in this catalog." },
    setup: [
      {"heading": "Open the organization view", "body": "Sign in and open Customer Success for the organization whose onboarding and support records you intend to review."},
      {"heading": "Use the underlying workflows", "body": "Complete onboarding through its dedicated checklist and manage support through the support workspace. This page reads their records rather than configuring a new tracking integration."},
    ],
    validation: [
      {"heading": "Reconcile recorded progress", "body": "Compare an existing onboarding record's first Guard timestamp and step events with the activation and funnel indicators shown on this page."},
      {"heading": "Interpret the health label", "body": "Compare the label with the age of the latest stored Guard log and open-ticket count. An account with no Guard log is treated as inactive; this is not an observed cancellation."},
    ],
    integrationNotes: [
      "There is no dedicated customer-success API endpoint in this catalog. Open the signed-in dashboard rather than calling a guessed /v1 path.",
      "The view is organization-wide and read-only. It does not configure Slack/email alerts or automatically contact customers.",
    ],
    limitations: [
      "The churn label is a threshold heuristic, not an ML prediction or a measured likelihood of churn.",
      "Indicators depend on recorded onboarding, event, ticket, and GuardLog data. Missing instrumentation can make adoption look lower than it is.",
    ],
    sourceFiles: [
      "app/dashboard/customer-success/page.tsx",
      "lib/ops/onboarding.ts",
      "lib/auth/guards.ts",
    ],
  },
  "agent-firewall": {
    dashboardHref: "/dashboard/agent-firewall",
    dashboardLabel: "Agent Firewall",
    authentication: session("policy:manage"),
    setup: [
      {"heading": "Choose the correct route", "body": "Use inspect for an authorized dashboard-side permission preview. For an agent integration, use the documented agent-action path rather than assuming inspect accepts a project API key."},
      {"heading": "Gate the tool executor", "body": "Place the action check immediately before the real tool call. Hold approval/review states and errors; execute only the operation and content your policy explicitly permits."},
    ],
    validation: [
      {"heading": "Validate the inspect response", "body": "Test an enabled permitted tool and a disabled or denied tool in an isolated setup. Compare the returned decision and reason directly; inspect does not create dashboard action logs."},
      {"heading": "Validate the recorded path separately", "body": "For /api/agent/action/check, retain its auditId and inspect the Agent Firewall action list. Verify with a stub tool that a denied decision never reaches the real executor."},
    ],
    integrationNotes: [
      "POST /api/agent-firewall/inspect requires a session and policy:manage permission. It is not the API-key SDK action endpoint.",
      "POST /api/agent/action/check is a distinct project-API-key route. Its non-Guard mutation also needs a matching canonical Origin/Referer; without either header middleware returns HTTP 403 before API-key authentication. Confirm the deployment origin and use the agent guide; an inspect response is not an approval token. Action checks require an issued passport with matching sessionId and passportToken; starting a generic agent session is not passport issuance. Passport-level ASK_APPROVAL creates no AgentApproval record or approval token: hold the action and use an explicit reviewed approval path. The later firewall-policy approval branch runs only after passport ALLOW.",
    ],
    limitations: [
      "Preview policy evaluation is not automatic interception of all live agent activity.",
      "The inspect route does not persist logs or create human approvals. The action workflow records decisions, but only your executor can stop the actual operation.",
    ],
    sourceFiles: [
      "app/api/agent-firewall/inspect/route.ts",
      "app/api/agent/action/check/route.ts",
      "app/dashboard/agent-firewall/page.tsx",
      "lib/agent-firewall/server.ts",
      "lib/agent-firewall/index.ts",
      "lib/agent-passport/server.ts",
      "lib/agent-passport/index.ts",
      "lib/auth/guards.ts",
      "lib/csrf.ts",
    ],
  },
  "policy-engine": {
    dashboardHref: "/dashboard/policy",
    dashboardLabel: "Policy Engine",
    authentication: session("policy:manage"),
    setup: [
      {"heading": "Review the current project configuration", "body": "Open Policy Engine and select the intended project. Record its current values before changing detector, output, or custom-rule settings."},
      {"heading": "Save an explicit policy", "body": "Use the editor or an authorized same-origin application request. Send all values you intend to preserve: omitted PUT fields are reset to route defaults, not merged as a partial patch."},
    ],
    validation: [
      {"heading": "Read back the saved values", "body": "Reopen the policy or retrieve it with GET /api/projects/policy?projectId=… and compare the mode, switches, and thresholds with the intended configuration."},
      {"heading": "Exercise the actual Guard path", "body": "Run synthetic benign and expected-risk requests through your project Guard integration. Compare their actions and retained logs with your acceptance criteria before increasing traffic."},
    ],
    integrationNotes: [
      "PUT /api/projects/policy is session-authenticated with policy:manage permission. It does not accept the old nested policy/riskThresholds action-object example.",
      "riskThresholds is a record of integer values from 0–100. customBlockedTopics, allowlistedDomains, and deniedPatterns each allow at most 50 entries; fallback messages are bounded to 500 characters.",
    ],
    limitations: [
      "PUT resets omitted fields to defaults. Read-modify-write carefully when updating through an application workflow.",
      "This project-policy route does not establish version history, rollback, arbitrary IP rules, or a compliance rules engine.",
    ],
    sourceFiles: [
      "app/api/projects/policy/route.ts",
      "app/dashboard/policy/page.tsx",
      "components/dashboard/PolicyForm.tsx",
      "lib/guard/policy.ts",
      "lib/auth/guards.ts",
    ],
  },
  "rag-security": {
    dashboardHref: "/dashboard/rag/security",
    dashboardLabel: "RAG Security",
    authentication: session("rag:read"),
    setup: [
      {"heading": "Distinguish preview from live data", "body": "Open RAG Security to review simulation coverage. Use the RAG workspace and your own retrieval integration to prepare documents and permissions; the preview itself needs no live collection."},
      {"heading": "Define retrieval authorization", "body": "For the query route, choose the project and collection, use the intended session principal, and explicitly set ACL and source restrictions appropriate to your data."},
    ],
    validation: [
      {"heading": "Check the simulation's scope", "body": "Review detected and missed cases in the built-in benchmark. Record that this is local simulation coverage, not an end-to-end test of your documents or model."},
      {"heading": "Test authorized and denied retrieval", "body": "In a controlled collection, compare retrieval for an authorized document with one outside the caller's ACL. Inspect returned text and authorization receipts before passing any result to a model."},
    ],
    integrationNotes: [
      "POST /api/rag/query requires a signed-in session and rag:read permission; an API key alone is not accepted by its handler.",
      "query is limited to 8,000 characters, result limit to 1–50, and allowedDocumentIds/allowedSources to 100 each. requirePrincipalAcl defaults to false unless deployment configuration requires it.",
    ],
    limitations: [
      "The linked RAG Security dashboard is a simulation, not a document-management form or live protection status page.",
      "Scanning and authorization are not proof of source truth or complete RAG protection. External vector-store behavior and downstream receipt enforcement require deployment validation.",
    ],
    sourceFiles: [
      "app/api/rag/query/route.ts",
      "app/dashboard/rag/security/page.tsx",
      "lib/rag/benchmarks/poisoning.ts",
      "lib/rag/vector/vectorProvider.ts",
      "lib/rag/authorizationContinuity.ts",
      "lib/auth/guards.ts",
    ],
  },
  "webhooks": {
    dashboardHref: "/dashboard/webhooks",
    dashboardLabel: "Webhooks",
    authentication: session("webhook:create"),
    setup: [
      {"heading": "Prepare a receiver you control", "body": "Use a public HTTPS receiver with raw-body signature verification and duplicate-safe processing. Do not put credentials in the endpoint URL or copy signing secrets into logs."},
      {"heading": "Create and test the subscription", "body": "Open Webhooks, choose the project and events, store the returned signing secret securely, and trigger the explicit test operation. Confirm the delivery worker is running."},
    ],
    validation: [
      {"heading": "Check both ends of a delivery", "body": "Confirm a recorded successful delivery attempt and a signature-verified event at your receiver. An endpoint appearing in the list is not proof that a delivery completed."},
      {"heading": "Exercise failure handling", "body": "With a controlled receiver, reject an altered payload and temporarily return an error. Inspect retries and terminal failure behavior, then test duplicate handling before enabling production notifications."},
    ],
    integrationNotes: [
      "POST /api/webhooks requires a dashboard session with webhook:create permission. Endpoint update and deletion use their own permissions; webhook signatures are not API keys.",
      "Use the REST/API reference for the exact signature header and payload format. Preserve the raw request bytes for verification; re-serializing parsed JSON can change the signed data.",
    ],
    limitations: [
      "Delivery depends on worker execution, network reachability, receiver availability, and a finite retry policy. It is not guaranteed or exactly once.",
      "Only supported event types are subscribable. This route does not promise Slack/PagerDuty-specific setup or a stream of every log entry.",
    ],
    sourceFiles: [
      "app/api/webhooks/route.ts",
      "app/dashboard/webhooks/page.tsx",
      "lib/validations.ts",
      "lib/webhooks/store.ts",
      "lib/webhooks/delivery.ts",
      "lib/webhooks/signing.ts",
      "lib/auth/guards.ts",
    ],
  },
  "shadow-ai": {
    dashboardHref: "/dashboard/shadow-ai",
    dashboardLabel: "Shadow AI",
    authentication: session("policy:manage"),
    setup: [
      {"heading": "Prepare a non-secret scan input", "body": "Collect the relevant dependency object, selected code snippets, and environment variable names. Do not submit environment values or credentials."},
      {"heading": "Use the authorized scan workflow", "body": "Use a signed-in application request with shadow_ai:scan permission to submit the inventory. Open Shadow AI to inspect the recorded scan and discoveries."},
    ],
    validation: [
      {"heading": "Check a known reference", "body": "In an isolated project, submit a known AI dependency and confirm its reference appears in the scan response and organization inventory. Compare the input with the recorded finding."},
      {"heading": "Check the coverage boundary", "body": "Submit a sample without that dependency and inspect the result rather than expecting a zero-risk organization. Existing inventory records can remain from earlier scans."},
    ],
    integrationNotes: [
      "GET /api/shadow/scan?projectId=… is a session-authenticated summary requiring policy:manage. POST on the same path starts a scan and requires shadow_ai:scan.",
      "The dashboard requires shadow_ai:read. Its inventory is organization-wide; projectId does not make the summary an isolated per-project inventory. Use the implemented route rather than guessed scan/provider subpages.",
    ],
    limitations: [
      "Only submitted code and configuration are inspected. There is no continuous network monitoring or verified discovery count for all AI services.",
      "Provider region and risk labels come from the built-in signature catalog, not a live vendor compliance assessment.",
    ],
    sourceFiles: [
      "app/api/shadow/scan/route.ts",
      "app/dashboard/shadow-ai/page.tsx",
      "lib/shadow-ai/index.ts",
      "lib/auth/guards.ts",
    ],
  },
  "red-team-lab": {
    dashboardHref: "/dashboard/redteam/lab",
    dashboardLabel: "Red Team Lab",
    authentication: session("policy:manage"),
    setup: [
      {"heading": "Choose a controlled project", "body": "Use a project you are authorized to administer. Record the analyzer version and test purpose; project authorization does not cause the worker to load your Guard policy."},
      {"heading": "Confirm and queue the run", "body": "Use the explicit Run control or the authorized session route with confirmed: true. Ensure the background worker is available, then retain the returned run and job identifiers."},
    ],
    validation: [
      {"heading": "Wait for a completed run", "body": "An HTTP 202 response means queued, not passed. Confirm the worker finishes and the run has completed results before reading its pass rate."},
      {"heading": "Inspect failures rather than only totals", "body": "Review each scenario's expected action against the observed analyzer action. Compare the same suite across analyzer changes; do not interpret a project-policy edit as a tested change in this queued path."},
    ],
    integrationNotes: [
      "POST /api/redteam/run is session-authenticated. Its body is projectId and confirmed: true, not a user-supplied scenarios array or external target URL.",
      "The route returns HTTP 202 and requires a background worker. The Lab read view uses redteam:read; starting a run requires policy:manage.",
    ],
    limitations: [
      "The queued runner does not load or apply ProjectPolicy: it calls analyzeText with the built-in analyzer defaults. These finite cases do not establish project-policy regression coverage, 100+ scenarios, or full OWASP coverage.",
      "The Lab and worker have separate suite/reporting paths. Reconcile the returned run identifier with the displayed result in your deployment before relying on trend summaries.",
    ],
    sourceFiles: [
      "app/api/redteam/run/route.ts",
      "app/dashboard/redteam/lab/page.tsx",
      "lib/redteam/scenarios.ts",
      "lib/redteam/runner.ts",
      "lib/backgroundJobProcessors.ts",
      "lib/redteam/lab.ts",
      "lib/auth/guards.ts",
    ],
  },
  "forensics": {
    dashboardHref: "/dashboard/forensics",
    dashboardLabel: "Forensics",
    authentication: session("forensics:read"),
    setup: [
      {"heading": "Keep evaluation isolated", "body": "Use only disposable fixtures in a fully isolated environment with no sensitive or multi-tenant production data. The organization summary is not a safe bypass: it includes historical reports whose evidenceJson may contain mixed-tenant evidence."},
      {"heading": "Resolve the report boundary first", "body": "Before approving any production Forensics use, have the deployment owner validate incident/report ownership, all evidence queries, and historical report contents, including the summary and dashboard paths. Do not use sensitive or mixed-tenant production data for evaluation."},
    ],
    validation: [
      {"heading": "Reconcile summary records", "body": "In the isolated fixture only, compare incident display fields and inspect both new and historical report evidence. A correct title or organization filter does not establish that a report's evidence belongs to that tenant."},
      {"heading": "Require a tenant-scope validation", "body": "In an isolated fixture with distinct organizations, verify that incident access and every generated evidence row are scoped correctly before approving report use. No such live validation is claimed here."},
    ],
    integrationNotes: [
      "GET /api/forensics is session-authenticated with forensics:read. POST, PUT, and PATCH require forensics:manage and perform incident/report mutations.",
      "GET with incidentId and without timeline=true generates a report; it is not a side-effect-free read. The organization summary also returns full historical reports and may expose previously mixed-tenant evidenceJson. Do not treat it as a safe workaround; use independently scoped Guard Logs for log inspection.",
    ],
    limitations: [
      "Production blocker: incident/report ownership and evidence isolation remain unresolved, including historical reports returned by summaries. Do not approve sensitive or multi-tenant Forensics use or external report sharing until authenticated isolation checks and historical-data review pass.",
      "The code does not reconstruct previously redacted secrets or provide AI-derived root-cause certainty, legal admissibility, or a complete incident archive.",
    ],
    sourceFiles: [
      "app/api/forensics/route.ts",
      "app/dashboard/forensics/page.tsx",
      "lib/forensics/index.ts",
      "lib/auth/guards.ts",
    ],
  },
  "canary-network": {
    dashboardHref: "/dashboard/canary-network",
    dashboardLabel: "Canary Network",
    authentication: projectApiKey,
    setup: [
      {"heading": "Place a test canary deliberately", "body": "Generate a token with the project API key and place it only in a synthetic protected context. Do not invent a token string and expect it to match an unregistered hash."},
      {"heading": "Inspect before release", "body": "Call the check route with content and a supported location. Gate your outbound tool or response on the decision and keep canary values out of normal application logs."},
    ],
    validation: [
      {"heading": "Verify exact-match behavior", "body": "Submit content containing the actual generated test token, then content without it. Check leakDetected and decision in both responses without releasing either payload externally."},
      {"heading": "Inspect the leak record", "body": "Confirm the matching test appears under Leak events for the same project. A clean check is not persisted as a leak event, so do not require a row for every negative test."},
    ],
    integrationNotes: [
      "POST /api/canary/check uses x-api-key. content is 1–10,000 characters under the shared parser; location is one of agent_output, tool_call, email, api_request, browser_form, or external_post.",
      "POST /api/canary/create returns the token to place in protected context. The check route does not automatically intercept all model outputs, and memory_write is not an accepted location value here.",
      "Deployment boundary: current middleware applies Origin/Referer checks to non-Guard mutations in this API family, even when x-api-key is used. Without either header, it returns HTTP 403: Missing Origin or Referer header. Confirm the configured application origin and client behavior with your deployment owner before enabling machine calls. The shared JSON parser additionally caps each string at 10,000 characters and the entire request body at 32,000 bytes; stricter field schemas still apply.",
    ],
    limitations: [
      "Matching is exact token recognition. Altered, omitted, or paraphrased protected content can escape this tripwire.",
      "Only matched leaks are persisted by the check route. Blocking and any notification/escalation beyond the stored event must be integrated explicitly.",
    ],
    sourceFiles: [
      "app/api/canary/check/route.ts",
      "app/api/canary/create/route.ts",
      "app/dashboard/canary-network/page.tsx",
      "lib/agent-firewall/mvp3.ts",
      "lib/agent-firewall/server.ts",
      "lib/csrf.ts",
      "middleware.ts",
      "auth.config.ts",
      "lib/apiKeyMiddleware.ts",
    ],
  },
  "semantic-egress": {
    dashboardHref: "/dashboard/semantic-egress",
    dashboardLabel: "Semantic Egress",
    authentication: projectApiKey,
    setup: [
      {"heading": "Register representative test sources", "body": "Use synthetic confidential text to create source fingerprints. Retain sourceId values and verify they belong to the same project as the key used for checking."},
      {"heading": "Place the check before egress", "body": "Submit the intended output and its relevant sourceIds before sending it. Hold review/approval states, block denied content, and explicitly apply reviewed redaction behavior."},
    ],
    validation: [
      {"heading": "Compare known overlap and unrelated text", "body": "Test a registered-source overlap and an unrelated sample. Inspect matchedSources and findings, including semantic.source_missing when requested fingerprints are unavailable."},
      {"heading": "Read the persisted check", "body": "Use GET /api/semantic-egress/checks to locate the returned checkId. The linked dashboard currently provides an overview rather than a live checks table, so do not use it as the persistence oracle."},
    ],
    integrationNotes: [
      "POST /api/semantic-egress/source/fingerprint registers a source; POST /api/semantic-egress/check evaluates outbound content. Both require x-api-key, not a dashboard session.",
      "Content is limited to 10,000 characters by the shared parser and sourceIds to 50. An empty sourceIds list loads no fingerprints; missing IDs add a finding but do not automatically force BLOCK.",
      "Deployment boundary: current middleware applies Origin/Referer checks to non-Guard mutations in this API family, even when x-api-key is used. Without either header, it returns HTTP 403: Missing Origin or Referer header. Confirm the configured application origin and client behavior with your deployment owner before enabling machine calls. The shared JSON parser additionally caps each string at 10,000 characters and the entire request body at 32,000 bytes; stricter field schemas still apply.",
    ],
    limitations: [
      "Similarity is heuristic, not embedding-based semantic certainty, a multilingual guarantee, or a latency SLA. Evaluate misses and false positives on your own data.",
      "The API does not intercept traffic or perform external blocking. Source fingerprints retain derived textual signals; treat them as sensitive metadata.",
    ],
    sourceFiles: [
      "app/api/semantic-egress/check/route.ts",
      "app/api/semantic-egress/source/fingerprint/route.ts",
      "app/api/semantic-egress/checks/route.ts",
      "app/dashboard/semantic-egress/page.tsx",
      "lib/semantic-egress/server.ts",
      "lib/semantic-egress/index.ts",
      "lib/advanced-security/server.ts",
      "lib/csrf.ts",
      "middleware.ts",
      "auth.config.ts",
      "lib/apiKeyMiddleware.ts",
    ],
  },
  "agent-passports": {
    dashboardHref: "/dashboard/agent-passports",
    dashboardLabel: "Agent Passports",
    authentication: projectApiKey,
    setup: [
      {"heading": "Register identity and policy", "body": "Use POST /api/agent/identity/create with the project key, then retain the returned identity identifier. Grant only the tool and domain scope the agent needs."},
      {"heading": "Issue and use a session passport", "body": "Call the issuer with agentIdentityId and an intended lifetime. Store the returned passportToken securely and include it in the documented validation/action workflow, not in prompts or browser bundles."},
    ],
    validation: [
      {"heading": "Check policy and expiry", "body": "Compare the issued passport's session, permissions, and expiresAt with the intended values. Test a permitted action and a disallowed tool through passport validation with a stub executor."},
      {"heading": "Check revocation", "body": "Revoke a disposable test passport and confirm a later validation does not authorize its action. Inspect Passport audit events, not general Guard Logs, for the session's lifecycle."},
    ],
    integrationNotes: [
      "POST /api/agent/passport/issue requires x-api-key. agentIdentityId is required; ttlSeconds defaults to 3,600 and accepts 60–86,400. An explicit future expiresAt is handled separately.",
      "The route returns HTTP 201 with passportId, sessionId, passportToken, status, allowedTools, blockedTools, approvalRequiredTools, allowedDomains, blockedDomains, dataScopes, memoryScopes, and expiresAt. Policy fields are top-level, not a nested policy object. A duplicate session returns 409; an unknown identity returns 404. The issuer has its own per-key rate limiter.",
      "Deployment boundary: current middleware applies Origin/Referer checks to non-Guard mutations in this API family, even when x-api-key is used. Without either header, it returns HTTP 403: Missing Origin or Referer header. Confirm the configured application origin and client behavior with your deployment owner before enabling machine calls. The shared JSON parser additionally caps each string at 10,000 characters and the entire request body at 32,000 bytes; stricter field schemas still apply.",
    ],
    limitations: [
      "Passports are hashed opaque tokens, not Ed25519-signed per-action attestations. Declared data/memory scopes are not automatic enforcement in external tools.",
      "Keep the project API key out of untrusted agent code: it authorizes passport management. A passport cannot constrain a code path that bypasses validation. Before action checks, use an issued passport with matching sessionId and passportToken. Passport-level ASK_APPROVAL creates no AgentApproval record or approval token; it must not be treated as a queued human approval.",
    ],
    sourceFiles: [
      "app/api/agent/passport/issue/route.ts",
      "app/api/agent/identity/create/route.ts",
      "app/api/agent/passport/validate/route.ts",
      "app/api/agent/passport/revoke/route.ts",
      "app/dashboard/agent-passports/page.tsx",
      "lib/agent-passport/server.ts",
      "lib/agent-passport/index.ts",
      "lib/apiKeyMiddleware.ts",
      "lib/csrf.ts",
      "middleware.ts",
      "auth.config.ts",
    ],
  },
  "transaction-escrow": {
    dashboardHref: "/dashboard/escrow",
    dashboardLabel: "Transaction Escrow",
    authentication: projectApiKey,
    setup: [
      {"heading": "Define the hold boundary", "body": "Stop your executor before the real operation and create a test escrow transaction. Use trusted reviewer controls; an agent must not approve its own action merely by claiming actorType USER."},
      {"heading": "Connect review to execution", "body": "Use the dashboard or an authorized backend to resolve the record. After approval, consume it and compare returned tool, action, target, and safePayload with the operation you will execute."},
    ],
    validation: [
      {"heading": "Verify pending and denied paths", "body": "Use a disposable action with a stub executor. Confirm a pending or denied record never triggers the tool and that the transaction and audit entries appear in the escrow workspace."},
      {"heading": "Verify approval consumption", "body": "Approve the test record, consume the approval, and check the returned reviewed action. Test expired and repeated consumption cases; provide application-level idempotency for concurrent execution."},
    ],
    integrationNotes: [
      "POST /api/escrow/create requires x-api-key and sessionId, transactionType, tool, and action. Payloads are limited to 10,000 characters by the shared parser; ttlSeconds defaults to 900 and accepts 60–86,400.",
      "Resolution endpoints use the same project API-key boundary. POST /api/escrow/execute changes workflow state; it does not call the external tool or guarantee exactly-once real-world execution.",
      "Deployment boundary: current middleware applies Origin/Referer checks to non-Guard mutations in this API family, even when x-api-key is used. Without either header, it returns HTTP 403: Missing Origin or Referer header. Confirm the configured application origin and client behavior with your deployment owner before enabling machine calls. The shared JSON parser additionally caps each string at 10,000 characters and the entire request body at 32,000 bytes; stricter field schemas still apply.",
    ],
    limitations: [
      "Escrow is not a financial custody service or an automatic human-approval boundary. Isolate reviewer credentials and permissions in your own application.",
      "Use the approved safe payload only, handle expiry and rejection explicitly, and keep idempotency at the actual external-action boundary.",
    ],
    sourceFiles: [
      "app/api/escrow/create/route.ts",
      "app/api/escrow/execute/route.ts",
      "app/api/escrow/approve/route.ts",
      "app/api/escrow/deny/route.ts",
      "app/api/escrow/edit-and-approve/route.ts",
      "app/dashboard/escrow/page.tsx",
      "lib/escrow/server.ts",
      "lib/escrow/index.ts",
      "lib/advanced-security/server.ts",
      "lib/csrf.ts",
      "middleware.ts",
      "auth.config.ts",
      "lib/apiKeyMiddleware.ts",
    ],
  },
  "intent-guard": {
    dashboardHref: "/dashboard/intent-guard",
    dashboardLabel: "Intent Guard",
    authentication: projectApiKey,
    setup: [
      {"heading": "Establish the original request", "body": "Choose a stable sessionId and call intent extraction with the user's actual task. Retain intentRecordId rather than assuming an input Guard call creates one."},
      {"heading": "Check before each tool operation", "body": "Send the proposed tool, action, and relevant target/description to the intent check. Do not execute on missing context, review, unresolved approval, or an API error."},
    ],
    validation: [
      {"heading": "Compare matched and mismatched actions", "body": "Use a synthetic read-only task and compare a read action with an unrelated delete or external-send proposal. Inspect decision and reason with the real executor disabled."},
      {"heading": "Verify the context requirement", "body": "Use a new session without an intent record and confirm it cannot proceed automatically. For valid tests, match actionCheckId and intentRecordId in the Intent Guard timeline."},
    ],
    integrationNotes: [
      "POST /api/intent/action/check requires x-api-key, sessionId, tool, and action. intentRecordId is optional only because the latest stored record can be selected.",
      "POST /api/intent/extract accepts userPrompt up to 10,000 characters under the shared parser. The action endpoint limits tool to 160, action to 200, target to 2,000, and actionDescription to 4,000 characters.",
      "Deployment boundary: current middleware applies Origin/Referer checks to non-Guard mutations in this API family, even when x-api-key is used. Without either header, it returns HTTP 403: Missing Origin or Referer header. Confirm the configured application origin and client behavior with your deployment owner before enabling machine calls. The shared JSON parser additionally caps each string at 10,000 characters and the entire request body at 32,000 bytes; stricter field schemas still apply.",
    ],
    limitations: [
      "The implementation uses rule-based categories, not a semantic intent vector or a guarantee of detecting gradual manipulation.",
      "The route does not execute or block a tool by itself. Keep session assignment and user-intent provenance under trusted application control.",
    ],
    sourceFiles: [
      "app/api/intent/action/check/route.ts",
      "app/api/intent/extract/route.ts",
      "app/dashboard/intent-guard/page.tsx",
      "lib/agent-intent/server.ts",
      "lib/agent-intent/index.ts",
      "lib/advanced-security/server.ts",
      "lib/csrf.ts",
      "middleware.ts",
      "auth.config.ts",
      "lib/apiKeyMiddleware.ts",
    ],
  },
  "tool-chain": {
    dashboardHref: "/dashboard/tool-chain",
    dashboardLabel: "Tool Chain",
    authentication: projectApiKey,
    setup: [
      {"heading": "Start and retain a session", "body": "Create a tool-chain session with the project key before submitting actions. Reuse the same sessionId for the related sequence, not for unrelated users or tasks."},
      {"heading": "Submit steps in order", "body": "Describe each planned operation and its data context before execution. Serialize related submissions so the evaluator sees the intended sequence."},
    ],
    validation: [
      {"heading": "Test an ordinary and risky sequence", "body": "In a controlled session, compare ordinary read steps with a synthetic sensitive-read/external-send chain. Inspect the specific finding and involved steps while the real tools remain disabled."},
      {"heading": "Check missing session and history", "body": "Confirm a step without a started session returns HTTP 404 with REVIEW. For valid steps, compare returned stepId and findingIds with the tool-chain timeline."},
    ],
    integrationNotes: [
      "POST /api/tool-chain/step/check uses x-api-key and requires sessionId, tool, and action. Start the context with POST /api/tool-chain/session/start.",
      "The server loads at most 200 prior stored steps for evaluation. Keep sequences bounded and do not assume unlimited conversation history or a user-configurable pattern library.",
      "Deployment boundary: current middleware applies Origin/Referer checks to non-Guard mutations in this API family, even when x-api-key is used. Without either header, it returns HTTP 403: Missing Origin or Referer header. Confirm the configured application origin and client behavior with your deployment owner before enabling machine calls. The shared JSON parser additionally caps each string at 10,000 characters and the entire request body at 32,000 bytes; stricter field schemas still apply.",
    ],
    limitations: [
      "There is no automatic tracking just because another Agent Firewall route is enabled. Missing steps or incorrect sensitivity labels reduce coverage.",
      "Decision persistence is not tool enforcement. Stop blocked, review, approval, and failed checks in your own executor.",
    ],
    sourceFiles: [
      "app/api/tool-chain/step/check/route.ts",
      "app/api/tool-chain/session/start/route.ts",
      "app/dashboard/tool-chain/page.tsx",
      "lib/tool-chain/server.ts",
      "lib/tool-chain/index.ts",
      "lib/advanced-security/server.ts",
      "lib/csrf.ts",
      "middleware.ts",
      "auth.config.ts",
      "lib/apiKeyMiddleware.ts",
    ],
  },
  "dry-run-sandbox": {
    dashboardHref: "/dashboard/dry-run",
    dashboardLabel: "Dry-Run Sandbox",
    authentication: projectApiKey,
    setup: [
      {"heading": "Use a synthetic action first", "body": "Describe a disposable operation without sending it to a real tool. Select the matching dryRunType and include the target and payload the operation would use."},
      {"heading": "Keep simulation separate from execution", "body": "Call the simulation before the executor. Require any other application policy checks even after SAFE_TO_EXECUTE; pause approval/review outcomes and stop errors."},
    ],
    validation: [
      {"heading": "Inspect expected effects", "body": "Compare a simple synthetic command with an obviously high-impact action. Check the returned effects and exact decision vocabulary rather than testing for an unrelated Guard action such as ALLOW."},
      {"heading": "Verify no external operation ran", "body": "Confirm the stub executor was never invoked by the simulation call. Match dryRunId to the stored simulation; the API itself does write history even though it does not run the proposed operation."},
    ],
    integrationNotes: [
      "POST /api/dry-run/simulate requires x-api-key and sessionId, dryRunType, tool, and action. simulatedPayload is limited to 10,000 characters by the shared parser.",
      "The response uses SAFE_TO_EXECUTE or REQUIRE_APPROVAL rather than ALLOW or ASK_APPROVAL. The route is not a dryRun flag on the text Guard API and does not load a selected project-policy version.",
      "Deployment boundary: current middleware applies Origin/Referer checks to non-Guard mutations in this API family, even when x-api-key is used. Without either header, it returns HTTP 403: Missing Origin or Referer header. Confirm the configured application origin and client behavior with your deployment owner before enabling machine calls. The shared JSON parser additionally caps each string at 10,000 characters and the entire request body at 32,000 bytes; stricter field schemas still apply.",
    ],
    limitations: [
      "This is a rule-based effect estimate, not an isolated runtime sandbox, batch policy comparator, or guarantee of zero side effects: the API stores a simulation record.",
      "A predicted-safe result cannot account for undisclosed tool behavior, external system state, or every indirect effect.",
    ],
    sourceFiles: [
      "app/api/dry-run/simulate/route.ts",
      "app/dashboard/dry-run/page.tsx",
      "lib/dry-run/server.ts",
      "lib/dry-run/index.ts",
      "lib/advanced-security/server.ts",
      "lib/csrf.ts",
      "middleware.ts",
      "auth.config.ts",
      "lib/apiKeyMiddleware.ts",
    ],
  },
  "memory-firewall": {
    dashboardHref: "/dashboard/memory-firewall",
    dashboardLabel: "Memory Firewall",
    authentication: projectApiKey,
    setup: [
      {"heading": "Choose evaluation or storage", "body": "For your own memory database, call check before writing and enforce its decision yourself. Use store only when you want a managed SoterAI memory record as well."},
      {"heading": "Preserve scope and read controls", "body": "Send the required agentName and appropriate memoryScope/memoryType. Keep blocked or quarantined content out of future agent context, including caches or replicas outside this service."},
    ],
    validation: [
      {"heading": "Validate the non-persistent check", "body": "Compare a synthetic preference with a known poisoning instruction and inspect the response. Do not look for a new memoryRecordId or dashboard row after /api/memory/check."},
      {"heading": "Validate managed storage separately", "body": "In a test project, use store and inspect memoryRecordId, stored, status, and findings. Confirm a quarantined record is excluded from your actual agent retrieval path."},
    ],
    integrationNotes: [
      "POST /api/memory/check requires x-api-key and agentName; content is limited to 10,000 characters by the shared parser. The check does not persist a stored record.",
      "POST /api/memory/store returns memoryRecordId and status. A stored: false response can still mean a quarantined or review record was saved, not that nothing was written.",
      "Deployment boundary: current middleware applies Origin/Referer checks to non-Guard mutations in this API family, even when x-api-key is used. Without either header, it returns HTTP 403: Missing Origin or Referer header. Confirm the configured application origin and client behavior with your deployment owner before enabling machine calls. The shared JSON parser additionally caps each string at 10,000 characters and the entire request body at 32,000 bytes; stricter field schemas still apply.",
    ],
    limitations: [
      "Known-pattern detection can miss novel poisoning. This is not automatic scanning of every external memory store.",
      "The dashboard is a record/findings view; do not assume it offers every restore/delete control described by older catalog examples.",
    ],
    sourceFiles: [
      "app/api/memory/check/route.ts",
      "app/api/memory/store/route.ts",
      "app/dashboard/memory-firewall/page.tsx",
      "lib/advanced-security/server.ts",
      "lib/advanced-security/memoryPoisoning.ts",
      "lib/csrf.ts",
      "middleware.ts",
      "auth.config.ts",
      "lib/apiKeyMiddleware.ts",
    ],
  },
  "mcp-drift": {
    dashboardHref: "/dashboard/mcp-drift",
    dashboardLabel: "MCP Drift",
    authentication: projectApiKey,
    setup: [
      {"heading": "Capture a reviewed snapshot", "body": "Fetch tool definitions using your trusted MCP client and submit them with a stable serverName. Keep the original reviewed definitions in your own change-management record."},
      {"heading": "Submit later snapshots deliberately", "body": "Repeat collection before using changed tools or on a schedule you operate. Gate tool availability on your review process; this endpoint does not run that schedule or quarantine a server for you."},
    ],
    validation: [
      {"heading": "Test unchanged and changed metadata", "body": "Submit a synthetic baseline, then the same tool definitions, then a changed description or schema. Inspect snapshotsCreated and drift details for the intended server."},
      {"heading": "Verify caller enforcement", "body": "Locate the new finding in drift history and confirm your MCP client pauses a tool awaiting review. A recorded high-risk finding alone does not prove access was disabled."},
    ],
    integrationNotes: [
      "POST /api/mcp/tools/snapshot requires x-api-key, serverName, and caller-supplied tools. Up to 200 tools are accepted; descriptions are limited to 10,000 characters.",
      "The route compares tools present in the submitted array. It does not fetch serverUrl, automatically detect every omitted/removed tool, or change server status based on its returned risk score.",
      "Deployment boundary: current middleware applies Origin/Referer checks to non-Guard mutations in this API family, even when x-api-key is used. Without either header, it returns HTTP 403: Missing Origin or Referer header. Confirm the configured application origin and client behavior with your deployment owner before enabling machine calls. The shared JSON parser additionally caps each string at 10,000 characters and the entire request body at 32,000 bytes; stricter field schemas still apply.",
    ],
    limitations: [
      "Coverage is limited to caller-submitted snapshots and metadata. Changes between snapshots and hidden runtime behavior are not observed.",
      "Automatic polling, universal real-time alerts, and automatic quarantine are not established by this route.",
    ],
    sourceFiles: [
      "app/api/mcp/tools/snapshot/route.ts",
      "app/dashboard/mcp-drift/page.tsx",
      "lib/advanced-security/server.ts",
      "lib/advanced-security/mcpDrift.ts",
      "lib/csrf.ts",
      "middleware.ts",
      "auth.config.ts",
      "lib/apiKeyMiddleware.ts",
    ],
  },
  "legal-boundary": {
    dashboardHref: "/dashboard/legal-boundary",
    dashboardLabel: "Legal Boundary",
    authentication: projectApiKey,
    setup: [
      {"heading": "Define trusted action context", "body": "Have the application, not untrusted page text, supply the category, domain, and consent state. Review the default behavior with the owner of your consent workflow."},
      {"heading": "Implement the handoff", "body": "Pause the executor for TAKEOVER_REQUIRED and let a human complete the sensitive step. Resolve approval/review through a trusted flow rather than converting every non-BLOCK result into permission."},
    ],
    validation: [
      {"heading": "Compare a read with a sensitive action", "body": "Use synthetic READ_ONLY and PAYMENT proposals without performing either. Inspect the exact decision and requiredUserMessage; default payment handling requests human takeover."},
      {"heading": "Verify the pause and audit", "body": "Confirm a takeover or blocked result never invokes the real browser action. Match auditId with the Legal Boundary check history and validate that the recorded consent state is accurate."},
    ],
    integrationNotes: [
      "POST /api/legal-boundary/check requires x-api-key and agentName. content is limited to 10,000 characters under the shared parser; actionCategory defaults to UNKNOWN and userConsentProvided to false.",
      "Use FORM_SUBMIT, not FORM_SUBMISSION. Supply domain when domain policies are needed; websiteUrl is recorded but the decision helper does not derive domain from it.",
      "Deployment boundary: current middleware applies Origin/Referer checks to non-Guard mutations in this API family, even when x-api-key is used. Without either header, it returns HTTP 403: Missing Origin or Referer header. Confirm the configured application origin and client behavior with your deployment owner before enabling machine calls. The shared JSON parser additionally caps each string at 10,000 characters and the entire request body at 32,000 bytes; stricter field schemas still apply.",
    ],
    limitations: [
      "The service evaluates supplied metadata and configured rules. It does not determine legal compliance, supply GDPR/HIPAA templates, or guarantee an unoverrideable legal boundary.",
      "Caller-controlled consent and trust flags are not proof of consent. Enforce them in trusted application code and consult appropriate legal/security reviewers.",
    ],
    sourceFiles: [
      "app/api/legal-boundary/check/route.ts",
      "app/dashboard/legal-boundary/page.tsx",
      "lib/advanced-security/server.ts",
      "lib/advanced-security/legalBoundary.ts",
      "lib/csrf.ts",
      "middleware.ts",
      "auth.config.ts",
      "lib/apiKeyMiddleware.ts",
    ],
  },
  "evidence-vault": {
    dashboardHref: "/dashboard/evidence-vault",
    dashboardLabel: "Evidence Vault",
    authentication: projectApiKey,
    setup: [
      {"heading": "Choose the evidence scope", "body": "Identify the project, controls, and records you intend to review. Collect synthetic/custom evidence first, or request an on-demand automatic snapshot from the intended project."},
      {"heading": "Generate a selected report", "body": "Retain evidence IDs and select the items for the report. Review warning/failure states and the source records before exporting anything for an auditor or customer."},
    ],
    validation: [
      {"heading": "Reconcile items with source records", "body": "Use GET /api/evidence/items and compare collected titles, control names, and statuses with the underlying project records. A zero count may also result from an unavailable automatic source query."},
      {"heading": "Inspect the exported package", "body": "Compare selected evidence IDs with the generated and exported report, check its actual contents and contentHash, and keep missing or truncated data visible in the review notes."},
    ],
    integrationNotes: [
      "GET /api/evidence/items requires x-api-key and returns an items envelope. Collection and report generation are separate POST operations, not a single /v1/evidence call.",
      "POST /api/evidence/reports/[id]/export supports format JSON. Evidence listing and report selection are bounded to the latest 500 items; nested export structures are also sanitized and bounded.",
      "Deployment boundary: current middleware applies Origin/Referer checks to non-Guard mutations in this API family, even when x-api-key is used. Without either header, it returns HTTP 403: Missing Origin or Referer header. Confirm the configured application origin and client behavior with your deployment owner before enabling machine calls. The shared JSON parser additionally caps each string at 10,000 characters and the entire request body at 32,000 bytes; stricter field schemas still apply.",
    ],
    limitations: [
      "Collection is on-demand, not a continuous capture guarantee. Automatic source-query failures are converted to zero counts, so reconcile suspiciously empty evidence with source availability.",
      "There is no established external auditor portal, signed certification package, or automatic SOC 2/ISO 27001 control attestation in this workflow.",
    ],
    sourceFiles: [
      "app/api/evidence/items/route.ts",
      "app/api/evidence/collect/route.ts",
      "app/api/evidence/report/generate/route.ts",
      "app/api/evidence/reports/[id]/export/route.ts",
      "app/dashboard/evidence-vault/page.tsx",
      "lib/evidence-vault/server.ts",
      "lib/evidence-vault/index.ts",
      "lib/advanced-security/server.ts",
      "lib/csrf.ts",
      "middleware.ts",
      "auth.config.ts",
      "lib/apiKeyMiddleware.ts",
    ],
  },
  "context-lineage": {
    dashboardHref: "/dashboard/lineage",
    dashboardLabel: "Context Lineage",
    authentication: projectApiKey,
    setup: [
      {"heading": "Register the real provenance boundary", "body": "Register synthetic sources with the intended sourceType, sourceTrustLevel, and sensitivityLevel. Keep returned sourceIds with the data in trusted application context."},
      {"heading": "Check before moving data", "body": "Submit sourceIds and the actual destination type/trust before the transfer. Stop denied and unresolved review/approval outcomes, and apply safeContent only when the decision permits it."},
    ],
    validation: [
      {"heading": "Compare internal and external transfers", "body": "Test the same synthetic confidential source toward an internal destination and an external one. Compare decision, policyMatches, and any lineageIncidentId without sending real data."},
      {"heading": "Check source completeness", "body": "Confirm every requested sourceId resolved in the intended project. Missing IDs are not rejected as a complete-set error, so prevent incomplete provenance from silently reducing the check's sensitivity context."},
    ],
    integrationNotes: [
      "POST /api/lineage/flow/check requires x-api-key. sourceIds accepts up to 50 values; content is limited to 10,000 characters by the shared parser. destinationType and destinationTrustLevel are required.",
      "POST /api/lineage/source/register returns the sourceId to use in later checks. PUBLIC/CONFIDENTIAL are sensitivity values, not sourceTrustLevel values. Source tagging is explicit, not automatic.",
      "Deployment boundary: current middleware applies Origin/Referer checks to non-Guard mutations in this API family, even when x-api-key is used. Without either header, it returns HTTP 403: Missing Origin or Referer header. Confirm the configured application origin and client behavior with your deployment owner before enabling machine calls. The shared JSON parser additionally caps each string at 10,000 characters and the entire request body at 32,000 bytes; stricter field schemas still apply.",
    ],
    limitations: [
      "Unknown or out-of-project source IDs are omitted from the loaded sources. An empty source set begins with PUBLIC sensitivity while content checks still apply.",
      "The service records and evaluates declared flows; it does not supply automatic end-to-end provenance, graphical tracing, or enforcement in external systems.",
    ],
    sourceFiles: [
      "app/api/lineage/flow/check/route.ts",
      "app/api/lineage/source/register/route.ts",
      "app/dashboard/lineage/page.tsx",
      "lib/advanced-security/server.ts",
      "lib/advanced-security/lineage.ts",
      "lib/csrf.ts",
      "middleware.ts",
      "auth.config.ts",
      "lib/apiKeyMiddleware.ts",
    ],
  },
  "blast-radius": {
    dashboardHref: "/dashboard/blast-radius",
    dashboardLabel: "Blast Radius",
    authentication: projectApiKey,
    setup: [
      {"heading": "Inventory actual permissions", "body": "Use trusted application configuration to describe the agent rather than relying on the agent's self-report. Include sensitive sources and external destinations that matter to your review."},
      {"heading": "Save and compare a profile", "body": "Run a simulation with a stable agentName. Retain the original response before resubmitting tightened capabilities, because the stored profile is updated rather than versioned by this route."},
    ],
    validation: [
      {"heading": "Check the inputs behind the score", "body": "Compare the returned findings with your declared tools and controls. A reduction from a changed policy flag is not evidence that the actual deployed control is enabled."},
      {"heading": "Verify the stored profile", "body": "Open Blast Radius and match the agent name, score, and recommendations to the response. Validate actual tool permissions separately through the executor's tests."},
    ],
    integrationNotes: [
      "POST /api/blast-radius/simulate requires x-api-key and agentName. It accepts up to 200 tools, 100 data sources, and 100 external destinations.",
      "POST /api/blast-radius/scenario is separate from the base simulation. The base score uses declared metadata; it does not discover permissions, execute an attack, or calculate a monetary loss.",
      "Deployment boundary: current middleware applies Origin/Referer checks to non-Guard mutations in this API family, even when x-api-key is used. Without either header, it returns HTTP 403: Missing Origin or Referer header. Confirm the configured application origin and client behavior with your deployment owner before enabling machine calls. The shared JSON parser additionally caps each string at 10,000 characters and the entire request body at 32,000 bytes; stricter field schemas still apply.",
    ],
    limitations: [
      "Risk scores are heuristics based on declared capabilities and name matching, not an independently validated impact model.",
      "Simulation persists or updates a profile but does not change permissions, block an agent, or provide historical version comparison automatically.",
    ],
    sourceFiles: [
      "app/api/blast-radius/simulate/route.ts",
      "app/api/blast-radius/scenario/route.ts",
      "app/dashboard/blast-radius/page.tsx",
      "lib/advanced-security/server.ts",
      "lib/advanced-security/blastRadius.ts",
      "lib/csrf.ts",
      "middleware.ts",
      "auth.config.ts",
      "lib/apiKeyMiddleware.ts",
    ],
  },
  "credential-vault": {
    dashboardHref: "/dashboard/credentials",
    dashboardLabel: "Credential Vault",
    authentication: session("credentials:manage"),
    setup: [
      {"heading": "Prepare the vault boundary", "body": "Have the deployment owner configure valid encryption key material and access permissions. Use a disposable test credential, not a production secret, for initial validation."},
      {"heading": "Use a trusted management workflow", "body": "Store the credential through the authorized session control plane and inspect its metadata in Credential Vault. The current dashboard is primarily a listing view; do not assume all linked management subpages exist."},
    ],
    validation: [
      {"heading": "Inspect the length-dependent response", "body": "Use a disposable test value longer than four characters and inspect metadata without printing the value. The response omits encryptedSecret, but preview safety depends on length: four-character values are unmasked, and shorter values can fail preview generation."},
      {"heading": "Validate manual rotation and revocation", "body": "Rotate the test provider credential separately, update the vault, and confirm metadata/access records reflect the change. Revoke only the disposable record and check its status afterward."},
    ],
    integrationNotes: [
      "POST /api/credentials requires a signed-in session with credentials:manage. GET requires credentials:read and returns organization-wide metadata after the project permission check.",
      "secret/newSecret is bounded to 8,000 characters. PUT performs manual rotation; PATCH invokes a reveal helper but intentionally omits the secret from the HTTP response. URL protocols are validated as http, https, ws, or wss.",
    ],
    limitations: [
      "Four-character secrets can appear in full in preview; one-to-three-character values can cause a preview error even though the route schema accepts them. Longer previews reveal the last four characters and, above eight characters, also the first four. Review this masking boundary before production use. The route does not accept a project API key as authentication or implement per-agent secret permissions or scheduled provider rotation.",
      "Encryption is not evidence of an HSM-backed design. Back up and manage the root key material deliberately; replacing it without migration can make stored ciphertext unreadable.",
    ],
    sourceFiles: [
      "app/api/credentials/route.ts",
      "app/dashboard/credentials/page.tsx",
      "lib/credentials/vault.ts",
      "lib/auth/guards.ts",
    ],
  },
  "projects": {
    dashboardHref: "/dashboard/projects",
    dashboardLabel: "Projects",
    authentication: session("project:create"),
    setup: [
      {"heading": "Create a deliberately named project", "body": "Open Projects and choose New project. Use a name that identifies the application or environment; verify the active organization before submitting."},
      {"heading": "Bind keys and policy to that project", "body": "After creation, open API Keys and Policy Engine and select the new project. Do not assume an existing key changes project when you change a dashboard filter."},
    ],
    validation: [
      {"heading": "Read back the created resource", "body": "Confirm the returned project ID, name, and organization in the authorized project list. Check that subsequent keys are explicitly associated with that ID."},
      {"heading": "Validate the actual application binding", "body": "Use a disposable project key for a synthetic Guard request and confirm the recorded event belongs to the intended project. Creating a project alone does not create a Guard event."},
    ],
    integrationNotes: [
      "POST /api/projects is session-authenticated with project:create permission. The supported body includes name, description, publicName, and clientId; it does not set a plan or environment field.",
      "name is 2–80 characters and description at most 300. The Free plan's one new project per UTC calendar month limit returns HTTP 403 with code FREE_PROJECT_MONTHLY_LIMIT when exceeded.",
    ],
    limitations: [
      "Per-project team roles, independent billing, and a project-update API are not established by this catalog route.",
      "Some dashboard lists are user-scoped while the API lists the active organization. Verify project visibility for the team members who will operate it.",
    ],
    sourceFiles: [
      "app/api/projects/route.ts",
      "app/dashboard/projects/page.tsx",
      "app/dashboard/projects/new/page.tsx",
      "lib/projects/projectCreationLimit.ts",
      "lib/validations.ts",
      "lib/auth/guards.ts",
    ],
  },
  "api-keys": {
    dashboardHref: "/dashboard/api-keys",
    dashboardLabel: "API Keys",
    authentication: session("api_key:create"),
    setup: [
      {"heading": "Create and store the key securely", "body": "Open API Keys, choose a project and test/live label, and save the one-time value in your server secret store. Do not paste it into chat, browser code, a prompt, or a repository."},
      {"heading": "Configure the supported integration", "body": "Send x-api-key only to the intended application host using the server-side integration guide. Use separate keys where operational separation is needed, rather than inventing per-key permission fields."},
    ],
    validation: [
      {"heading": "Verify a disposable key", "body": "Use the key for a synthetic Guard request from the trusted backend and check the project result. Confirm a deliberately invalid or missing key is rejected without logging the real credential."},
      {"heading": "Test the revocation path safely", "body": "Revoke a disposable key and confirm it stops authenticating after the verification cache window. For production rotation, plan the traffic switchover rather than assuming overlapping validity."},
    ],
    integrationNotes: [
      "POST /api/api-keys accepts projectId, name, and environment (test or live; default test). The response field is apiKey. No arbitrary permissions or per-key rateLimit input is supported here.",
      "POST /api/api-keys/rotate requires both api_key:create and api_key:revoke permissions. It disables the old key rather than providing an overlap period; successful verification can remain cached for 30 seconds.",
    ],
    limitations: [
      "Project scope is not the same as fine-grained per-endpoint or per-agent permissions. Do not grant a project key to an untrusted agent and expect the label to restrict its authority.",
      "Raw keys are returned at creation/replacement only. Key revocation is not guaranteed instantaneous on a process holding a cached verification.",
    ],
    sourceFiles: [
      "app/api/api-keys/route.ts",
      "app/api/api-keys/rotate/route.ts",
      "app/dashboard/api-keys/page.tsx",
      "components/dashboard/ApiKeyManager.tsx",
      "lib/apiKey.ts",
      "lib/apiKeyCrypto.ts",
      "lib/apiKeyMiddleware.ts",
      "lib/validations.ts",
      "lib/auth/guards.ts",
    ],
  },
  "cost-firewall": {
    dashboardHref: "/dashboard/cost-firewall",
    dashboardLabel: "Cost Firewall",
    authentication: session("cost:manage"),
    setup: [
      {"heading": "Treat the first setup as accounting validation", "body": "Use a controlled project and authorized session to set a test budget. Keep actual provider-side caps in place; do not remove them after creating this record."},
      {"heading": "Record test costs explicitly", "body": "Use PUT for synthetic transactions and compare recorded costs with the intended budget. Keep currency units consistent; monthlyLimitPaise is not a dollar-valued monthlyBudget field."},
    ],
    validation: [
      {"heading": "Reconcile budget accounting", "body": "Read back the budget and compare it with the submitted test transactions. The current writer stores budgetId in metadata while usage aggregation filters the budgetId field, so totals need deployment validation."},
      {"heading": "Verify the enforcement boundary", "body": "Check accepted, budgetExceeded, and throttleAction explicitly. Confirm your caller stops when appropriate, and separately verify the upstream provider cap; a throttle record alone does not stop provider calls."},
    ],
    integrationNotes: [
      "POST /api/cost-firewall/budget sets a budget; PUT records a cost transaction. Both require a signed-in session with cost:manage. GET uses cost:read.",
      "monthlyLimitPaise must be a positive integer. alertThreshold is 0–1 and defaults to 0.8; hardStop defaults to true. An omitted projectId does not bypass project permission checking.",
    ],
    limitations: [
      "The budgetId linkage in current accounting needs correction or validation before hard-stop results can be trusted. Do not represent this service as a guaranteed spending control. The returned transactionId is not assigned to the persisted transaction; do not use it as a verified record identifier for reconciliation.",
      "Only reported transactions are visible. The route does not implement arbitrary daily budgets, multi-channel alert configuration, or automatic interception of every LLM call.",
    ],
    sourceFiles: [
      "app/api/cost-firewall/budget/route.ts",
      "app/dashboard/cost-firewall/page.tsx",
      "lib/cost-firewall/index.ts",
      "lib/auth/guards.ts",
    ],
  },
  "security-badges": {
    dashboardHref: "/dashboard/badges",
    dashboardLabel: "Security Badges",
    authentication: { kind: "public", label: "Public metadata", description: "GET /api/badge is public metadata, not a private account or status endpoint. Badge configuration in the dashboard requires a signed-in session." },
    setup: [
      {"heading": "Review and enable the test badge", "body": "Open Security Badges for a disposable project, check its public name and enablement, and copy the actual slug rather than guessing a project identifier."},
      {"heading": "Inspect before embedding", "body": "Open the project's security-status page and inspect the JSON status. Use the deployment's correct badge.js host; a relative script URL on a different website points at that website, not SoterAI."},
    ],
    validation: [
      {"heading": "Distinguish generic and project data", "body": "Confirm /api/badge returns JSON metadata, then request the actual slug endpoint and compare published status with the test project's recorded activity."},
      {"heading": "Check caching and disable behavior", "body": "After a deliberate test configuration change, allow the documented cache window before comparing status. Confirm the disabled badge reports INACTIVE rather than treating that state as an outage."},
    ],
    integrationNotes: [
      "GET /api/badge is public generic metadata. GET /api/badge/[slug] is the public project status; an unknown slug returns HTTP 404, ‘Badge not found.’",
      "PATCH /api/projects/badge requires a session and badge:manage permission. Badge status is JSON, not a direct SVG/PNG image URL, and its 60-second cache is not a live security guarantee.",
    ],
    limitations: [
      "A PROTECTED label reflects the implementation's activity rules, not a guarantee that all traffic was inspected or a certification.",
      "No custom text/color image-rendering API is established by the generic badge route. Review the actual published fields before exposing a project's activity counts.",
    ],
    sourceFiles: [
      "app/api/badge/route.ts",
      "app/api/badge/[slug]/route.ts",
      "app/api/projects/badge/route.ts",
      "app/dashboard/badges/page.tsx",
      "lib/badge.ts",
      "lib/auth/guards.ts",
    ],
  },
  "billing": {
    dashboardHref: "/dashboard/billing",
    dashboardLabel: "Billing",
    authentication: { kind: "admin-session", label: "Platform-admin session", description: "GET /api/billing/diagnostics requires a signed-in platform administrator. It reports payment-provider configuration, not a customer's plan or invoices." },
    setup: [
      {"heading": "Review the active organization", "body": "Open Billing and confirm which organization and project context are displayed. Review the current plan and usage before taking any paid action."},
      {"heading": "Use only the verified billing flow", "body": "If a plan change is intended, use the dashboard's authorized checkout and provider verification. Do not send a guessed plan-update request with a project key."},
    ],
    validation: [
      {"heading": "Check existing billing records without a purchase", "body": "Compare the subscription state, usage, and invoice links with records already present in the workspace. An unavailable hosted invoice is not a generated PDF download."},
      {"heading": "Separate sandbox from payment verification", "body": "For an approved test environment, distinguish mock/test orders from live payment state. Confirm accepted server state after the verified flow; this documentation review performs no payment or account mutation."},
    ],
    integrationNotes: [
      "GET /api/billing/diagnostics requires a platform-admin session and reports Razorpay configuration only. Customers should use the Billing workspace.",
      "POST /api/billing/checkout is a separate session route with billing:update permission. Missing production provider configuration returns HTTP 503; a development mock order is not a real payment.",
    ],
    limitations: [
      "This catalog does not expose an API-key billing API, a payment-method editor, or arbitrary client-selected pricing.",
      "Displayed currency does not establish customer purchase eligibility. Prices, limits, and commercial availability remain governed by the canonical pricing and checkout configuration.",
    ],
    sourceFiles: [
      "app/api/billing/diagnostics/route.ts",
      "app/api/billing/checkout/route.ts",
      "app/dashboard/billing/page.tsx",
      "lib/auth/guards.ts",
      "components/ops/BillingActions.tsx",
    ],
  },
  "settings": {
    dashboardHref: "/dashboard/settings",
    dashboardLabel: "Settings",
    authentication: { kind: "dashboard-session", label: "Dashboard only", description: "The signed-in Settings page is a read-only reference for Guard defaults. It does not expose a settings-management API." },
    setup: [
      {"heading": "Open the default reference", "body": "Sign in and open Settings. Compare its labels with the specific endpoint or plan you are configuring; this page is not a live editor."},
      {"heading": "Choose the right configuration path", "body": "For project detector and threshold changes, open Policy Engine. Ask the deployment owner to manage environment-backed defaults rather than searching for a nonexistent Settings API."},
    ],
    validation: [
      {"heading": "Verify the reference against behavior", "body": "Compare a displayed default with the active endpoint's documented limits and response headers in your test environment. A default rate is not a promise that every plan has that rate."},
      {"heading": "Confirm the intended configuration was changed elsewhere", "body": "If a policy change was made in Policy Engine, read it back there and test the Guard result. This read-only page is not the completion signal for a saved project policy."},
    ],
    integrationNotes: [
      "No settings-management API is documented for this page. The older /v1/settings profile/team/security examples are not supported by this view.",
      "The Settings route is protected by the dashboard session boundary. Displayed constants can be environment-dependent and do not replace the endpoint's plan-aware rate-limit contract.",
    ],
    limitations: [
      "No profile/avatar editing, invitations, MFA setup, session-timeout control, or notification-channel editor exists in this page.",
      "Copying a displayed value does not change a server setting. Verify effective behavior in the actual deployment after configuration changes.",
    ],
    sourceFiles: [
      "app/dashboard/settings/page.tsx",
      "lib/guard/constants.ts",
      "middleware.ts",
      "auth.config.ts",
      "app/dashboard/policy/page.tsx",
    ],
  },
  "audit-exports": {
    dashboardHref: "/dashboard/exports",
    dashboardLabel: "Audit Exports",
    authentication: session("reports:export"),
    setup: [
      {"heading": "Confirm the required artifact path", "body": "Before relying on exports for an audit, ask the deployment owner how a completed file will be retrieved. This implementation currently records export metadata without delivering that file."},
      {"heading": "Use a controlled request scope", "body": "If evaluating the job workflow, select synthetic records, the intended organization/project, and a narrow date range. GET creates a job, so do not repeatedly open it as if it were a harmless status query."},
    ],
    validation: [
      {"heading": "Check queued and processed state separately", "body": "Confirm the HTTP 202 response, then have an authorized operator check worker completion and compare the row count with the scoped source records. Do not infer completion from request acceptance."},
      {"heading": "Require an actual artifact", "body": "Attempt retrieval only through an implemented delivery path and verify file contents and integrity before declaring export success. The current processor has no such artifact output; retain this as a blocker, not a successful download."},
    ],
    integrationNotes: [
      "GET /api/exports requires a signed-in session with reports:export permission. kind is GUARD_LOGS or WEBHOOK_DELIVERIES; format is JSONL or CSV. It is a state-changing job request, not a file response.",
      "Requests are limited to 10 per minute per organization/user. Records have a seven-day expiresAt value, but the processor does not serialize a downloadable artifact or return the old X-Manifest-Signature download header.",
    ],
    limitations: [
      "Artifact delivery is incomplete in the reviewed source. Do not promise downloads, scheduled cloud delivery, or a complete external-audit export from this route. The manifest signature covers count, kind, organization, and generation time, not individual row contents. It does not establish row-content integrity, and the worker does not invoke the available serialization helpers.",
      "Rows are limited to 25,000 and depend on stored relational records. The job-status endpoint is platform-admin-only; ordinary export permission does not grant access to it.",
    ],
    sourceFiles: [
      "app/api/exports/route.ts",
      "app/dashboard/exports/page.tsx",
      "lib/audit/export.ts",
      "lib/backgroundJobProcessors.ts",
      "app/api/jobs/[id]/route.ts",
      "lib/auth/guards.ts",
    ],
  },
  "onboarding": {
    dashboardHref: "/dashboard/onboarding",
    dashboardLabel: "Onboarding",
    authentication: projectApiKey,
    setup: [
      {"heading": "Prepare a project and server key", "body": "Open Onboarding and follow the project/key steps. Keep the key in a server secret store and use the quickstart for the supported request shape."},
      {"heading": "Connect and verify the application path", "body": "Send a synthetic message through the project input Guard, enforce its decision before the model call, and guard the output before release. Mark the SDK step only after installing and exercising the client."},
    ],
    validation: [
      {"heading": "Verify the first protected request", "body": "Retain the real Guard response and inspect the corresponding project record after persistence. A public playground result alone does not demonstrate that your private application uses the right key or policy."},
      {"heading": "Verify checklist claims independently", "body": "Compare completion flags with the underlying resources. SDK installation is self-reported, and report/webhook flags can reflect a queued or configured operation rather than a completed delivery."},
    ],
    integrationNotes: [
      "POST /api/guard/input requires x-api-key and JSON containing message. It does not accept the older protect({ input }) response assumptions from the hidden catalog snippet.",
      "The dashboard uses a signed-in session for saved progress. PATCH /api/onboarding updates flags; it is not proof that the SDK is installed or that a protected request, report, or webhook completed.",
    ],
    limitations: [
      "No guaranteed setup time or fully validated security posture follows from a completed checklist.",
      "Guard limits and deferred persistence follow the actual endpoint/deployment configuration. Test failure, review, and blocked outcomes in your own executor, not just the happy path.",
    ],
    sourceFiles: [
      "app/api/guard/input/route.ts",
      "app/api/onboarding/route.ts",
      "app/dashboard/onboarding/page.tsx",
      "lib/onboarding.ts",
      "lib/validations.ts",
      "lib/apiKeyMiddleware.ts",
    ],
  },
};

export function getServiceExperience(serviceId: string): ServiceExperience {
  return SERVICE_EXPERIENCE[serviceId] ?? {
    dashboardHref: "/dashboard",
    dashboardLabel: "Dashboard",
    authentication: { kind: "dashboard-session", label: "Dashboard", description: "Sign in to the dashboard. No service-specific integration is documented for this identifier." },
    setup: [],
    validation: [],
    integrationNotes: [],
    limitations: [],
    sourceFiles: [],
  };
}
