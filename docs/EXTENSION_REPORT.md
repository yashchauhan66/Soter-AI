# Soter Enterprise AI Control Plane Extension Report

Report date: 2026-06-30

## 1. Executive Summary

Soter Enterprise AI Control Plane ek Chrome/Edge Manifest V3 browser extension hai jo employees ke public aur enterprise AI tools usage ko secure karta hai. Extension ka main objective company secrets, PII, source code, customer data, financial/HR data, legal contracts, production logs aur prompt-injection content ko public LLM tools mein leak hone se pehle detect, redact, rewrite, block ya approval workflow mein bhejna hai.

Product sirf browser extension tak limited nahi hai. Is repo mein extension ke saath backend APIs, admin dashboard pages, policy engine, detector packages, enrollment system, audit logs, heartbeats, emergency lockdown, shadow AI discovery, SIEM/webhook integrations aur enterprise deployment documentation bhi present hai.

## 2. Extension Identity

- Product name: Soter Enterprise AI Control Plane
- Package name: `@soterai/extension`
- Extension version: `0.1.0`
- Root app version: `soterai` `0.2.0`
- Browser platform: Chrome/Edge Manifest V3
- Minimum Chrome version: 116
- Main extension path: `apps/extension`
- Build output path observed: `apps/extension/dist`
- Core scripts:
  - `npm run build:extension`
  - `npm run typecheck:extension`
  - `npm run test:extension`

## 3. Business Problem

Employees increasingly paste sensitive work context into AI tools like ChatGPT, Claude, Gemini, Perplexity, Replit, StackBlitz, CodeSandbox, v0, Bolt, Lovable and local AI tools. Without a browser-side control plane, companies have limited visibility into:

- Secrets and tokens pasted into prompts.
- Source code copied into public AI tools.
- Customer/employee/financial/legal data exposure.
- File uploads containing confidential documents.
- Unapproved or unknown AI tool usage, also called Shadow AI.
- Emergency incidents where AI usage must be restricted quickly.

Soter solves this by enforcing policy at the point of use, inside the browser, before data leaves the employee workstation.

## 4. High-Level Architecture

The extension has five major layers:

1. Content layer
   - Runs on web pages.
   - Detects AI destinations.
   - Intercepts prompt submit, paste, file upload and response scanning events.
   - Shows user overlays with warnings, redacted text, safe rewrites and approval options.

2. Background service worker
   - Handles runtime messages.
   - Runs local scans.
   - Syncs organization policy.
   - Sends heartbeat events.
   - Writes audit and scan events to the backend.
   - Handles enrollment and approval requests.

3. Local detector and policy engine
   - Scans text locally using `@soterai/detectors`.
   - Evaluates actions using `@soterai/policy-engine`.
   - Applies destination-specific rules and emergency lockdown.

4. Backend APIs
   - Exposes policy, destinations, enrollment, scan, audit, heartbeat, approval and shadow-AI endpoints under `app/api/extension`.

5. Admin dashboard
   - Provides admin pages for AI destinations, policies, approvals, extension health, extension events, enrollments, Shadow AI and SIEM webhooks.

## 5. Supported AI Destinations

The code includes adapters and destination detection for common AI and AI-coding products:

- ChatGPT / OpenAI
- Claude
- Gemini / Bard
- Perplexity
- Poe
- Replit
- StackBlitz
- CodeSandbox
- GitHub Codespaces
- Bolt
- v0
- Lovable
- OpenWebUI
- Localhost AI tools
- Generic AI chat pages
- Generic editor-like AI tools

The content script also detects likely Shadow AI domains using known platform matching and heuristic hostname keywords such as `ai`, `llm`, `chatbot`, `assistant`, `copilot` and `genai`.

## 6. Main Features

### 6.1 Prompt Submit Interception

When a user tries to send a prompt on a monitored AI destination, the extension:

- Reads the active prompt from the page adapter.
- Prevents the submit temporarily.
- Sends text to the background worker for local scan.
- Evaluates policy.
- Either allows the prompt, blocks it, asks for approval, asks for justification, warns the user, or provides redacted/rewritten text.

This is implemented through `installSubmitInterceptor` and adapter-specific prompt targets.

### 6.2 Paste Monitoring

The extension installs a paste listener on monitored AI destinations. This catches risky content before or during prompt entry and helps prevent accidental sensitive-data paste into AI tools.

### 6.3 File Upload Monitoring

The extension monitors file input changes on active AI pages. It scans selected file names, MIME types and sizes. It flags sensitive file names such as:

- `.env`
- secret/credential/private files
- production files
- customer data
- payroll/salary files
- contracts
- `.pem` and `.key` files

For strict actions such as block, approval or justification, the extension clears the file input to prevent upload.

### 6.4 Response Scanning

The content layer supports AI response observation. This can be enabled or disabled by destination policy through `responseScanningEnabled`.

### 6.5 Context Menu Scan

The background worker registers a context menu scan action. Users can select text on a page, scan it with Soter and open the side panel to view results.

### 6.6 Safe Context Capsule / Rewrite

When sensitive data is found, the extension can produce a safer rewritten prompt. The rewrite logic preserves intent while removing or replacing sensitive elements such as:

- Secrets and API keys
- Internal URLs
- Private repository references
- Customer names/emails/phones
- Contract parties and amounts
- Employee and salary details
- Financial figures
- Internal IPs and paths from production logs

### 6.7 Redaction

The scanner creates redacted previews using local replacement patterns. Examples include:

- AWS keys
- GitHub tokens
- Slack tokens
- JWTs
- Private keys
- Database URLs
- Generic API keys/secrets/passwords
- Aadhaar
- PAN
- GSTIN
- IFSC
- Email
- Phone
- Credit card numbers
- Internal IPs and paths

### 6.8 Approval Workflow

For policy actions requiring approval, the extension calls:

- `POST /api/extension/approval-request`
- `GET /api/extension/approval-status/[requestId]`
- `POST /api/extension/approval-claim`

The extension sends only redacted previews and policy metadata for admin review.

### 6.9 Emergency Lockdown

Emergency lockdown can be enabled from admin/backend policy state. Locally, the extension enforces lockdown rules even when offline from cached policy.

Observed lockdown behaviors:

- Block all file uploads when configured.
- Allow only enterprise/internal AI destinations when configured.
- Block configured data types.
- Require approval for configured data types.
- Shorten policy sync interval during lockdown.
- Reflect lockdown status in popup and side panel.

### 6.10 Enrollment

The extension supports two enrollment modes:

- Managed enterprise enrollment through `chrome.storage.managed`.
- Self-service enrollment through an enrollment code.

Managed config fields include:

- `apiBaseUrl`
- `organizationId`
- `employeeId`
- `email`
- `department`
- `role`
- `deviceToken`
- `policyChannel`
- `enrollmentMode`
- `logLevel`

Self-service enrollment calls `POST /api/extension/enroll`, stores organization and employee context, and receives a device token.

### 6.11 Policy Sync and Offline Enforcement

Policy sync uses:

- `GET /api/extension/policy?organizationId=<org-id>`
- `GET /api/extension/destinations?organizationId=<org-id>`

The extension caches the latest policy locally. If policy sync fails, it continues using cached policy and marks sync status as `offline` or `error`.

### 6.12 Heartbeats

The extension sends periodic heartbeat events to:

- `POST /api/extension/heartbeat`

Heartbeat payload includes:

- Organization ID
- Employee ID
- Extension version
- Browser name
- Policy version
- Last active timestamp
- Lockdown status

Heartbeat response can trigger short polling or policy resync if lockdown state changed.

### 6.13 Audit and Scan Logging

For each scan, the extension writes:

- Audit event: `POST /api/extension/audit-log`
- Scan summary: `POST /api/extension/scan`

Audit metadata includes:

- Organization ID
- Employee ID
- Browser
- Domain and URL
- Policy version
- Action
- Severity
- Risk score
- Detected data types
- Matched rule IDs
- Redacted preview
- Event type
- Timestamp

### 6.14 Shadow AI Discovery

If the user visits an AI-like domain that is not explicitly configured, the content script can report it as Shadow AI through:

- `POST /api/extension/shadow-ai-discovered`

This helps admins discover unsanctioned AI tools used by employees.

## 7. Detectors

The detector package combines multiple detector modules:

- Secrets detection
- India PII detection
- Global PII detection
- Source code detection
- Business-sensitive data detection
- Prompt-injection detection

The scanner deduplicates findings, computes detected data types and generates a risk score capped at 100.

Important detected categories include:

- API keys and tokens
- AWS access keys
- GitHub tokens
- Slack tokens
- JWTs
- Private keys
- Database URLs
- Passwords
- Aadhaar
- PAN
- GSTIN
- UPI/IFSC style financial identifiers
- Email and phone numbers
- Credit cards
- Source code
- Customer data
- Legal contracts
- HR salary data
- Financial text
- Production logs
- Prompt injection
- Custom keyword and regex matches from policy

## 8. Policy Engine

The policy engine evaluates:

- Organization policy status
- Default action
- Risk thresholds
- Custom policy rules
- Destination domain
- Destination type
- Department
- Role
- Detected data types
- Risk score
- Optional intent
- Destination-specific overrides

Policy actions include:

- `allow`
- `log_only`
- `warn`
- `redact`
- `rewrite`
- `require_justification`
- `require_approval`
- `block`

The engine uses action precedence, so stricter matched rules override weaker ones.

## 9. User Interface

### Popup

The popup shows:

- Enrollment status
- Organization
- Employee
- Department/role
- Policy version
- Sync status
- Last heartbeat
- Emergency lockdown notice
- Sync button
- Enrollment form when not enrolled

### Side Panel

The side panel shows:

- Enrollment and policy status
- Latest scan result
- Action selected by policy
- Risk score
- Detected data types
- Safe rewritten/redacted prompt
- Copy safe prompt action
- Request approval action

### Overlay

The in-page overlay is used for real-time enforcement. It can present policy results, replace text with safe output, copy safe content, or request approval.

## 10. Backend/API Surface

Extension-specific APIs present in the repo:

- `app/api/extension/policy/route.ts`
- `app/api/extension/destinations/route.ts`
- `app/api/extension/enroll/route.ts`
- `app/api/extension/heartbeat/route.ts`
- `app/api/extension/scan/route.ts`
- `app/api/extension/audit-log/route.ts`
- `app/api/extension/approval-request/route.ts`
- `app/api/extension/approval-status/[requestId]/route.ts`
- `app/api/extension/approval-claim/route.ts`
- `app/api/extension/emergency-lockdown/route.ts`
- `app/api/extension/shadow-ai-discovered/route.ts`

Admin-related pages present in the repo:

- AI destinations
- AI policies
- Emergency lockdown
- Approvals
- Extension enrollments
- Extension events
- Extension health
- Shadow AI
- SIEM webhook integrations

## 11. Enterprise Deployment

Deployment documentation exists for:

- Chrome Enterprise force install
- Edge Enterprise force install
- Chrome private listing
- Edge hidden listing
- Store review notes
- Permission justification
- Privacy policy
- Screenshots checklist

Managed deployment uses browser enterprise policy and `chrome.storage.managed` to push org configuration. The documentation correctly notes that Soter does not attempt malware-like persistence; non-removable deployment must come from Chrome/Edge management.

## 12. Permissions

Current `manifest.json` requests:

- `activeTab`
- `contextMenus`
- `sidePanel`
- `storage`
- `scripting`
- `alarms`
- `identity`
- `identity.email`
- `host_permissions: ["<all_urls>"]`

Permission purpose:

- `storage`: cache policy, enrollment state and extension state.
- `activeTab`: work with active monitored AI tab.
- `contextMenus`: user-triggered text scan.
- `sidePanel`: scan results and policy visibility.
- `scripting`: extension page integration.
- `alarms`: policy sync and heartbeat schedule.
- `identity` / `identity.email`: managed identity or employee mapping.
- `host_permissions`: content-script operation across pages, then activation is gated by destination context.

Important review note: current store permission documentation says host permissions are limited to specific AI domains, but the current manifest uses `<all_urls>`. This mismatch should be resolved before store submission or enterprise security review.

## 13. Security and Privacy Posture

Positive security properties:

- Sensitive prompt scanning happens locally before backend submission.
- Backend scan/audit payloads use redacted previews instead of raw prompt text for audit records.
- Device token is sent through `x-soter-extension-token`.
- Enrollment token tests verify raw enrollment tokens are not stored.
- Popup tests verify device token is not rendered in UI.
- Cached policies support offline enforcement.
- Emergency lockdown is enforced locally.
- Force-install documentation avoids non-compliant persistence behavior.

Areas requiring careful handling:

- `<all_urls>` host permission creates high review burden.
- `identity.email` needs clear user/admin justification.
- Redacted preview is still sensitive metadata and should follow retention policy.
- Device token storage in browser local storage should be reviewed for threat model and rotation.
- Policy bundles mention optional signature in docs; implementation should confirm signature verification if this is a production guarantee.

## 14. Testing Coverage

Extension-specific tests are present under `tests/extension`:

- `destinations.test.ts`
- `detectors.test.ts`
- `emergency-lockdown.test.ts`
- `enrollment-tokens.test.ts`
- `extension-runtime.test.ts`
- `p0-beta-readiness.test.ts`
- `policy-engine.test.ts`

Important tested behaviors include:

- Detector output and data type classification.
- Policy engine action selection.
- Destination matching.
- Emergency lockdown behavior.
- Enrollment token hashing, expiry, revocation and overuse.
- Self-service enrollment credential behavior.
- Popup state rendering without exposing device tokens.
- Built extension manifest and referenced-file existence.

## 15. Current Strengths

- Strong end-to-end concept: browser enforcement plus backend governance.
- Local-first scanning reduces raw data exposure.
- Good support for Indian enterprise data types such as Aadhaar, PAN, GSTIN and IFSC.
- Policy engine supports roles, departments, destination types and risk thresholds.
- Emergency lockdown is valuable for incidents.
- Shadow AI discovery is a strong admin visibility feature.
- Admin dashboard routes cover operational workflows.
- Enterprise deployment docs are already started.
- Test coverage includes security-sensitive enrollment and lockdown flows.

## 16. Gaps and Risks

1. Manifest permission mismatch
   - Docs say specific host permissions, but manifest uses `<all_urls>`.
   - This can create Chrome/Edge store review friction and enterprise security questions.

2. Build output path mismatch risk
   - Extension package builds to `apps/extension/dist`.
   - One test references `dist/extension`, so verify final packaging expectation.

3. Policy signature verification unclear
   - Docs mention optional signature field.
   - Reported code path fetches and caches policy, but signature verification was not evident in reviewed files.

4. Response scanning privacy boundary
   - Response observation exists and can be disabled per destination.
   - Admin/user-facing documentation should clearly explain what is scanned and when.

5. Shadow AI heuristic false positives
   - Hostname keyword heuristics can classify some domains incorrectly.
   - Admin UI should allow dismissal/approval of discovered tools.

6. Raw prompt handling in scan API
   - Extension `scan` client sends summary/redacted preview, but `handleScan` also calls scan with original text available in payload before API client strips it.
   - Keep tests around API client payload shape so raw prompt text never leaks accidentally.

7. Store-readiness docs need sync
   - Permission justification references permissions such as `tabs` and `webNavigation`, while current manifest does not list them.
   - Host permission section also conflicts with current manifest.

## 17. Recommendations

### P0 Before Production/Beta

- Decide whether host permissions should remain `<all_urls>` or be restricted to configured AI destinations.
- Align `docs/extension-store/permission-justification.md` with the real manifest.
- Verify final build/package path and update tests or scripts accordingly.
- Add or document policy signature verification if signed policies are part of the security model.
- Run `npm run typecheck:extension`, `npm run build:extension` and `npm run test:extension`.

### P1 Hardening

- Add tests that assert extension scan/audit API payloads never include raw prompt text.
- Add test cases for Shadow AI false positives and known AI domains.
- Add token rotation and unenrollment behavior tests.
- Add admin audit tests for approval decisions.
- Add docs for response scanning privacy boundaries.

### P2 Product Polish

- Add onboarding screenshots for managed and self-service enrollment.
- Add admin-facing incident playbook for emergency lockdown.
- Add SIEM event field mapping examples.
- Add customer deployment checklist for Chrome and Edge.

## 18. Suggested Demo Flow

1. Admin creates organization policy and destinations.
2. Admin creates enrollment token or configures managed storage.
3. User installs/enrolls extension.
4. Extension syncs policy and sends heartbeat.
5. User opens ChatGPT/Claude/Gemini.
6. User pastes a prompt containing a secret, source code or PII.
7. Extension intercepts submit and shows overlay.
8. User copies safe rewritten prompt or requests approval.
9. Admin sees event in extension events/approvals dashboard.
10. Admin enables emergency lockdown.
11. Extension receives short polling/heartbeat update and enforces strict policy locally.
12. Shadow AI visit is detected and appears in admin dashboard.

## 19. File Inventory

Key extension files:

- `apps/extension/manifest.json`
- `apps/extension/managed-schema.json`
- `apps/extension/src/background/service-worker.ts`
- `apps/extension/src/background/policy-sync.ts`
- `apps/extension/src/background/heartbeat.ts`
- `apps/extension/src/content/index.ts`
- `apps/extension/src/content/submit-interceptor.ts`
- `apps/extension/src/content/file-upload-listener.ts`
- `apps/extension/src/content/paste-listener.ts`
- `apps/extension/src/content/response-observer.ts`
- `apps/extension/src/lib/scanner.ts`
- `apps/extension/src/lib/api-client.ts`
- `apps/extension/src/lib/enrollment.ts`
- `apps/extension/src/popup/PopupApp.tsx`
- `apps/extension/src/sidepanel/SidePanelApp.tsx`

Shared packages:

- `packages/detectors`
- `packages/policy-engine`
- `packages/shared`

Docs:

- `docs/extension`
- `docs/extension-store`
- `docs/ai-workstation-guard`

Tests:

- `tests/extension`
- `tests/admin-ai-policies`

## 20. Final Assessment

Soter extension ka foundation strong hai. Isme real enterprise controls present hain: local detection, policy enforcement, approval workflow, emergency lockdown, enrollment, heartbeat, audit trail, Shadow AI discovery aur admin dashboard integration.

Production readiness ke liye sabse important kaam docs-manifest alignment, permission scope decision, package/build verification aur policy-signature/security-hardening hai. In items ko close karne ke baad extension private enterprise deployment ya controlled beta pilot ke liye strong candidate ban sakta hai.
