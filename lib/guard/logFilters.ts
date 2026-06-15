// Pure, testable filter + keyset-pagination helpers for the guard logs surface
// (CRG-RT-006). Shared by the logs page (server component) and the logs API so
// filtering/pagination behave identically and stay bounded.
//
// Safety:
// - `limit` is always clamped (never an unbounded fetch).
// - Only allowlisted enum values are accepted for action/direction.
// - `riskType` is trimmed and length-capped.
// - Keyset cursor uses (createdAt, id) so pages are stable even with ties and
//   never require a large OFFSET scan.
// - This module never selects or exposes raw prompt text; the list select
//   (`guardLogListSelect`) deliberately omits `originalText`.

export const LOG_ACTIONS = ["ALLOW", "ALLOW_WITH_REDACTION", "REWRITE", "BLOCK", "HUMAN_REVIEW"] as const;
export const LOG_DIRECTIONS = ["INPUT", "OUTPUT", "ANALYZE"] as const;

export type LogAction = (typeof LOG_ACTIONS)[number];
export type LogDirection = (typeof LOG_DIRECTIONS)[number];

const DEFAULT_LIMIT = 50;
const MIN_LIMIT = 10;
const MAX_LIMIT = 100;
const RISK_TYPE_MAX = 64;

export interface LogFilterInput {
  action?: string | null;
  direction?: string | null;
  riskType?: string | null;
  from?: string | null;
  to?: string | null;
  cursor?: string | null;
  limit?: string | number | null;
}

export interface LogCursor {
  createdAt: Date;
  id: string;
}

export interface ParsedLogFilters {
  action?: LogAction;
  direction?: LogDirection;
  riskType?: string;
  from?: Date;
  to?: Date;
  cursor?: LogCursor;
  limit: number;
}

function clampLimit(value: string | number | null | undefined): number {
  const n = typeof value === "number" ? value : Number(value ?? DEFAULT_LIMIT);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, Math.trunc(n)));
}

function parseDate(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

// Cursor is `${createdAtISO}_${id}` (id is a cuid, no underscores).
export function encodeCursor(row: { createdAt: Date | string; id: string }): string {
  const iso = typeof row.createdAt === "string" ? new Date(row.createdAt).toISOString() : row.createdAt.toISOString();
  return `${iso}_${row.id}`;
}

export function decodeCursor(value: string | null | undefined): LogCursor | undefined {
  if (!value) return undefined;
  const sep = value.indexOf("_");
  if (sep <= 0) return undefined;
  const createdAt = new Date(value.slice(0, sep));
  const id = value.slice(sep + 1);
  if (Number.isNaN(createdAt.getTime()) || !id) return undefined;
  return { createdAt, id };
}

export function parseLogFilters(input: LogFilterInput): ParsedLogFilters {
  const action = LOG_ACTIONS.includes(input.action as LogAction) ? (input.action as LogAction) : undefined;
  const direction = LOG_DIRECTIONS.includes(input.direction as LogDirection) ? (input.direction as LogDirection) : undefined;
  const riskTypeRaw = (input.riskType ?? "").trim();
  const riskType = riskTypeRaw ? riskTypeRaw.slice(0, RISK_TYPE_MAX) : undefined;
  return {
    action,
    direction,
    riskType,
    from: parseDate(input.from),
    to: parseDate(input.to),
    cursor: decodeCursor(input.cursor),
    limit: clampLimit(input.limit),
  };
}

// Builds a Prisma `where` for GuardLog. `projectScope` is the caller-enforced
// tenant/project boundary (never user-controlled here) and is always applied.
export function buildLogWhere(
  projectScope: Record<string, unknown>,
  filters: ParsedLogFilters,
): Record<string, unknown> {
  const where: Record<string, unknown> = { ...projectScope };
  if (filters.action) where.action = filters.action;
  if (filters.direction) where.direction = filters.direction;
  if (filters.riskType) where.riskTypes = { has: filters.riskType };

  const createdAt: Record<string, Date> = {};
  if (filters.from) createdAt.gte = filters.from;
  if (filters.to) createdAt.lte = filters.to;
  if (Object.keys(createdAt).length) where.createdAt = createdAt;

  // Keyset pagination: rows strictly "after" the cursor in (createdAt desc, id desc).
  if (filters.cursor) {
    const { createdAt: cAt, id } = filters.cursor;
    const keyset = [
      { createdAt: { lt: cAt } },
      { AND: [{ createdAt: cAt }, { id: { lt: id } }] },
    ];
    where.OR = where.OR ? [{ OR: where.OR }, { OR: keyset }] : keyset;
    // If a from/to range exists, it stays in `where.createdAt`; the keyset OR
    // narrows further. Both must hold, which Prisma ANDs at the top level.
  }
  return where;
}

export const LOG_ORDER_BY = [{ createdAt: "desc" as const }, { id: "desc" as const }];
