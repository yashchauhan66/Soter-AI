# DATABASE ISSUES
## CyberRakshak Guard — Database Audit

**Date:** 2026-06-16  
**Branch:** bug-stabilization-final

---

## Prisma Schema Validation

```
npx prisma validate → ✅ PASS: The schema at prisma/schema.prisma is valid
```

---

## Summary

| Issue ID | Severity | Title | Status |
|----------|----------|-------|--------|
| DB-001 | N/A | Prisma validate | PASS |
| DB-002 | N/A | Migrations | NOT_VERIFIED (no live DB) |
| DB-003 | N/A | Seed | NOT_VERIFIED (no live DB) |
| DB-004 | LOW | Some high-volume columns could benefit from additional indexes | DOCUMENTED |
| DB-005 | MEDIUM | `originalText` stored as `@db.Text` in GuardLog — large payloads could bloat | DOCUMENTED |
| DB-006 | N/A | Raw secrets in GuardLog | VERIFIED SAFE |
| DB-007 | N/A | Email verification consistency | VERIFIED SAFE |
| DB-008 | N/A | Cascade delete safety | VERIFIED SAFE |

---

## DB-001: Prisma Schema Valid ✅

**Status:** PASS

The schema at `prisma/schema.prisma` (2271 lines) validates successfully. All relations, enums, and unique constraints are correctly defined.

---

## DB-002: Migrations — NOT_VERIFIED

**Status:** NOT_VERIFIED (BLOCKED_NEEDS_USER_PERMISSION)

Migration apply (`prisma migrate deploy`) requires a live PostgreSQL database. Cannot be verified locally without `DATABASE_URL` pointing to a running Postgres instance.

**Recommendation:** Run `npx prisma migrate deploy` against a test database before production deployment.

---

## DB-003: Seed — NOT_VERIFIED

**Status:** NOT_VERIFIED (BLOCKED_NEEDS_USER_PERMISSION)

`prisma/seed.ts` requires a live database. Not verifiable without `DATABASE_URL`.

---

## DB-004: Index Analysis

**Status:** DOCUMENTED

**Existing indexes found:**

| Model | Index | Purpose |
|-------|-------|---------|
| Organization | `@@index([type])` | Filter by org type |
| OrganizationMember | `@@index([userId])` | User's memberships |
| Invite | `@@index([organizationId])`, `@@index([email])` | Invite lookup |
| Project | `@@index([userId])`, `@@index([organizationId])`, `@@index([clientId])`, `@@index([badgeSlug])` | All necessary |
| ApiKey | `@@index([projectId])`, `@@index([prefix])`, `@@index([prefix, isActive])`, `@@index([projectId, isActive])` | Efficient key lookup |
| GuardLog | `@@index([projectId, createdAt])`, `@@index([action])`, `@@index([projectId, action, createdAt])`, `@@index([projectId, riskScore, createdAt])`, `@@index([apiKeyId, createdAt])` | Query performance |
| WebhookDelivery | `@@index([endpointId, createdAt])`, `@@index([status, nextAttemptAt])`, `@@index([endpointId, status])`, `@@index([createdAt])` | Worker query performance |
| Subscription | `@@index([status])` | Plan enforcement |
| Invoice | `@@index([organizationId, createdAt])` | Billing queries |
| PaymentEvent | `@@index([organizationId, receivedAt])`, `@@index([eventType])`, `@@index([eventType, receivedAt])` | Billing audit |
| AuditExport | `@@index([organizationId, createdAt])`, `@@index([status, createdAt])` | Export queries |
| EmailVerificationToken | `@@index([userId, expiresAt])` | Token cleanup |
| PasswordResetToken | `@@index([userId, expiresAt])` | Token cleanup |
| UsageCounter | `@@unique([projectId, date])`, `@@index([projectId])`, `@@index([projectId, date])` | Usage aggregation |

**Assessment:** Index coverage is comprehensive for common queries. No obvious missing indexes.

---

## DB-005: GuardLog `originalText` — Large Text Storage

**Status:** DOCUMENTED

**Finding:** `GuardLog.originalText` is typed as `String? @db.Text`. The guard API accepts messages up to `MAX_TEXT_LENGTH` (default 8000 chars). For most use cases, `originalText` is set to `null` when the content is confidential (via `prepareSafeLogContent`).

**Risk:** For non-confidential inputs (ALLOW actions), the full original text is stored. At high request volumes with long messages, this column could consume significant storage.

**Recommendation:** Consider adding a `MAX_LOG_TEXT_BYTES` cutoff (e.g., 2000 chars) that truncates `originalText` before storage, even for non-confidential content.

---

## DB-006: Raw Secrets in GuardLog — VERIFIED SAFE ✅

**Status:** VERIFIED SAFE

**Finding checked:** Do `originalText`, `redactedText`, `safeText` ever store raw secrets?

**Analysis:**
- `prepareSafeLogContent()` sets `originalText = null` when `CONFIDENTIAL_RISKS` (including `SECRET_DETECTED`) are detected
- `redactedText` contains `[REDACTED_SECRET]` tokens — not raw values
- System prompt leakage stores `[REDACTED_SYSTEM_INSTRUCTIONS]`
- Test in `security.test.ts` validates this behavior

**Result:** Raw secrets are never stored in GuardLog.

---

## DB-007: Email Verification Consistency — VERIFIED SAFE ✅

**Status:** VERIFIED SAFE

**Schema:**
```prisma
model EmailVerificationToken {
  tokenHash String    @unique      // Only hash stored
  usedAt    DateTime?              // One-time use enforced
  expiresAt DateTime               // TTL enforced
  userId    String                 // Cascade delete on user
}
```

**Analysis:**
- `createEmailVerificationToken()` deletes all unused tokens for the user before creating a new one → prevents token accumulation
- `consumeEmailVerificationToken()` marks token as used in an atomic DB transaction → prevents race conditions
- Token hash is SHA-256 with `auth-token:` prefix → adequate strength
- `@@index([userId, expiresAt])` supports cleanup queries

---

## DB-008: Cascade Delete Safety — VERIFIED SAFE ✅

**Status:** VERIFIED SAFE

**Cascade delete chains verified:**
- Organization → Project → GuardLog, ApiKey, WebhookEndpoint, WebhookDelivery (all Cascade)
- Organization → Subscription (Cascade)
- Organization → AuditExport (Cascade)
- User → EmailVerificationToken, PasswordResetToken (Cascade)
- User → OnboardingProgress (Cascade)
- ApiKey → GuardLog (SetNull — preserves logs after key deletion)

**Risk noted:** Deleting an Organization cascades to all Projects, GuardLogs, ApiKeys, Webhooks. This is correct behavior for data retention/deletion requests. The `DataDeletionRequest` model tracks this for audit purposes.

---

## DB-009: Tenant Isolation in Schema

**Status:** VERIFIED SAFE

| Table | Tenant Key | Enforcement |
|-------|------------|-------------|
| Project | `organizationId` + `userId` | requireProjectAccess |
| GuardLog | `projectId` | requireProjectPermission |
| ApiKey | `projectId` | requireProjectAccess |
| WebhookEndpoint | `projectId` | requireProjectAccess |
| RagCollection | `organizationId` + `projectId` | requireProjectAccess |
| RagChunk | via documentId → collectionId → projectId | vector ACL |
| AuditExport | `organizationId` | requireOrganizationAccess |
| SecurityEvent | `organizationId` + `projectId` | emitSecurityEvent |

---

## DB-010: Unique Constraints Verified

| Constraint | Purpose |
|------------|---------|
| `User.email @unique` | Prevents duplicate accounts |
| `Organization.slug @unique` | Prevents slug collision |
| `ApiKey.keyHash @unique` | Hash collision prevention |
| `Project.badgeSlug @unique` | Badge URL uniqueness |
| `WebhookEndpoint.secretHash` (no unique — correct) | Allows secret rotation |
| `EmailVerificationToken.tokenHash @unique` | Token uniqueness |
| `PasswordResetToken.tokenHash @unique` | Token uniqueness |
| `Invite.tokenHash @unique` | Invite uniqueness |
| `Report @@unique([projectId, month, year])` | One report per period |
| `UsageCounter @@unique([projectId, date])` | One counter per day |
| `Subscription @@unique([organizationId])` | One sub per org |
