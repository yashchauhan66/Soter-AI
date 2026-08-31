import { scanText } from "../../../../packages/detectors/src/index";
import { evaluatePolicy } from "../../../../packages/policy-engine/src/evaluatePolicy";
import type { DestinationType } from "../../../../packages/policy-engine/src/types";
import { auditSafePreview, redactSensitiveText } from "./redaction";
import { rewritePromptSafely } from "./rewrite";
import type { ExtensionState, ScanEventType, ScanResult } from "./types";
import { BUILT_IN_AI_DESTINATIONS, matchAIDestination } from "../../../../packages/shared/src/ai-destinations";
import { classifyLocal, mergeMlIntoScan } from "./ml-classifier";

export function destinationTypeForUrl(url: string, state?: ExtensionState): DestinationType {
  const configured = state ? matchAIDestination(url, state.policy?.destinations ?? [], state.config.department, state.config.role) : undefined;
  if (configured) return configured.category;
  // v0.2.2: this used to be a seven-domain regex maintained by hand, and it drifted — every host
  // added to the manifest after it was written resolved to "unknown", which silently unmatched
  // every rule scoped to a destination type. Falling back to the same built-in table the default
  // policy is built from means one list, and adding a host in one place cannot weaken the other.
  const builtIn = matchAIDestination(url, BUILT_IN_AI_DESTINATIONS.map((destination) => ({ ...destination, organizationId: "built-in" })));
  return builtIn?.category ?? "unknown";
}

export function domainFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

export function scanPrompt(text: string, url: string, state: ExtensionState, eventType: ScanEventType = "scan"): ScanResult {
  const localScan = scanText(text.slice(0, state.policy?.maxPromptChars ?? 20000));
  const customDetectedDataTypes = detectCustomPolicyMatches(text, state.policy);
  // v0.2.0: local ML heuristic classifier (entropy + injection n-grams). Runs
  // synchronously and can only RAISE the risk score / add findings, never downgrade.
  const mlLocal = classifyLocal(text);
  const baseDetectedDataTypes = Array.from(new Set([...localScan.detectedDataTypes, ...customDetectedDataTypes])).sort();
  const baseRiskScore = Math.min(100, localScan.riskScore + customDetectedDataTypes.length * 20);
  const mlMerged = mergeMlIntoScan(baseRiskScore, baseDetectedDataTypes, mlLocal);
  const detectedDataTypes = mlMerged.detectedDataTypes;
  const riskScore = mlMerged.riskScore;
  const domain = domainFromUrl(url);
  const policy = state.policy;
  if (!policy) throw new Error("Soter policy cache is not initialized.");

  const failClosed = failClosedDecision(state, policy);
  if (failClosed) {
    const redactedText = redactSensitiveText(text, detectedDataTypes);
    // SS-11: `rewrittenSafeText` used to be the *raw* prompt here. Every consumer treats
    // that field as the safe variant — the overlay renders it as "Redacted/Safe Preview",
    // "Use safe prompt" writes it back into the page input and replays the submit, and
    // "Copy safe prompt" puts it on the clipboard. A fail-closed block therefore handed
    // the unredacted text (secrets included) straight back to the page it had just
    // refused. In a state where the extension cannot trust its own policy, the only
    // text it may emit is the redacted one.
    return {
      hasFindings: true,
      riskScore: 100,
      detectedDataTypes: Array.from(new Set([...detectedDataTypes, failClosed.dataType])),
      findings: localScan.findings.map((finding) => ({ ...finding, match: auditSafePreview(finding.match, [finding.type], 120) })),
      action: "block",
      policy: {
        action: "block",
        severity: "critical",
        matchedRules: [{ id: failClosed.id, name: failClosed.name, action: "block", severity: "critical" }],
        userMessage: failClosed.userMessage,
        adminMessage: failClosed.adminMessage,
        redactedText,
        rewrittenSafeText: redactedText,
        auditMetadata: {},
      },
      redactedText,
      rewrittenSafeText: redactedText,
      scannedAt: new Date().toISOString(),
    };
  }
  const destination = matchAIDestination(url, policy.destinations ?? [], state.config.department, state.config.role);
  const destinationRules = Object.entries(destination?.policyOverrides ?? {}).map(([dataType, action]) => ({
    id: `destination-${destination?.destinationId}-${dataType}`,
    name: `${destination?.name}: ${dataType}`,
    action,
    detectedDataTypes: dataType === "secrets" ? ["env_file", "api_key", "aws_access_key", "github_token", "slack_token", "jwt", "private_key", "database_url", "password"] : [dataType],
    destinations: [domain],
  }));
  let evaluation = evaluatePolicy({
    organizationId: state.config.organizationId,
    employeeId: state.config.employeeId,
    department: state.config.department,
    role: state.config.role,
    destinationDomain: domain,
    destinationType: destinationTypeForUrl(url, state),
    text,
    detectedDataTypes,
    riskScore,
    defaultOrgPolicy: policy,
    customRules: destinationRules,
  });
  const lockdownAction = emergencyLockdownAction({
    state,
    destinationType: destination?.category ?? destinationTypeForUrl(url, state),
    detectedDataTypes,
    eventType,
  });
  if (lockdownAction) {
    evaluation = {
      ...evaluation,
      action: lockdownAction,
      severity: lockdownAction === "block" ? "critical" : "high",
      matchedRules: [{ id: "emergency-lockdown", name: "Emergency lockdown", action: lockdownAction, severity: lockdownAction === "block" ? "critical" : "high" }],
      userMessage: lockdownAction === "block" ? "Blocked by your organization's emergency AI lockdown." : "Approval is required during emergency AI lockdown.",
      adminMessage: "Emergency lockdown policy enforced locally by the extension.",
    };
  }
  const redactedText = redactSensitiveText(text, detectedDataTypes);
  return withHardEnforcement({
    hasFindings: localScan.findings.length > 0 || customDetectedDataTypes.length > 0 || mlLocal.detectedDataTypes.length > 0,
    riskScore,
    detectedDataTypes,
    findings: localScan.findings.map((finding) => ({ ...finding, match: auditSafePreview(finding.match, [finding.type], 120) })),
    action: evaluation.action,
    policy: { ...evaluation, redactedText, rewrittenSafeText: rewritePromptSafely(redactedText, detectedDataTypes, evaluation.action) },
    redactedText,
    rewrittenSafeText: rewritePromptSafely(redactedText, detectedDataTypes, evaluation.action),
    scannedAt: new Date().toISOString(),
  }, hardEnforcementEnabled(state));
}

/**
 * Positive tamper signals. These mean the policy bundle was modified, replayed or
 * issued for another tenant — not merely that no key is configured.
 */
const POLICY_TAMPER_CODES = new Set(["malformed", "unsupported_algorithm", "organization_mismatch", "hash_mismatch", "signature_mismatch", "rollback"]);

/**
 * Rule ids the fail-closed gate emits. A block carrying one of these is not a normal
 * policy decision about the *content* — it means the extension cannot currently trust the
 * policy it would otherwise evaluate, so no remediation path may put text back into the
 * page or submit anything (SS-11).
 */
export const FAIL_CLOSED_RULE_IDS: readonly string[] = [
  "policy-integrity-fail-closed",
  "policy-signature-required-fail-closed",
  "offline-fail-closed",
];

/** True when this result came from the fail-closed gate rather than content evaluation. */
export function isFailClosedBlock(result: ScanResult) {
  return result.action === "block"
    && result.policy.matchedRules.some((rule) => FAIL_CLOSED_RULE_IDS.includes(rule.id));
}

/**
 * What the enforcement overlay is allowed to offer for a decision. Kept here, next to the
 * decision itself, so the UI cannot invent an affordance the kernel did not authorise.
 *
 *  - `canReplace`          — may write `rewrittenSafeText` into the page input.
 *  - `canSubmitSafeText`   — may then replay the submit with that transformed text.
 *  - `canSubmitOriginal`   — may the text as typed reach the destination.
 *
 * A fail-closed block allows none of the three: an audited dismiss (which never submits) is
 * the only way out, and the redacted preview may still be copied for the user's own records.
 */
export function remediationAffordances(result: ScanResult): {
  canReplace: boolean;
  canSubmitSafeText: boolean;
  canSubmitOriginal: boolean;
  canCopyPreview: boolean;
} {
  if (isFailClosedBlock(result)) {
    return { canReplace: false, canSubmitSafeText: false, canSubmitOriginal: false, canCopyPreview: true };
  }
  if (result.action === "block") {
    return { canReplace: true, canSubmitSafeText: true, canSubmitOriginal: false, canCopyPreview: true };
  }
  return { canReplace: true, canSubmitSafeText: true, canSubmitOriginal: !shouldPreventSubmit(result.action), canCopyPreview: true };
}

/**
 * SS-7: whether a previously granted approval may release *this* decision.
 *
 * The interceptor now always scans before it looks at its ledger, so this is asked against
 * the decision that exists at submit time rather than the one that existed when the user was
 * approved. That ordering is the whole control: an approval is authority over a content
 * decision, never authority over a state in which the extension does not trust its policy.
 *
 * `block` therefore never releases — which covers ordinary content blocks, hard enforcement,
 * emergency lockdown and every fail-closed reason at once, because they all land on `block`.
 * `require_approval` / `require_justification` do release, since that is exactly the decision
 * the user obtained authority for. Actions that were never intercepted are unaffected.
 */
export function canApprovalRelease(result: ScanResult): boolean {
  if (isFailClosedBlock(result)) return false;
  if (result.action === "block") return false;
  return shouldPreventSubmit(result.action) || result.hasFindings;
}

interface FailClosedDecision {
  id: string;
  name: string;
  dataType: string;
  userMessage: string;
  adminMessage: string;
}

/**
 * SS-4: a single fail-closed gate covering every state in which the extension cannot
 * trust the policy it is enforcing.
 *
 * Previously only `policySyncStatus === "offline"` was gated, and only when a
 * fail-closed flag was set — so a *tampered* bundle (which sets `"error"`) fell through
 * to normal evaluation against a policy the extension had already refused to trust.
 * A tamper signal now blocks regardless of the availability flag, because it is a
 * positive attack signal rather than a connectivity problem.
 */
function failClosedDecision(state: ExtensionState, policy: NonNullable<ExtensionState["policy"]>): FailClosedDecision | undefined {
  const integrity = state.policyIntegrity;
  if (integrity && !integrity.verified && POLICY_TAMPER_CODES.has(integrity.code)) {
    return {
      id: "policy-integrity-fail-closed",
      name: "Policy Integrity Fail-Closed",
      dataType: "policy_tamper_block",
      userMessage: "Blocked: Soter could not verify your organization's security policy. Contact your administrator.",
      adminMessage: `Policy integrity check failed (${integrity.code}); extension is failing closed locally.`,
    };
  }
  if (state.config.requirePolicySignature === true && integrity?.verified !== true) {
    return {
      id: "policy-signature-required-fail-closed",
      name: "Signed Policy Required",
      dataType: "policy_unverified_block",
      userMessage: "Blocked: your organization requires a cryptographically signed Soter policy, which is not available.",
      adminMessage: "requirePolicySignature is enabled but no verified policy bundle is present.",
    };
  }
  if (
    (state.policySyncStatus === "offline" || state.policySyncStatus === "error") &&
    (policy.offlineFailClosed || state.config.offlineFailClosed)
  ) {
    return {
      id: "offline-fail-closed",
      name: "Offline Fail-Closed Policy",
      dataType: "offline_block",
      userMessage: "Blocked by your organization's offline fail-closed policy (Soter is offline).",
      adminMessage: "Offline fail-closed policy enforced locally by the extension.",
    };
  }
  return undefined;
}

/** True when hard enforcement is on via signed org policy OR managed config. */export function hardEnforcementEnabled(state: ExtensionState) {
  return state.policy?.hardEnforcement === true || state.config.hardEnforcement === true;
}

/**
 * Tags a `block` result with the `hard-enforcement-block` rule so the overlay
 * renders a locked, non-dismissible block (the user cannot casually close it
 * and re-submit). No-op for non-block actions or when hard enforcement is off.
 * Idempotent — will not add the rule twice.
 */
export function withHardEnforcement(result: ScanResult, enabled: boolean): ScanResult {
  if (!enabled || result.action !== "block") return result;
  if (result.policy.matchedRules.some((rule) => rule.id === "hard-enforcement-block")) return result;
  return {
    ...result,
    policy: {
      ...result.policy,
      matchedRules: [
        { id: "hard-enforcement-block", name: "Hard enforcement block", action: "block", severity: "critical" },
        ...result.policy.matchedRules,
      ],
      userMessage: result.policy.userMessage
        || "Blocked by your organization's enforcement policy. This submission cannot be sent.",
    },
  };
}

/**
 * Emergency lockdown, read defensively so a partial policy still enforces what the UI claims.
 *
 * Two real defects lived here. `blockedDataTypes.includes(...)` and
 * `requireApprovalDataTypes.includes(...)` were called unguarded, so an admin policy of
 * `{ enabled: true }` — which is what a hand-written lockdown looks like, and what the
 * lockdown test harness sent — threw a TypeError mid-scan. And the three switches typed as
 * literal `true` in `ExtensionOrgPolicy` were read as optional booleans, so when they were
 * absent the whole function fell through to `null`: the popup, the side panel and
 * `enrollmentStatusLabel()` all announced "Emergency lockdown active" while nothing was
 * being enforced at all — the worst possible failure for a control whose only job is to be
 * believed in an incident.
 *
 * The fix follows the declared contract: in that type the three switches were literally
 * `true`, so a lockdown that omits one *means* it, and `!== false` is the honest reading.
 * An admin who wants a narrower lockdown sets the field to `false` explicitly. The two
 * arrays default to empty, which is safe: destination gating already stops every
 * non-enterprise destination, so an omitted data-type list narrows nothing.
 */
export function emergencyLockdownAction(input: {
  state: ExtensionState;
  destinationType: DestinationType;
  detectedDataTypes: string[];
  eventType: ScanEventType;
}): "block" | "require_approval" | null {
  const lockdown = input.state.policy?.emergencyLockdown;
  if (!lockdown?.enabled) return null;
  const blockedDataTypes = Array.isArray(lockdown.blockedDataTypes) ? lockdown.blockedDataTypes : [];
  const requireApprovalDataTypes = Array.isArray(lockdown.requireApprovalDataTypes) ? lockdown.requireApprovalDataTypes : [];
  if (input.eventType === "file_upload" && lockdown.blockAllFileUploads !== false) return "block";
  if (lockdown.allowOnlyEnterpriseDestinations !== false && !["enterprise_ai", "internal"].includes(input.destinationType)) return "block";
  if (input.detectedDataTypes.some((type) => blockedDataTypes.includes(type))) return "block";
  if (input.detectedDataTypes.some((type) => requireApprovalDataTypes.includes(type))) return "require_approval";
  return null;
}

export function shouldPreventSubmit(action: ScanResult["action"]) {
  return action === "block" || action === "require_approval" || action === "require_justification";
}

/**
 * v0.2.2 — how much of the user's attention a verdict is allowed to take.
 *
 * Until 0.2.2 both enforcement paths asked `hasFindings` and, if it was true, raised the same
 * full-screen modal with a backdrop over the entire page. A `redact`-severity match on a React
 * component therefore interrupted the user exactly as hard as a leaked AWS key. Measured in real
 * Edge on a fresh install with the shipped default policy: 9 of 16 ordinary work pastes — a React
 * component, a stack trace, a JSON blob, a SQL query, a tsconfig, an app log, a git diff, a curl
 * command and an email about an invoice — each raised a modal from `local-business-redact`, and in
 * all 9 the text was handed back byte for byte unchanged. Nine interruptions, nothing protected.
 *
 * The distinction that matters is not severity but whether there is anything for the user to do:
 *
 *  - `decision` — the gesture stops and the overlay is shown. Either the kernel is withholding the
 *    submission (`block` / `require_approval` / `require_justification`, which covers hard
 *    enforcement, lockdown and every fail-closed reason), or the safe variant differs from what the
 *    user wrote, and no one may have their words altered without being told.
 *  - `notice`   — something matched, nothing was withheld and nothing was changed: a corner notice
 *    states it and the user keeps working. Staying silent here would be its own dishonesty, the
 *    same under-claiming the response-scanning badge was guilty of.
 *  - `none`     — nothing matched; the extension has nothing to say.
 *
 * `textAltered` is the caller's own comparison because the two paths hold different safe variants,
 * and it answers a slightly different question on each:
 *
 *  - paste — "were their words changed?" The fragment has already been written into the composer, so
 *    the comparison is against what actually landed there (see `shouldSanitizeFragment`: under a
 *    `warn` verdict that is the user's own text, and reporting an alteration then would be a lie).
 *  - submit — "are there two different candidate messages?" Nothing has been changed yet; the
 *    sanitized variant merely differs from what is in the field. That is still a `decision`, because
 *    there is a real choice to make — send mine, or send the scrubbed one — and only the user can
 *    make it. Where the two variants are identical there is no choice, and no interruption.
 *
 * Both must compare against the text *without* the footer (`safeFragmentText`), or the appended
 * "Soter sanitized this prompt" note makes every redact-level verdict look altered and the fix
 * evaporates.
 */
export function interruptionLevel(result: ScanResult, textAltered: boolean): "decision" | "notice" | "none" {
  if (shouldPreventSubmit(result.action) || textAltered) return "decision";
  return result.hasFindings ? "notice" : "none";
}

/**
 * The actions that authorise changing the user's text. Read straight from the policy vocabulary in
 * `packages/policy-engine/src/types.ts`, which deliberately separates them from the ones that only
 * *say* something: `allow`, `log_only` and `warn`.
 */
const TEXT_ALTERING_ACTIONS = new Set<ScanResult["action"]>([
  "redact",
  "rewrite",
  "block",
  "require_approval",
  "require_justification",
]);

/**
 * v0.2.2 — may the sanitized variant be written into the composer in place of what the user pasted?
 *
 * The paste path substituted `safeFragmentText(result)` for *any* result with a finding, whatever
 * the action was. Measured against the shipped default policy, that turned two ordinary developer
 * pastes into altered text plus a full-screen modal:
 *
 *   - `curl http://10.4.12.9:8080/health returns nothing` → action `warn`, risk 15, and the composer
 *     received `curl http://[REDACTED_INTERNAL_IP]:8080/health`.
 *   - `git@github.com:acme-internal/billing-service.git` → action `warn`, risk 12, and the composer
 *     received `[REDACTED_EMAIL]:acme-internal/...` (the SSH remote matches the email detector).
 *
 * In both cases the policy's own verdict was "warn" — tell them — and the extension instead rewrote
 * their words, which then also tripped `interruptionLevel`'s alteration rule and took over the page.
 * Redacting is what `redact` and `rewrite` mean; `warn` and `log_only` mean the text goes through and
 * the user is told. Enforcing *more* than the policy says is as dishonest as enforcing less, and it
 * is the version the user feels as their work being damaged.
 *
 * Nothing is given up by this. Every action that withholds a submission still substitutes, so a
 * secret is never written back into the page, and the submit path re-scans the whole composer before
 * anything leaves the browser — so a fragment kept here is still judged, in full context, by the
 * same kernel, at the moment it would actually be sent.
 */
export function shouldSanitizeFragment(result: ScanResult): boolean {
  return TEXT_ALTERING_ACTIONS.has(result.action);
}

/**
 * What an emergency lockdown *actually* restricts, in the same words the UI shows.
 *
 * Every surface used to key its badge off `emergencyLockdown.enabled` alone, so a lockdown
 * with every switch explicitly `false` and both lists empty still displayed "Emergency
 * lockdown active" while `emergencyLockdownAction()` returned `null` on every scan. That is
 * the one claim this product cannot afford to get wrong, so the badge is now derived from the
 * same fields the gate reads: an empty list here means nothing is being enforced, and the UI
 * says exactly that instead of reassuring the user.
 */
export function lockdownRestrictions(state: ExtensionState): string[] {
  const lockdown = state.policy?.emergencyLockdown;
  if (!lockdown?.enabled) return [];
  const restrictions: string[] = [];
  if (lockdown.allowOnlyEnterpriseDestinations !== false) restrictions.push("Non-enterprise AI destinations blocked");
  if (lockdown.blockAllFileUploads !== false) restrictions.push("All file uploads blocked");
  const blocked = Array.isArray(lockdown.blockedDataTypes) ? lockdown.blockedDataTypes : [];
  if (blocked.length) restrictions.push(`Blocked data types: ${blocked.join(", ")}`);
  const approval = Array.isArray(lockdown.requireApprovalDataTypes) ? lockdown.requireApprovalDataTypes : [];
  if (approval.length) restrictions.push(`Approval required for: ${approval.join(", ")}`);
  return restrictions;
}

/** `true` only when the lockdown flag is set *and* at least one restriction is in force. */
export function isLockdownEnforcing(state: ExtensionState): boolean {
  return lockdownRestrictions(state).length > 0;
}

/**
 * Response scanning as the *content script* actually decides it — the single source of truth
 * the popup and the side panel both read, so the two surfaces cannot disagree with the runtime.
 *
 * `content/index.ts` installs both observers on `responseScanningEnabled !== false`, i.e. it is
 * ON unless a matched destination explicitly turns it off, and ON when no destination entry
 * matched at all. Both UIs instead asked `destinations.some(d => d.enabled && d.responseScanningEnabled)`,
 * which is `false` for an empty destination list — exactly what the trial policy ships. So a
 * trial user was told "Response Scanning: Disabled" while every AI reply on the page was in
 * fact being scanned. Under-claiming is still a false claim: it teaches the user to distrust
 * the panel, and it hides a feature they are paying for.
 */
export function responseScanningStatus(state: ExtensionState): { enabled: boolean; label: string } {
  const destinations = state.policy?.destinations ?? [];
  const live = destinations.filter((destination) => destination.enabled !== false);
  if (live.length === 0) {
    // No per-destination override exists, so the runtime default stands.
    return { enabled: true, label: "On (default for guarded sites)" };
  }
  const on = live.filter((destination) => destination.responseScanningEnabled !== false);
  if (on.length === live.length) return { enabled: true, label: "On for all configured destinations" };
  if (on.length === 0) return { enabled: false, label: "Off — disabled for every configured destination" };
  return { enabled: true, label: `On for ${on.length} of ${live.length} configured destinations` };
}

export function eventName(eventType: ScanEventType) {
  return eventType === "submit" ? "submit" : eventType;
}

function detectCustomPolicyMatches(text: string, policy: ExtensionState["policy"]) {
  const custom = policy as typeof policy & { customDetectors?: { keywords?: string[]; regex?: string[]; documentFingerprints?: string[] } };
  const matches: string[] = [];
  const normalized = text.toLowerCase();
  if (custom?.customDetectors?.keywords?.some((keyword) => keyword && normalized.includes(keyword.toLowerCase()))) matches.push("custom_keyword");
  for (const pattern of custom?.customDetectors?.regex ?? []) {
    try {
      if (new RegExp(pattern, "i").test(text)) {
        matches.push("custom_regex");
        break;
      }
    } catch {
      continue;
    }
  }
  return matches;
}
