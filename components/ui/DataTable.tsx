import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Table primitives.
 *
 * ## Why these exist
 *
 * The console renders 58 tables across 50 files, and every one styled itself.
 * An audit of the markup found **11 distinct `<thead>` class strings** and
 * **10 distinct `<th>` class strings** for what is visually meant to be the same
 * table header:
 *
 *   19x  "text-xs uppercase text-slate-300"
 *    7x  "border-b border-slate-800 text-xs uppercase tracking-wider text-slate-300"
 *    6x  "text-xs uppercase tracking-wider text-slate-300"
 *    2x  "bg-slate-950 text-xs uppercase text-slate-300"
 *    1x  "bg-slate-50 border-b"        ← light-mode leftover on a dark console
 *    …
 *
 * That is why the product reads as assembled rather than designed: no two data
 * tables agreed on header weight, cell padding, or row rule colour, and one of
 * them still carried a light-theme background.
 *
 * These primitives are deliberately **markup-level, not data-level**. A generic
 * `<DataTable columns={…} rows={…} />` would have forced a rewrite of all 50 call
 * sites at once and could not express the row-spanning, nested-form, and
 * disclosure cells this console actually uses. Swapping `<table>` → `<Table>` and
 * `<th>` → `<TH>` is a mechanical, reviewable change that preserves every
 * existing cell.
 *
 * ## Conventions these encode
 *
 * - **Numeric columns are right-aligned and tabular.** `<TH numeric>` /
 *   `<TD numeric>` set both, because numbers compare by their last digit and
 *   proportional figures make a column ragged as values change.
 * - **The header is sticky by default.** On a 100-row log the previous headers
 *   scrolled away, leaving unlabelled columns.
 * - **Row rules are lighter than the container border.** Ruling every row at the
 *   same weight as the card edge makes a table read as a stack of boxes.
 */

// ── Table shell ─────────────────────────────────────────────────────────

export function Table({
  children,
  className,
  minWidth,
  label,
}: {
  children: ReactNode;
  className?: string;
  /**
   * Minimum width before horizontal scrolling kicks in, e.g. `"64rem"`.
   *
   * Passed as an inline style rather than a Tailwind class because these values
   * are per-table data (they depend on column count) and a `min-w-[1100px]`
   * arbitrary value cannot be derived from a prop at build time.
   */
  minWidth?: string;
  /** Accessible name for the table. Name the data, e.g. "Guard decisions". */
  label: string;
}) {
  return (
    <table
      aria-label={label}
      style={minWidth ? { minWidth } : undefined}
      className={cn("w-full border-collapse text-left text-sm", className)}
    >
      {children}
    </table>
  );
}

// ── Header ──────────────────────────────────────────────────────────────

export function THead({
  children,
  className,
  sticky = true,
}: {
  children: ReactNode;
  className?: string;
  /**
   * Sticky headers need an ancestor with a bounded height and `overflow-y`.
   * Pass `sticky={false}` for short tables inside a flowing page, where a
   * sticky header would sit on top of whatever scrolls past underneath it.
   */
  sticky?: boolean;
}) {
  return (
    <thead
      className={cn(
        "border-b border-slate-800",
        sticky && "sticky top-0 z-10 bg-slate-900/95 backdrop-blur",
        className,
      )}
    >
      {children}
    </thead>
  );
}

export function TH({
  children,
  className,
  numeric = false,
  scope = "col",
  colSpan,
  width,
}: {
  children?: ReactNode;
  className?: string;
  /** Right-align for a numeric column. */
  numeric?: boolean;
  scope?: "col" | "row";
  colSpan?: number;
  /** Fixed column width, e.g. `"12rem"`. Use sparingly. */
  width?: string;
}) {
  return (
    <th
      scope={scope}
      colSpan={colSpan}
      style={width ? { width } : undefined}
      className={cn(
        "whitespace-nowrap px-4 py-2.5 text-[11px] font-semibold uppercase tracking-micro text-slate-500",
        numeric ? "text-right" : "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

// ── Body ────────────────────────────────────────────────────────────────

export function TBody({ children, className }: { children: ReactNode; className?: string }) {
  return <tbody className={className}>{children}</tbody>;
}

export function TR({
  children,
  className,
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  /**
   * Set when the row itself is interactive (expands a disclosure, opens a
   * detail view). A hover response on a row that does nothing is a false
   * affordance — the same reason `.card` no longer reacts to hover.
   */
  interactive?: boolean;
}) {
  return (
    <tr
      className={cn(
        "border-b border-slate-800/60 align-top last:border-b-0",
        interactive && "transition-colors hover:bg-slate-800/40",
        className,
      )}
    >
      {children}
    </tr>
  );
}

export function TD({
  children,
  className,
  numeric = false,
  colSpan,
  truncate = false,
}: {
  children?: ReactNode;
  className?: string;
  numeric?: boolean;
  colSpan?: number;
  /** Prevents a long single-line value from forcing the column wider. */
  truncate?: boolean;
}) {
  return (
    <td
      {...(numeric ? { "data-numeric": true } : {})}
      colSpan={colSpan}
      className={cn(
        "px-4 py-3 text-slate-300",
        numeric && "text-right",
        truncate && "max-w-0 truncate",
        className,
      )}
    >
      {children}
    </td>
  );
}

/**
 * Full-width empty state row.
 *
 * Replaces the `<tr><td colSpan={7}>No entries.</td></tr>` pattern that appeared
 * with a different colSpan, padding, and copy tone in every table. Keeping it in
 * one place also means the message is centred and vertically padded consistently,
 * so an empty table reads as *empty* rather than as broken markup.
 */
export function TEmpty({
  colSpan,
  message,
  action,
}: {
  colSpan: number;
  message: string;
  /** Optional affordance that would populate the table. */
  action?: ReactNode;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center">
        <p className="text-sm text-slate-400">{message}</p>
        {action && <div className="mt-4 flex justify-center">{action}</div>}
      </td>
    </tr>
  );
}
