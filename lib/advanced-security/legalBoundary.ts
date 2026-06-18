// Agent Legal Boundary Guard — pure decision logic (no DB, no auth).
// Prevents computer-use / browser agents from crossing legal, compliance, or
// user-consent boundaries. This is NOT legal advice: it is risk control and
// consent enforcement. Reuses the shared guard analyzer for injection/PII.

import { analyzeText } from "@/lib/guard/analyze";

export type LegalActionCategory =
  | "READ_ONLY" | "LOGIN" | "FORM_SUBMIT" | "MESSAGE_SEND" | "PURCHASE" | "PAYMENT"
  | "BOOKING" | "SCRAPING" | "ACCOUNT_CHANGE" | "TERMS_ACCEPTANCE" | "DATA_UPLOAD" | "UNKNOWN";
export type LegalDecision = "ALLOW" | "BLOCK" | "ASK_APPROVAL" | "TAKEOVER_REQUIRED" | "REVIEW";
export type LegalRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface LegalBoundaryPolicy {
  blockedDomains?: string[];
  takeoverDomains?: string[];
  approvalActions?: LegalActionCategory[];
  paymentAlwaysTakeover?: boolean;
  termsAlwaysTakeover?: boolean;
  loginAlwaysTakeover?: boolean;
  scrapingLimit?: number;
  blockDataUploadToUnknown?: boolean;
}

export interface LegalBoundaryInput {
  agentName?: string;
  websiteUrl?: string;
  domain?: string;
  action?: string;
  actionCategory: LegalActionCategory;
  content?: string;
  userConsentProvided?: boolean;
  metadata?: {
    loggedIn?: boolean;
    paymentInvolved?: boolean;
    personalDataInvolved?: boolean;
    termsAcceptance?: boolean;
    domainTrusted?: boolean;
    bypassDetected?: boolean;
    scrapeCount?: number;
  };
  policy?: LegalBoundaryPolicy;
}

export interface LegalBoundaryResult {
  decision: LegalDecision;
  riskLevel: LegalRiskLevel;
  reason: string;
  requiredUserMessage: string;
  evidence: string[];
}

function normalizeDomain(domain?: string): string {
  return (domain ?? "").trim().toLowerCase().replace(/^www\./, "");
}

function domainMatches(domain: string, list?: string[]): boolean {
  if (!list || list.length === 0) return false;
  const target = normalizeDomain(domain);
  return list.some((entry) => {
    const e = normalizeDomain(entry);
    return target === e || target.endsWith(`.${e}`);
  });
}

const CREDENTIAL_PATTERN = /password|otp|one.?time|cvv|card number|pin\b|2fa|verification code/i;
const BYPASS_PATTERN = /bypass|paywall|captcha|circumvent|defeat (the )?login|skip (the )?login|without (logging in|credentials)|access control/i;

export function checkLegalBoundary(input: LegalBoundaryInput): LegalBoundaryResult {
  const meta = input.metadata ?? {};
  const policy = input.policy ?? {};
  const domain = normalizeDomain(input.domain);
  const evidence: string[] = [];
  const guard = analyzeText(`${input.action ?? ""} ${input.content ?? ""}`, "INPUT");
  const credentialEntry = CREDENTIAL_PATTERN.test(`${input.action ?? ""} ${input.content ?? ""}`);
  const bypass = Boolean(meta.bypassDetected) || BYPASS_PATTERN.test(`${input.action ?? ""} ${input.content ?? ""}`);
  const personalData = Boolean(meta.personalDataInvolved) || guard.riskTypes.includes("PII_DETECTED") || guard.riskTypes.includes("INDIA_PII_DETECTED");
  const domainTrusted = Boolean(meta.domainTrusted);

  const build = (decision: LegalDecision, riskLevel: LegalRiskLevel, reason: string, userMessage: string): LegalBoundaryResult =>
    ({ decision, riskLevel, reason, requiredUserMessage: userMessage, evidence });

  // 1. Explicit blocked domain.
  if (domainMatches(domain, policy.blockedDomains)) {
    evidence.push("domain_blocked_by_policy");
    return build("BLOCK", "CRITICAL", `Automation is blocked on ${domain} by project policy.`, "This site is blocked for automation.");
  }

  // 2. Bypassing access controls / paywall / login.
  if (bypass) {
    evidence.push("access_control_bypass");
    return build("BLOCK", "CRITICAL", "Attempt to bypass login, paywall, or an access control is not allowed.", "I can't bypass access controls or logins.");
  }

  // 3. Credential / OTP / password entry → human takeover.
  if (credentialEntry) {
    evidence.push("credential_entry");
    return build("TAKEOVER_REQUIRED", "CRITICAL", "Password, OTP, or payment-credential entry requires human takeover.", "Please enter your password/OTP yourself — I won't handle credentials.");
  }

  // 4. Payment / purchase / checkout.
  if (input.actionCategory === "PAYMENT" || input.actionCategory === "PURCHASE" || meta.paymentInvolved) {
    const decision: LegalDecision = policy.paymentAlwaysTakeover === false ? "ASK_APPROVAL" : "TAKEOVER_REQUIRED";
    evidence.push("payment_action");
    return build(decision, "HIGH", "A payment or purchase requires explicit human authorization.", "Please confirm and complete the payment yourself.");
  }

  // 5. Terms / privacy / legal acceptance.
  if (input.actionCategory === "TERMS_ACCEPTANCE" || meta.termsAcceptance) {
    const decision: LegalDecision = policy.termsAlwaysTakeover === false ? "ASK_APPROVAL" : "TAKEOVER_REQUIRED";
    evidence.push("terms_acceptance");
    return build(decision, "HIGH", "Accepting terms or legal agreements requires a human decision.", "Please review and accept the terms yourself.");
  }

  // 6. Login without explicit user consent.
  if (input.actionCategory === "LOGIN") {
    if (input.userConsentProvided && policy.loginAlwaysTakeover === false) {
      evidence.push("login_consented");
      return build("ASK_APPROVAL", "MEDIUM", "Login with prior user consent still requires approval.", "Confirm you want me to sign in.");
    }
    evidence.push("login_without_consent");
    return build("TAKEOVER_REQUIRED", "HIGH", "Logging in requires explicit user involvement.", "Please sign in yourself.");
  }

  // 7. Submitting personal data to an unknown domain.
  if ((input.actionCategory === "DATA_UPLOAD" || input.actionCategory === "FORM_SUBMIT") && personalData && !domainTrusted) {
    const decision: LegalDecision = policy.blockDataUploadToUnknown ? "BLOCK" : "ASK_APPROVAL";
    evidence.push("personal_data_to_unknown_domain");
    return build(decision, "HIGH", "Submitting personal data to an untrusted/unknown domain requires approval.", "Confirm before I share personal data with this site.");
  }

  // 8. Account settings change.
  if (input.actionCategory === "ACCOUNT_CHANGE") {
    evidence.push("account_change");
    return build(meta.loggedIn ? "ASK_APPROVAL" : "TAKEOVER_REQUIRED", "HIGH", "Changing account settings requires user authorization.", "Confirm this account change.");
  }

  // 9. Booking / cancellation / refund.
  if (input.actionCategory === "BOOKING") {
    evidence.push("booking_action");
    return build("ASK_APPROVAL", "MEDIUM", "Bookings, cancellations, or refunds require approval.", "Confirm this booking action.");
  }

  // 10. Sending a message / email / post.
  if (input.actionCategory === "MESSAGE_SEND") {
    evidence.push("message_send");
    return build("ASK_APPROVAL", "MEDIUM", "Sending a message, email, or post requires approval.", "Confirm before I send this message.");
  }

  // 11. Scraping (volume-aware).
  if (input.actionCategory === "SCRAPING") {
    const limit = policy.scrapingLimit ?? 100;
    const count = meta.scrapeCount ?? 0;
    evidence.push("scraping");
    if (count > limit) return build("BLOCK", "HIGH", `Scraping volume (${count}) exceeds the policy limit (${limit}).`, "Scraping at this scale is blocked.");
    return build("REVIEW", "MEDIUM", "Scraping should be reviewed for terms-of-service compliance.", "Scraping flagged for review.");
  }

  // 12. Generic form submit (non-PII) → approval.
  if (input.actionCategory === "FORM_SUBMIT") {
    evidence.push("form_submit");
    return build("ASK_APPROVAL", "MEDIUM", "Submitting a form requires approval.", "Confirm before I submit this form.");
  }

  // 13. Read-only public page → allow.
  if (input.actionCategory === "READ_ONLY") {
    evidence.push("read_only");
    return build("ALLOW", "LOW", "Read-only access to a public page is allowed.", "");
  }

  // 14. Unknown → review.
  evidence.push("unknown_action");
  return build("REVIEW", "MEDIUM", "Action category is unknown; hold for review.", "This action needs review.");
}
