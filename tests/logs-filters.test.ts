import assert from "node:assert/strict";
import test from "node:test";

import {
  parseLogFilters,
  buildLogWhere,
  encodeCursor,
  decodeCursor,
  LOG_ORDER_BY,
  LOG_ACTIONS,
  LOG_DIRECTIONS,
} from "../lib/guard/logFilters";

// === Filter parsing: allowlists, clamping, sanitisation =====================

test("CRG-RT-006: limit is always clamped to [10,100] with a 50 default", () => {
  assert.equal(parseLogFilters({ limit: 5 }).limit, 10);
  assert.equal(parseLogFilters({ limit: 1000 }).limit, 100);
  assert.equal(parseLogFilters({ limit: "37" }).limit, 37);
  assert.equal(parseLogFilters({ limit: "not-a-number" }).limit, 50);
  assert.equal(parseLogFilters({}).limit, 50);
});

test("CRG-RT-006: only allowlisted action/direction values are accepted", () => {
  for (const action of LOG_ACTIONS) assert.equal(parseLogFilters({ action }).action, action);
  for (const direction of LOG_DIRECTIONS) assert.equal(parseLogFilters({ direction }).direction, direction);
  assert.equal(parseLogFilters({ action: "DROP TABLE" }).action, undefined);
  assert.equal(parseLogFilters({ direction: "sideways" }).direction, undefined);
});

test("CRG-RT-006: riskType is trimmed and length-capped", () => {
  assert.equal(parseLogFilters({ riskType: "  PII  " }).riskType, "PII");
  assert.equal(parseLogFilters({ riskType: "   " }).riskType, undefined);
  assert.equal(parseLogFilters({ riskType: "x".repeat(200) }).riskType!.length, 64);
});

test("CRG-RT-006: invalid dates are ignored, valid dates parsed", () => {
  assert.equal(parseLogFilters({ from: "nonsense" }).from, undefined);
  const parsed = parseLogFilters({ from: "2026-01-01T00:00:00Z", to: "2026-02-01T00:00:00Z" });
  assert.equal(parsed.from?.toISOString(), "2026-01-01T00:00:00.000Z");
  assert.equal(parsed.to?.toISOString(), "2026-02-01T00:00:00.000Z");
});

// === Cursor encode/decode (keyset) ==========================================

test("CRG-RT-006: cursor round-trips createdAt + id", () => {
  const row = { createdAt: new Date("2026-06-15T10:20:30.500Z"), id: "ckxyz123" };
  const encoded = encodeCursor(row);
  assert.equal(encoded, "2026-06-15T10:20:30.500Z_ckxyz123");
  const decoded = decodeCursor(encoded);
  assert.equal(decoded?.id, "ckxyz123");
  assert.equal(decoded?.createdAt.toISOString(), "2026-06-15T10:20:30.500Z");
});

test("CRG-RT-006: malformed cursors decode to undefined (fail safe)", () => {
  assert.equal(decodeCursor(""), undefined);
  assert.equal(decodeCursor(null), undefined);
  assert.equal(decodeCursor("no-separator"), undefined);
  assert.equal(decodeCursor("not-a-date_id"), undefined);
  assert.equal(decodeCursor("_orphan"), undefined);
});

// === buildLogWhere: tenant scope, filters, keyset ============================

test("CRG-RT-006: project scope is always applied and not overridable", () => {
  const where = buildLogWhere({ projectId: "proj-1" }, parseLogFilters({}));
  assert.equal(where.projectId, "proj-1");
});

test("CRG-RT-006: action/direction/riskType map to safe Prisma clauses", () => {
  const where = buildLogWhere(
    { projectId: "proj-1" },
    parseLogFilters({ action: "BLOCK", direction: "INPUT", riskType: "PII" }),
  );
  assert.equal(where.action, "BLOCK");
  assert.equal(where.direction, "INPUT");
  assert.deepEqual(where.riskTypes, { has: "PII" });
});

test("CRG-RT-006: from/to compose into a single createdAt range", () => {
  const where = buildLogWhere(
    { projectId: "p" },
    parseLogFilters({ from: "2026-01-01T00:00:00Z", to: "2026-02-01T00:00:00Z" }),
  );
  assert.deepEqual(where.createdAt, {
    gte: new Date("2026-01-01T00:00:00Z"),
    lte: new Date("2026-02-01T00:00:00Z"),
  });
});

test("CRG-RT-006: keyset cursor produces a strict (createdAt,id) OR clause", () => {
  const cursor = encodeCursor({ createdAt: new Date("2026-06-15T10:00:00Z"), id: "ck9" });
  const where = buildLogWhere({ projectId: "p" }, parseLogFilters({ cursor }));
  assert.ok(Array.isArray(where.OR));
  const or = where.OR as Array<Record<string, unknown>>;
  assert.deepEqual(or[0], { createdAt: { lt: new Date("2026-06-15T10:00:00Z") } });
  assert.deepEqual(or[1], { AND: [{ createdAt: new Date("2026-06-15T10:00:00Z") }, { id: { lt: "ck9" } }] });
});

test("CRG-RT-006: order is createdAt desc then id desc (stable keyset)", () => {
  assert.deepEqual(LOG_ORDER_BY, [{ createdAt: "desc" }, { id: "desc" }]);
});

// === API/UI shape & no-leak guards (source structure) =======================

test("CRG-RT-006: list select omits raw originalText (no prompt leak)", async () => {
  const { guardLogListSelect } = await import("../lib/guard/logSelect");
  assert.equal((guardLogListSelect as Record<string, unknown>).originalText, undefined);
  assert.equal((guardLogListSelect as Record<string, unknown>).redactedText, true);
});

test("CRG-RT-006: logs API returns bounded take and paginated shape", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync("app/api/logs/route.ts", "utf8");
  assert.match(src, /take: filters\.limit \+ 1/);
  assert.match(src, /nextCursor/);
  // Tenant scope derived from the session org, never from a client param.
  assert.match(src, /organizationId: active\.org\.id/);
  assert.doesNotMatch(src, /originalText/);
});

test("CRG-RT-006: logs page wires filter bar, pagination, and end-of-day 'to'", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync("app/dashboard/logs/page.tsx", "utf8");
  assert.match(src, /LogsFilterBar/);
  assert.match(src, /Next page/);
  assert.match(src, /T23:59:59\.999Z/);
  assert.match(src, /take: filters\.limit \+ 1/);
});

test("CRG-RT-011: logs API enforces logs:read permission (BILLING role lacks it)", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync("app/api/logs/route.ts", "utf8");
  // The route must gate on the permission matrix, not membership alone.
  assert.match(src, /hasPermission\(\s*active\.membership\.role\s*,\s*"logs:read"\s*\)/);
  assert.match(src, /status:\s*403/);
  // Confirm the matrix this relies on: BILLING does not have logs:read,
  // VIEWER/DEVELOPER/SECURITY_ANALYST/OWNER/ADMIN do.
  const { hasPermission } = await import("../lib/auth/permissions");
  assert.equal(hasPermission("BILLING", "logs:read"), false);
  assert.equal(hasPermission("VIEWER", "logs:read"), true);
  assert.equal(hasPermission("OWNER", "logs:read"), true);
});
