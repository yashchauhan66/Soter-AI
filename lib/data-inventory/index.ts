/**
 * Data Inventory — Records of Processing Activities (GDPR Art. 30 / DPDP § 11)
 *
 * This module provides a structured, machine-readable catalog of every data
 * category that SoterAI processes, stored, or transmits. It serves as the
 * authoritative source of truth for:
 *
 *  - Privacy impact assessments
 *  - Data-subject request (DSR) fulfilment scoping
 *  - Vendor security questionnaires
 *  - Internal compliance audits
 *  - SOC 2 / ISO 27001 / DPDP evidence collection
 *
 * This is NOT legal advice and does not independently satisfy GDPR Article 30
 * or DPDP Section 11 requirements. Consult your legal counsel.
 *
 * ── How to maintain ──
 *
 * 1. When a new data category is introduced (new DB column, new event type,
 *    new log field, new API parameter), add an entry to DATA_CATEGORIES.
 * 2. Run `validateDataInventory()` in CI or a pre-commit hook to catch stale
 *    or undocumented categories.
 * 3. At least quarterly, review each entry's `retention`, `purpose`, and
 *    `legalBasis` for continued accuracy.
 */

// ═════════════════════════════════════════════════════════════════════════════
// Types
// ═════════════════════════════════════════════════════════════════════════════

export type DataCategoryId = string;

export type DataClassification =
  | "PUBLIC"
  | "INTERNAL"
  | "CONFIDENTIAL"
  | "RESTRICTED"
  | "PII"
  | "FINANCIAL"
  | "HEALTH"
  | "CREDENTIAL";

export type DataRetention = {
  defaultDays: number;
  maxDays: number;
  configurable: boolean;
};

export type LegalBasis =
  | "CONTRACT_NECESSARY"       // Processing required for service delivery (GDPR Art. 6(1)(b))
  | "LEGITIMATE_INTEREST"      // Security monitoring, fraud prevention (GDPR Art. 6(1)(f))
  | "CONSENT"                  // Optional processing with opt-in (GDPR Art. 6(1)(a))
  | "LEGAL_OBLIGATION"         // Tax records, legal holds (GDPR Art. 6(1)(c))
  | "NOT_APPLICABLE";          // Not personal data

export type ProcessingLocation =
  | "POSTGRESQL"               // Primary database (prisma/schema.prisma)
  | "REDIS"                    // Cache / rate-limit counters
  | "DYNAMODB"                 // Event-store archive
  | "FILESYSTEM"               // PDF exports, uploaded files
  | "IN_MEMORY"                // Never persisted; held only during a request
  | "ENCRYPTED_STORE";         // Credential vault / encrypted column

export type ProcessingRole =
  | "CONTROLLER"               // SoterAI determines purpose and means
  | "PROCESSOR"                // SoterAI processes on behalf of customer
  | "BOTH";                    // Mixed role depending on context

export interface DataCategory {
  /** Unique stable identifier (e.g. "user.email", "guard.originalText") */
  id: DataCategoryId;

  /** Human-readable category name */
  name: string;

  /** What this data is used for */
  purpose: string;

  /** Where the data physically resides */
  location: ProcessingLocation[];

  /** DB model / table / collection name */
  storageTable: string;

  /** Retention policy */
  retention: DataRetention;

  /** Data sensitivity classification */
  classification: DataClassification;

  /** Whether this field can contain personal data (GDPR Art. 4(1)) */
  isPersonalData: boolean;

  /** Legal basis for processing */
  legalBasis: LegalBasis;

  /** Whether the data is user-controlled (deletable / exportable via DSR) */
  isUserControllable: boolean;

  /** Whether this category is persisted at rest (as opposed to ephemeral) */
  persisted: boolean;

  /** Which role SoterAI acts as */
  processingRole: ProcessingRole;

  /** Notes for auditors and privacy assessments */
  notes: string;
}

// ═════════════════════════════════════════════════════════════════════════════
// Registry
// ═════════════════════════════════════════════════════════════════════════════

export const DATA_CATEGORIES: DataCategory[] = [
  // ── Account & Identity ──────────────────────────────────────────────────
  {
    id: "user.email",
    name: "User email address",
    purpose: "Account identification, login, password reset, email notifications, SSO/JIT provisioning.",
    location: ["POSTGRESQL"],
    storageTable: "User",
    retention: { defaultDays: 365, maxDays: 365 * 5, configurable: false },
    classification: "PII",
    isPersonalData: true,
    legalBasis: "CONTRACT_NECESSARY",
    isUserControllable: true,
    persisted: true,
    processingRole: "CONTROLLER",
    notes: "Hashed in audit logs. Raw value stored only in User table. Exportable via DSR.",
  },
  {
    id: "user.name",
    name: "User display name",
    purpose: "Dashboard personalisation, team collaboration, email salutation.",
    location: ["POSTGRESQL"],
    storageTable: "User",
    retention: { defaultDays: 365, maxDays: 365 * 5, configurable: false },
    classification: "PII",
    isPersonalData: true,
    legalBasis: "CONTRACT_NECESSARY",
    isUserControllable: true,
    persisted: true,
    processingRole: "CONTROLLER",
    notes: "Optional field. Exportable via DSR.",
  },
  {
    id: "user.passwordHash",
    name: "Hashed password",
    purpose: "Password-based authentication. Never stored as plaintext — bcrypt hash only.",
    location: ["POSTGRESQL"],
    storageTable: "User",
    retention: { defaultDays: 365, maxDays: 365 * 5, configurable: false },
    classification: "CREDENTIAL",
    isPersonalData: false,
    legalBasis: "CONTRACT_NECESSARY",
    isUserControllable: true,
    persisted: true,
    processingRole: "CONTROLLER",
    notes: "bcrypt cost-12 hash. Never raw. Password hash changes on reset.",
  },
  {
    id: "user.passwordChangedAt",
    name: "Last password-change timestamp",
    purpose: "Session invalidation after password change (security control).",
    location: ["POSTGRESQL"],
    storageTable: "User",
    retention: { defaultDays: 365, maxDays: 365 * 5, configurable: false },
    classification: "INTERNAL",
    isPersonalData: false,
    legalBasis: "LEGITIMATE_INTEREST",
    isUserControllable: false,
    persisted: true,
    processingRole: "CONTROLLER",
    notes: "Used for zombie-session protection.",
  },
  {
    id: "user.ssoOnly",
    name: "SSO-only flag",
    purpose: "Indicates user was provisioned via SAML/OIDC SSO. Disables password login.",
    location: ["POSTGRESQL"],
    storageTable: "User",
    retention: { defaultDays: 365, maxDays: 365 * 5, configurable: false },
    classification: "INTERNAL",
    isPersonalData: false,
    legalBasis: "CONTRACT_NECESSARY",
    isUserControllable: false,
    persisted: true,
    processingRole: "CONTROLLER",
    notes: "Set during JIT provisioning or SAML attribute mapping.",
  },
  {
    id: "user.jitProvisionedFrom",
    name: "JIT provisioning source (IdP name)",
    purpose: "Audit trail for Just-In-Time user provisioning via SSO.",
    location: ["POSTGRESQL"],
    storageTable: "User",
    retention: { defaultDays: 365, maxDays: 365 * 5, configurable: false },
    classification: "INTERNAL",
    isPersonalData: false,
    legalBasis: "LEGITIMATE_INTEREST",
    isUserControllable: false,
    persisted: true,
    processingRole: "CONTROLLER",
    notes: "Contains IdP display name, not credentials.",
  },

  // ── Organization & Membership ───────────────────────────────────────────
  {
    id: "organization.name",
    name: "Organization name",
    purpose: "Account identification, billing, team management.",
    location: ["POSTGRESQL"],
    storageTable: "Organization",
    retention: { defaultDays: 365 * 5, maxDays: 365 * 5, configurable: false },
    classification: "INTERNAL",
    isPersonalData: false,
    legalBasis: "CONTRACT_NECESSARY",
    isUserControllable: true,
    persisted: true,
    processingRole: "CONTROLLER",
    notes: "Enterprise customers may consider their org name confidential.",
  },
  {
    id: "organization.contactEmail",
    name: "Organization billing / contact email",
    purpose: "Invoice delivery, critical product notifications, security alerts.",
    location: ["POSTGRESQL"],
    storageTable: "Organization",
    retention: { defaultDays: 365 * 5, maxDays: 365 * 5, configurable: false },
    classification: "PII",
    isPersonalData: true,
    legalBasis: "CONTRACT_NECESSARY",
    isUserControllable: true,
    persisted: true,
    processingRole: "CONTROLLER",
    notes: "May be a group alias (security@). Exportable via DSR.",
  },
  {
    id: "membership.role",
    name: "Organization membership role",
    purpose: "RBAC enforcement — determines what actions a user can perform.",
    location: ["POSTGRESQL"],
    storageTable: "OrganizationMember",
    retention: { defaultDays: 365 * 5, maxDays: 365 * 5, configurable: false },
    classification: "INTERNAL",
    isPersonalData: false,
    legalBasis: "CONTRACT_NECESSARY",
    isUserControllable: false,
    persisted: true,
    processingRole: "CONTROLLER",
    notes: "Stored in OrganizationMember table with org and user FK.",
  },

  // ── API Keys & Authentication ───────────────────────────────────────────
  {
    id: "apikey.keyHash",
    name: "API key hash (SHA-256)",
    purpose: "API authentication — key is hashed at rest; only the prefix is stored in plaintext.",
    location: ["POSTGRESQL"],
    storageTable: "ApiKey",
    retention: { defaultDays: 365 * 2, maxDays: 365 * 2, configurable: false },
    classification: "CREDENTIAL",
    isPersonalData: false,
    legalBasis: "CONTRACT_NECESSARY",
    isUserControllable: true,
    persisted: true,
    processingRole: "CONTROLLER",
    notes: "SHA-256 hash of the full API key. Raw key is shown once at creation, then never stored.",
  },
  {
    id: "apikey.prefix",
    name: "API key prefix (first 8 chars)",
    purpose: "Key identification in UI — allows users to identify which key made a request.",
    location: ["POSTGRESQL"],
    storageTable: "ApiKey",
    retention: { defaultDays: 365 * 2, maxDays: 365 * 2, configurable: false },
    classification: "INTERNAL",
    isPersonalData: false,
    legalBasis: "CONTRACT_NECESSARY",
    isUserControllable: true,
    persisted: true,
    processingRole: "CONTROLLER",
    notes: "Only the prefix (sot_xxx…) is stored. Insufficient to reconstruct the full key.",
  },

  // ── Guard Logs (most critical for privacy assessment) ──────────────────
  {
    id: "guard.originalText",
    name: "Original input/output text (pre-redaction)",
    purpose: "Security decision audit trail — only stored when no sensitive content is detected. Redacted or null otherwise.",
    location: ["POSTGRESQL"],
    storageTable: "GuardLog",
    retention: { defaultDays: 90, maxDays: 365, configurable: true },
    classification: "RESTRICTED",
    isPersonalData: true,
    legalBasis: "LEGITIMATE_INTEREST",
    isUserControllable: true,
    persisted: true,
    processingRole: "PROCESSOR",
    notes: "Stored as null when confidential risk types (SECRET_DETECTED, PII_DETECTED, etc.) are present. Configurable retention via RetentionPolicy. DSR-exportable.",
  },
  {
    id: "guard.redactedText",
    name: "Redacted text (PII/secrets removed)",
    purpose: "Security decision audit trail with sensitive data removed.",
    location: ["POSTGRESQL"],
    storageTable: "GuardLog",
    retention: { defaultDays: 90, maxDays: 365, configurable: true },
    classification: "RESTRICTED",
    isPersonalData: true,
    legalBasis: "LEGITIMATE_INTEREST",
    isUserControllable: true,
    persisted: true,
    processingRole: "PROCESSOR",
    notes: "Safe to retain longer since raw PII/secrets are redacted. Configurable retention.",
  },
  {
    id: "guard.safeText",
    name: "Safe text (post-redaction/replacement)",
    purpose: "Stores the sanitized version returned to the caller after redaction.",
    location: ["POSTGRESQL"],
    storageTable: "GuardLog",
    retention: { defaultDays: 90, maxDays: 365, configurable: true },
    classification: "INTERNAL",
    isPersonalData: false,
    legalBasis: "LEGITIMATE_INTEREST",
    isUserControllable: true,
    persisted: true,
    processingRole: "PROCESSOR",
    notes: "Contains only non-sensitive content after redaction.",
  },
  {
    id: "guard.riskTypes",
    name: "Detected risk-type labels",
    purpose: "Aggregate security analytics, trend reporting, threat intelligence.",
    location: ["POSTGRESQL"],
    storageTable: "GuardLog",
    retention: { defaultDays: 90, maxDays: 365, configurable: true },
    classification: "INTERNAL",
    isPersonalData: false,
    legalBasis: "LEGITIMATE_INTEREST",
    isUserControllable: false,
    persisted: true,
    processingRole: "PROCESSOR",
    notes: "String array of risk-type identifiers (PROMPT_INJECTION, PII_DETECTED, etc.). No raw data.",
  },
  {
    id: "guard.riskScore",
    name: "Aggregate risk score (0–100)",
    purpose: "Policy enforcement threshold comparison, trend analysis.",
    location: ["POSTGRESQL"],
    storageTable: "GuardLog",
    retention: { defaultDays: 90, maxDays: 365, configurable: true },
    classification: "PUBLIC",
    isPersonalData: false,
    legalBasis: "LEGITIMATE_INTEREST",
    isUserControllable: false,
    persisted: true,
    processingRole: "PROCESSOR",
    notes: "Integer score. No personal data.",
  },
  {
    id: "guard.metadata",
    name: "Guard request metadata",
    purpose: "Request context (SDK version, user ID, session ID) for audit and debugging.",
    location: ["POSTGRESQL"],
    storageTable: "GuardLog",
    retention: { defaultDays: 90, maxDays: 365, configurable: true },
    classification: "INTERNAL",
    isPersonalData: false,
    legalBasis: "LEGITIMATE_INTEREST",
    isUserControllable: false,
    persisted: true,
    processingRole: "PROCESSOR",
    notes: "Sanitized via sanitizeMetadata() before storage — PII/secret keys are stripped.",
  },

  // ── Webhook System ──────────────────────────────────────────────────────
  {
    id: "webhook.deliveryPayload",
    name: "Webhook payload (sender side)",
    purpose: "Event delivery to customer-configured endpoints. Payload preview stored for debugging.",
    location: ["POSTGRESQL"],
    storageTable: "WebhookDelivery",
    retention: { defaultDays: 30, maxDays: 90, configurable: true },
    classification: "RESTRICTED",
    isPersonalData: true,
    legalBasis: "CONTRACT_NECESSARY",
    isUserControllable: true,
    persisted: true,
    processingRole: "PROCESSOR",
    notes: "Payload hash for integrity verification. Preview stored as redacted JSON. Configurable retention.",
  },
  {
    id: "webhook.idempotencyKey",
    name: "Webhook idempotency key",
    purpose: "Ensures at-most-once delivery semantics.",
    location: ["POSTGRESQL"],
    storageTable: "WebhookDelivery",
    retention: { defaultDays: 30, maxDays: 90, configurable: true },
    classification: "PUBLIC",
    isPersonalData: false,
    legalBasis: "CONTRACT_NECESSARY",
    isUserControllable: false,
    persisted: true,
    processingRole: "PROCESSOR",
    notes: "UUID string. No personal data.",
  },

  // ── RAG Documents ────────────────────────────────────────────────────────
  {
    id: "rag.documentFileName",
    name: "Uploaded document file name",
    purpose: "Document identification in collection browser.",
    location: ["POSTGRESQL"],
    storageTable: "RagDocument",
    retention: { defaultDays: 365, maxDays: 365 * 2, configurable: true },
    classification: "INTERNAL",
    isPersonalData: false,
    legalBasis: "CONTRACT_NECESSARY",
    isUserControllable: true,
    persisted: true,
    processingRole: "PROCESSOR",
    notes: "Original file name. May contain contextual hints about content.",
  },
  {
    id: "rag.documentHash",
    name: "Document content hash (SHA-256)",
    purpose: "Deduplication, integrity verification, version tracking.",
    location: ["POSTGRESQL"],
    storageTable: "RagDocument",
    retention: { defaultDays: 365, maxDays: 365 * 2, configurable: true },
    classification: "INTERNAL",
    isPersonalData: false,
    legalBasis: "CONTRACT_NECESSARY",
    isUserControllable: true,
    persisted: true,
    processingRole: "PROCESSOR",
    notes: "SHA-256 hash. One-way; content cannot be reconstructed from hash.",
  },
  {
    id: "rag.chunkTextRedacted",
    name: "RAG chunk text (redacted)",
    purpose: "Retrieval content that has been scanned and redacted for safety.",
    location: ["POSTGRESQL"],
    storageTable: "RagChunk",
    retention: { defaultDays: 365, maxDays: 365 * 2, configurable: true },
    classification: "RESTRICTED",
    isPersonalData: true,
    legalBasis: "CONTRACT_NECESSARY",
    isUserControllable: true,
    persisted: true,
    processingRole: "PROCESSOR",
    notes: "PII/secrets are redacted before chunk storage. Original raw text is not stored.",
  },

  // ── Security Events & Incidents ──────────────────────────────────────────
  {
    id: "securityEvent.metadata",
    name: "Security event metadata",
    purpose: "SIEM export, incident investigation, threat correlation.",
    location: ["POSTGRESQL", "DYNAMODB"],
    storageTable: "SecurityEvent",
    retention: { defaultDays: 90, maxDays: 365, configurable: true },
    classification: "RESTRICTED",
    isPersonalData: true,
    legalBasis: "LEGITIMATE_INTEREST",
    isUserControllable: false,
    persisted: true,
    processingRole: "PROCESSOR",
    notes: "Metadata is sanitized via minimizeEventMetadata() before storage. Configurable retention.",
  },
  {
    id: "incident.description",
    name: "Incident description and evidence",
    purpose: "Incident tracking, root-cause analysis, forensic investigation.",
    location: ["POSTGRESQL"],
    storageTable: "Incident",
    retention: { defaultDays: 365, maxDays: 365 * 3, configurable: true },
    classification: "RESTRICTED",
    isPersonalData: true,
    legalBasis: "LEGITIMATE_INTEREST",
    isUserControllable: false,
    persisted: true,
    processingRole: "PROCESSOR",
    notes: "Redacted via sanitizeLogText() before storage. Configurable retention.",
  },

  // ── Billing & Payments ───────────────────────────────────────────────────
  {
    id: "billing.razorpayCustomerId",
    name: "Razorpay customer ID",
    purpose: "Payment processing, subscription management, invoice generation.",
    location: ["POSTGRESQL"],
    storageTable: "Subscription",
    retention: { defaultDays: 365 * 7, maxDays: 365 * 7, configurable: false },
    classification: "FINANCIAL",
    isPersonalData: false,
    legalBasis: "CONTRACT_NECESSARY",
    isUserControllable: false,
    persisted: true,
    processingRole: "PROCESSOR",
    notes: "Razorpay-issued identifier. SoterAI never stores raw payment card data (PCI-DSS out of scope).",
  },
  {
    id: "billing.invoiceAmount",
    name: "Invoice amount and currency",
    purpose: "Billing records, tax compliance, financial reporting.",
    location: ["POSTGRESQL"],
    storageTable: "Invoice",
    retention: { defaultDays: 365 * 7, maxDays: 365 * 7, configurable: false },
    classification: "FINANCIAL",
    isPersonalData: false,
    legalBasis: "LEGAL_OBLIGATION",
    isUserControllable: false,
    persisted: true,
    processingRole: "CONTROLLER",
    notes: "Required for tax and accounting compliance. Retained per statutory requirements.",
  },
  {
    id: "billing.paymentEvent",
    name: "Raw payment webhook event payload",
    purpose: "Payment verification, fraud detection, reconciliation.",
    location: ["POSTGRESQL"],
    storageTable: "PaymentEvent",
    retention: { defaultDays: 180, maxDays: 365, configurable: false },
    classification: "FINANCIAL",
    isPersonalData: false,
    legalBasis: "LEGAL_OBLIGATION",
    isUserControllable: false,
    persisted: true,
    processingRole: "PROCESSOR",
    notes: "Razorpay webhook payload stored with signature verification proof.",
  },

  // ── SAML / SSO ───────────────────────────────────────────────────────────
  {
    id: "saml.responseId",
    name: "SAML assertion response ID",
    purpose: "Replay-attack prevention (stored in memory map with TTL).",
    location: ["IN_MEMORY"],
    storageTable: "(in-memory Map)",
    retention: { defaultDays: 1, maxDays: 1, configurable: false },
    classification: "INTERNAL",
    isPersonalData: false,
    legalBasis: "LEGITIMATE_INTEREST",
    isUserControllable: false,
    persisted: false,
    processingRole: "CONTROLLER",
    notes: "In-memory only, never persisted to disk. 24h TTL with periodic cleanup.",
  },
  {
    id: "saml.idpMetadataXml",
    name: "SAML IdP metadata XML",
    purpose: "SAML SSO configuration — contains IdP certificate and endpoints.",
    location: ["POSTGRESQL", "ENCRYPTED_STORE"],
    storageTable: "SamlProvider",
    retention: { defaultDays: 365 * 5, maxDays: 365 * 5, configurable: false },
    classification: "CONFIDENTIAL",
    isPersonalData: false,
    legalBasis: "CONTRACT_NECESSARY",
    isUserControllable: false,
    persisted: true,
    processingRole: "PROCESSOR",
    notes: "Contains IdP X.509 certificate. Stored encrypted at rest.",
  },

  // ── Evidence Vault ──────────────────────────────────────────────────────
  {
    id: "evidence.snapshotContent",
    name: "Evidence vault snapshot (redacted)",
    purpose: "SOC 2 / ISO 27001 / DPDP audit evidence collection.",
    location: ["POSTGRESQL"],
    storageTable: "ComplianceEvidence",
    retention: { defaultDays: 365 * 3, maxDays: 365 * 3, configurable: true },
    classification: "RESTRICTED",
    isPersonalData: true,
    legalBasis: "LEGITIMATE_INTEREST",
    isUserControllable: false,
    persisted: true,
    processingRole: "PROCESSOR",
    notes: "Sanitized via sanitizeLogText() before storage. Aggregated, not raw.",
  },

  // ── Credential Vault ─────────────────────────────────────────────────────
  {
    id: "vault.encryptedSecret",
    name: "Encrypted credential value",
    purpose: "Secure storage of API keys, database URLs, and other secrets.",
    location: ["POSTGRESQL", "ENCRYPTED_STORE"],
    storageTable: "Credential",
    retention: { defaultDays: 365 * 2, maxDays: 365 * 2, configurable: true },
    classification: "CREDENTIAL",
    isPersonalData: false,
    legalBasis: "CONTRACT_NECESSARY",
    isUserControllable: true,
    persisted: true,
    processingRole: "PROCESSOR",
    notes: "AES-256-GCM encrypted at rest. Decrypted only in-memory during access. Raw value never logged.",
  },

  // ── Session Data (ephemeral) ─────────────────────────────────────────────
  {
    id: "session.jwtToken",
    name: "Session JWT token (NextAuth)",
    purpose: "Session authentication, CSRF protection.",
    location: ["IN_MEMORY"],
    storageTable: "UserSession",
    retention: { defaultDays: 1, maxDays: 1, configurable: false },
    classification: "CREDENTIAL",
    isPersonalData: false,
    legalBasis: "CONTRACT_NECESSARY",
    isUserControllable: false,
    persisted: true,
    processingRole: "CONTROLLER",
    notes: "JWT with 24h expiry. Zombie-session revalidation at 1-in-60 rate.",
  },
  {
    id: "session.samlExchange",
    name: "SAML session exchange record",
    purpose: "SAML-to-session mapping for SSO login flow.",
    location: ["POSTGRESQL"],
    storageTable: "SamlSessionExchange",
    retention: { defaultDays: 1, maxDays: 7, configurable: false },
    classification: "INTERNAL",
    isPersonalData: false,
    legalBasis: "CONTRACT_NECESSARY",
    isUserControllable: false,
    persisted: true,
    processingRole: "CONTROLLER",
    notes: "Short-lived record used only during SAML login flow. Auto-cleaned.",
  },

  // ── Audit Logs ───────────────────────────────────────────────────────────
  {
    id: "audit.organizationAction",
    name: "Organization audit-log entry",
    purpose: "Change tracking for org-level actions (policy changes, member changes, etc.).",
    location: ["POSTGRESQL"],
    storageTable: "OrganizationAuditLog",
    retention: { defaultDays: 365, maxDays: 365 * 2, configurable: true },
    classification: "INTERNAL",
    isPersonalData: false,
    legalBasis: "LEGITIMATE_INTEREST",
    isUserControllable: false,
    persisted: true,
    processingRole: "CONTROLLER",
    notes: "Contains actor userId, action, and sanitized metadata.",
  },
  {
    id: "audit.adminAction",
    name: "Admin audit-log entry",
    purpose: "SoterAI admin action tracking (plan changes, quota bumps, webhook replays).",
    location: ["POSTGRESQL"],
    storageTable: "AdminAuditLog",
    retention: { defaultDays: 365 * 3, maxDays: 365 * 3, configurable: true },
    classification: "CONFIDENTIAL",
    isPersonalData: false,
    legalBasis: "LEGITIMATE_INTEREST",
    isUserControllable: false,
    persisted: true,
    processingRole: "CONTROLLER",
    notes: "Admin actions always require a reason. Immutable audit trail.",
  },

  // ── Agent Security ───────────────────────────────────────────────────────
  {
    id: "agent.passportClaims",
    name: "Agent passport cryptographic identity",
    purpose: "Agent identity verification, action signing, permission scoping.",
    location: ["POSTGRESQL"],
    storageTable: "AgentSessionPassport",
    retention: { defaultDays: 90, maxDays: 365, configurable: true },
    classification: "INTERNAL",
    isPersonalData: false,
    legalBasis: "CONTRACT_NECESSARY",
    isUserControllable: false,
    persisted: true,
    processingRole: "PROCESSOR",
    notes: "Contains Ed25519 public key, scope claims, expiration. Not personal data.",
  },
  {
    id: "agent.actionLog",
    name: "Agent action log (redacted)",
    purpose: "Audit trail of every agent tool call and its security decision.",
    location: ["POSTGRESQL"],
    storageTable: "AgentActionLog",
    retention: { defaultDays: 90, maxDays: 365, configurable: true },
    classification: "RESTRICTED",
    isPersonalData: true,
    legalBasis: "LEGITIMATE_INTEREST",
    isUserControllable: false,
    persisted: true,
    processingRole: "PROCESSOR",
    notes: "Content is redacted via sanitizeLogText() before storage. Configurable retention.",
  },
  {
    id: "agent.escrowTransaction",
    name: "Escrow transaction (human-in-the-loop)",
    purpose: "Records pending, approved, or denied high-risk agent actions requiring human approval.",
    location: ["POSTGRESQL"],
    storageTable: "AgentEscrowTransaction",
    retention: { defaultDays: 365, maxDays: 365 * 2, configurable: true },
    classification: "RESTRICTED",
    isPersonalData: true,
    legalBasis: "CONTRACT_NECESSARY",
    isUserControllable: false,
    persisted: true,
    processingRole: "PROCESSOR",
    notes: "Contains redacted action context. Approved actions can be replayed for audit.",
  },

  // ── Product Telemetry (minimal, privacy-first) ──────────────────────────
  {
    id: "telemetry.productEvent",
    name: "Product event (anonymous usage signal)",
    purpose: "Feature adoption measurement, product improvement. No PII, no tracking IDs.",
    location: ["POSTGRESQL"],
    storageTable: "ProductEvent",
    retention: { defaultDays: 90, maxDays: 365, configurable: true },
    classification: "INTERNAL",
    isPersonalData: false,
    legalBasis: "CONSENT",
    isUserControllable: false,
    persisted: true,
    processingRole: "CONTROLLER",
    notes: "Anonymous event type + timestamp. No user ID, no IP, no session. Opt-out respected.",
  },
  {
    id: "telemetry.docsPageView",
    name: "Documentation page view (anonymous)",
    purpose: "Docs usage analytics — which pages are most viewed. No tracking.",
    location: ["REDIS"],
    storageTable: "(rate-limited Redis counter)",
    retention: { defaultDays: 1, maxDays: 7, configurable: false },
    classification: "PUBLIC",
    isPersonalData: false,
    legalBasis: "CONSENT",
    isUserControllable: false,
    persisted: false,
    processingRole: "CONTROLLER",
    notes: "Rate-limited, IP-anonymized page-slug counter. No cookies or persistent IDs.",
  },

  // ── SCIM Provisioning ────────────────────────────────────────────────────
  {
    id: "scim.tokenHash",
    name: "SCIM bearer token hash",
    purpose: "SCIM API authentication for identity provider sync.",
    location: ["POSTGRESQL"],
    storageTable: "ScimToken",
    retention: { defaultDays: 365 * 2, maxDays: 365 * 2, configurable: false },
    classification: "CREDENTIAL",
    isPersonalData: false,
    legalBasis: "CONTRACT_NECESSARY",
    isUserControllable: false,
    persisted: true,
    processingRole: "CONTROLLER",
    notes: "SHA-256 hash with pepper. Raw token shown once at creation.",
  },
  {
    id: "scim.userMapping",
    name: "SCIM user identifier mapping",
    purpose: "Maps IdP user IDs to SoterAI internal user IDs for SCIM sync.",
    location: ["POSTGRESQL"],
    storageTable: "ScimUserMapping",
    retention: { defaultDays: 365 * 2, maxDays: 365 * 2, configurable: false },
    classification: "INTERNAL",
    isPersonalData: false,
    legalBasis: "CONTRACT_NECESSARY",
    isUserControllable: false,
    persisted: true,
    processingRole: "CONTROLLER",
    notes: "Maps externalId (from IdP) to SoterAI userId. No raw personal data.",
  },

  // ── Usage Telemetry (Redis — ephemeral) ─────────────────────────────────
  {
    id: "telemetry.usageCounter",
    name: "Usage counter (Redis)",
    purpose: "Plan enforcement — counts API requests per project/date for quota tracking.",
    location: ["REDIS"],
    storageTable: "(Redis sorted set)",
    retention: { defaultDays: 7, maxDays: 31, configurable: false },
    classification: "INTERNAL",
    isPersonalData: false,
    legalBasis: "CONTRACT_NECESSARY",
    isUserControllable: false,
    persisted: false,
    processingRole: "CONTROLLER",
    notes: "Ephemeral Redis counters. No request content — just integer counts per project+date.",
  },

  // ── Governance & AI Usage Tracking ──────────────────────────────────────
  {
    id: "governance.auditLog",
    name: "AI Usage Governance audit log",
    purpose: "Tracks AI provider usage decisions (ALLOW/BLOCK/APPROVAL) for compliance reporting.",
    location: ["POSTGRESQL"],
    storageTable: "AiUsageGovernanceAuditLog",
    retention: { defaultDays: 365, maxDays: 365 * 2, configurable: true },
    classification: "INTERNAL",
    isPersonalData: false,
    legalBasis: "CONTRACT_NECESSARY",
    isUserControllable: false,
    persisted: true,
    processingRole: "PROCESSOR",
    notes: "Contains provider name, decision, and redacted context. Configurable retention.",
  },
  {
    id: "governance.approvalRequest",
    name: "AI approval request & justification",
    purpose: "Records user-submitted justifications for accessing restricted AI providers.",
    location: ["POSTGRESQL"],
    storageTable: "AiUsageApprovalRequest",
    retention: { defaultDays: 365, maxDays: 365 * 2, configurable: true },
    classification: "INTERNAL",
    isPersonalData: false,
    legalBasis: "CONTRACT_NECESSARY",
    isUserControllable: false,
    persisted: true,
    processingRole: "PROCESSOR",
    notes: "Contains use case and justification text (sanitized by input validation, not stored raw).",
  },

  // ── Data Deletion Requests ───────────────────────────────────────────────
  {
    id: "deletion.requestRecord",
    name: "Data deletion request record",
    purpose: "Tracks DSR fulfilment — scope, status, confirmation, and export request.",
    location: ["POSTGRESQL"],
    storageTable: "DataDeletionRequest",
    retention: { defaultDays: 365 * 3, maxDays: 365 * 3, configurable: false },
    classification: "INTERNAL",
    isPersonalData: false,
    legalBasis: "LEGAL_OBLIGATION",
    isUserControllable: false,
    persisted: true,
    processingRole: "CONTROLLER",
    notes: "Retained for audit evidence even after data is deleted. Confirmation phrase stored.",
  },

  // ── Device / Extension Enrollment ────────────────────────────────────────
  {
    id: "device.enrollmentTokenHash",
    name: "Extension enrollment token hash",
    purpose: "Browser/IDE extension fleet enrolment authentication.",
    location: ["POSTGRESQL"],
    storageTable: "ExtensionEnrollmentToken",
    retention: { defaultDays: 30, maxDays: 365, configurable: false },
    classification: "CREDENTIAL",
    isPersonalData: false,
    legalBasis: "CONTRACT_NECESSARY",
    isUserControllable: false,
    persisted: true,
    processingRole: "CONTROLLER",
    notes: "Token hash. Raw token shown once at creation.",
  },
  {
    id: "device.agentHeartbeat",
    name: "Device agent heartbeat metadata",
    purpose: "Fleet health monitoring — last seen, version, OS info.",
    location: ["POSTGRESQL"],
    storageTable: "DeviceAgent",
    retention: { defaultDays: 90, maxDays: 365, configurable: true },
    classification: "INTERNAL",
    isPersonalData: false,
    legalBasis: "CONTRACT_NECESSARY",
    isUserControllable: false,
    persisted: true,
    processingRole: "PROCESSOR",
    notes: "Version string, OS type, last heartbeat timestamp. No personal data.",
  },
];

// ═════════════════════════════════════════════════════════════════════════════
// Lookup utilities
// ═════════════════════════════════════════════════════════════════════════════

const index = new Map(DATA_CATEGORIES.map((c) => [c.id, c]));

/** Look up a single category by stable ID. */
export function getDataCategory(id: DataCategoryId): DataCategory | undefined {
  return index.get(id);
}

/** Return all categories matching a predicate. */
export function queryDataCategories(
  predicate: (category: DataCategory) => boolean,
): DataCategory[] {
  return DATA_CATEGORIES.filter(predicate);
}

/** Return categories that contain personal data (for DSR scoping). */
export function getPersonalDataCategories(): DataCategory[] {
  return DATA_CATEGORIES.filter((c) => c.isPersonalData);
}

/** Return categories that are user-controllable (exportable / deletable). */
export function getUserControllableCategories(): DataCategory[] {
  return DATA_CATEGORIES.filter((c) => c.isUserControllable);
}

/** Return categories stored in a specific location. */
export function getCategoriesByLocation(location: ProcessingLocation): DataCategory[] {
  return DATA_CATEGORIES.filter((c) => c.location.includes(location));
}

/** Return categories by classification. */
export function getCategoriesByClassification(
  classification: DataClassification,
): DataCategory[] {
  return DATA_CATEGORIES.filter((c) => c.classification === classification);
}

// ═════════════════════════════════════════════════════════════════════════════
// Validation
// ═════════════════════════════════════════════════════════════════════════════

export interface InventoryValidationResult {
  valid: boolean;
  errors: string[];
  duplicateIds: string[];
}

/**
 * Validate the data inventory for:
 *  - Duplicate IDs
 *  - Missing required fields
 *  - Invalid enum values
 */
export function validateDataInventory(): InventoryValidationResult {
  const errors: string[] = [];
  const seenIds = new Map<string, number>();

  for (const category of DATA_CATEGORIES) {
    // Check duplicate IDs
    const count = (seenIds.get(category.id) ?? 0) + 1;
    seenIds.set(category.id, count);

    // Required fields
    if (!category.id) errors.push("Missing id");
    if (!category.purpose) errors.push(`[${category.id}] Missing purpose`);
    if (!category.location || category.location.length === 0) {
      errors.push(`[${category.id}] Missing location`);
    }
    if (!category.storageTable) errors.push(`[${category.id}] Missing storageTable`);
    if (!category.legalBasis) errors.push(`[${category.id}] Missing legalBasis`);
  }

  const duplicateIds = [...seenIds.entries()]
    .filter(([_, count]) => count > 1)
    .map(([id]) => id);

  return {
    valid: errors.length === 0 && duplicateIds.length === 0,
    errors,
    duplicateIds,
  };
}

/**
 * Generate a GDPR-compliant "Records of Processing Activities" summary.
 * Returns a structured object suitable for JSON export or PDF generation.
 */
export function generateProcessingRecords(): {
  controllerName: string;
  controllerContact: string;
  dpdpRegistered: boolean;
  dpdpRegistrationId: string | null;
  categories: Array<{
    categoryId: string;
    name: string;
    purpose: string;
    classification: string;
    retentionDays: number;
    legalBasis: string;
    isPersonalData: boolean;
    storageLocation: string;
  }>;
  dataTransfers: Array<{ category: string; location: string; notes: string }>;
  generatedAt: string;
  disclaimer: string;
} {
  return {
    controllerName: "SoterAI (Yash Chauhan)",
    controllerContact: "https://soterai.in/privacy",
    dpdpRegistered: false,
    dpdpRegistrationId: null,
    categories: DATA_CATEGORIES.map((c) => ({
      categoryId: c.id,
      name: c.name,
      purpose: c.purpose,
      classification: c.classification,
      retentionDays: c.retention.defaultDays,
      legalBasis: c.legalBasis,
      isPersonalData: c.isPersonalData,
      storageLocation: c.location.join(", "),
    })),
    dataTransfers: DATA_CATEGORIES.filter((c) =>
      c.location.includes("DYNAMODB") || c.location.includes("POSTGRESQL"),
    ).map((c) => ({
      category: c.id,
      location: c.location.join(", "),
      notes: c.notes,
    })),
    generatedAt: new Date().toISOString(),
    disclaimer:
      "This is a machine-generated records-of-processing-activities summary for internal readiness. It does not independently satisfy GDPR Article 30 or DPDP Section 11 requirements. Consult your legal counsel.",
  };
}
