import Link from 'next/link';
import type { ReactNode } from 'react';
import { cx } from './SaRoot';
import { buttonClass, type ButtonStyleProps } from './buttonStyles';
import { VERDICT_LABEL, type Verdict } from '@/lib/sa/review';

// The button handles clicks, so it is a client component in its own file.
export { SaButton, type SaButtonProps } from './Button';

/** Link that looks like a button. Server-rendered, no JavaScript needed. */
export function SaLinkButton({
  href,
  variant,
  large,
  block,
  children,
}: ButtonStyleProps & { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={buttonClass({ variant, large, block })}>
      {children}
    </Link>
  );
}

/* -------------------------------------------------------------------------- *
 * Status badge: Stable / Beta / Labs. The text carries the meaning; colour only
 * reinforces it.
 * -------------------------------------------------------------------------- */

export type Status = 'Stable' | 'Beta' | 'Labs';

export function StatusBadge({ status }: { status: Status }) {
  return <span className={cx('sa-badge', `sa-badge--${status.toLowerCase()}`)}>{status}</span>;
}

/* -------------------------------------------------------------------------- *
 * Verdict stamp
 * -------------------------------------------------------------------------- */

/** `risk` is optional: a legend shows the verdict alone, never an invented score. */
export function Stamp({ verdict, risk }: { verdict: Verdict; risk?: number }) {
  return (
    <div className="sa-stamp" data-verdict={verdict}>
      <span className="sa-stamp__verdict">{VERDICT_LABEL[verdict]}</span>
      {typeof risk === 'number' ? (
        <span className="sa-stamp__risk">
          risk <span className="sa-num">{risk}</span> / 100
        </span>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- *
 * Callout: note, limit, error
 * -------------------------------------------------------------------------- */

export type CalloutKind = 'note' | 'limit' | 'error';

const CALLOUT_TITLE: Record<CalloutKind, string> = {
  note: 'Note',
  limit: 'Limit',
  error: 'Problem',
};

export function Callout({
  kind = 'note',
  title,
  children,
}: {
  kind?: CalloutKind;
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className={cx('sa-callout', `sa-callout--${kind}`)} role={kind === 'error' ? 'alert' : undefined}>
      <p className="sa-callout__title">{title ?? CALLOUT_TITLE[kind]}</p>
      <div className="sa-callout__body">{children}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- *
 * Metric
 * -------------------------------------------------------------------------- */

export function Metric({ value, label }: { value: string; label: string }) {
  return (
    <span className="sa-metric">
      <span className="sa-metric__value">{value}</span>
      <span className="sa-metric__label">{label}</span>
    </span>
  );
}

/* -------------------------------------------------------------------------- *
 * Data table. The first column is the row header. Scrolls sideways on phones
 * rather than squeezing, and keeps a real <caption> for screen readers.
 * -------------------------------------------------------------------------- */

export interface Column {
  key: string;
  header: string;
  numeric?: boolean;
}

export function DataTable({
  caption,
  columns,
  rows,
  empty = 'Nothing to show.',
}: {
  caption: string;
  columns: Column[];
  rows: Array<Record<string, ReactNode>>;
  empty?: string;
}) {
  return (
    <div className="sa-table-wrap" role="region" aria-label={caption} tabIndex={0}>
      <table className="sa-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={c.numeric ? 'sa-table__num' : undefined}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>{empty}</td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i}>
                {columns.map((c, j) =>
                  j === 0 ? (
                    <th key={c.key} scope="row">
                      {row[c.key]}
                    </th>
                  ) : (
                    <td key={c.key} className={c.numeric ? 'sa-table__num' : undefined}>
                      {row[c.key]}
                    </td>
                  ),
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
