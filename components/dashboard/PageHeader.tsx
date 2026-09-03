import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * Standard page header for every dashboard route.
 *
 * 42 of the 84 dashboard pages opened with the same three lines — an eyebrow, an
 * `<h1 className="mt-2 text-3xl font-bold">`, and a description paragraph — and
 * 41 of those used the *exact* same H1 class string. The other pages each did
 * something slightly different, which is how a 84-page console ends up with
 * inconsistent heading sizes and vertical rhythm.
 *
 * Beyond deduplication, this adds two things the old pattern had nowhere to put:
 *
 * - **`actions`** — a slot for the page's primary controls (project switcher,
 *   "New webhook", export). Previously these were flex-jammed next to the H1 in
 *   whichever pages remembered to, so they landed at a different height on each.
 * - **`status`** — an optional badge row for "this feature is Beta" or "read-only
 *   in your plan", so a page can state its own constraints instead of letting the
 *   operator discover them by clicking a disabled button.
 *
 * Server component; no interactivity.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  status,
  docsHref,
  icon: Icon,
}: {
  /** Section this page belongs to, e.g. "Event delivery". */
  eyebrow: string;
  title: string;
  /** What the page is for. One or two sentences — long copy belongs in the body. */
  description?: React.ReactNode;
  /** Primary controls, right-aligned on wide screens and stacked below on mobile. */
  actions?: React.ReactNode;
  /** Constraint or maturity badges, e.g. `<span className="badge-info">Beta</span>`. */
  status?: React.ReactNode;
  /** Link to the guide for this feature. Rendered as a quiet trailing link. */
  docsHref?: string;
  icon?: LucideIcon;
}) {
  return (
    <header className="mb-8">
      {/* `items-start` not `items-end`: the description makes the left column
          taller, and bottom-aligning would drop the action buttons to the floor
          of the block, far from the title they act on. */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            {Icon && (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border border-slate-800 bg-slate-950 text-slate-400">
                <Icon size={13} aria-hidden="true" />
              </span>
            )}
            <p className="eyebrow">{eyebrow}</p>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-3">
            <h1 className="heading-3">{title}</h1>
            {status}
          </div>

          {description && <p className="mt-3 max-w-prose leading-7 text-slate-400">{description}</p>}

          {docsHref && (
            <Link
              href={docsHref}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-cyan hover:underline"
            >
              How this works
              <ArrowRight size={13} aria-hidden="true" />
            </Link>
          )}
        </div>

        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div>}
      </div>
    </header>
  );
}

/**
 * Section divider inside a page.
 *
 * Dashboard pages stack four to six unrelated panels with nothing but margin
 * between them, so a reader cannot tell where one concern ends and the next
 * begins. This gives a labelled boundary without another card wrapper.
 */
export function SectionHeader({
  title,
  description,
  actions,
  id,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  /** Anchor id, so a page can be deep-linked to one section. */
  id?: string;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h2 id={id} className="scroll-mt-24 text-base font-semibold text-slate-100">
          {title}
        </h2>
        {description && <p className="mt-1 max-w-prose text-sm leading-6 text-slate-400">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/**
 * Empty state for a panel with no data yet.
 *
 * The console previously showed bare "No data available." strings. An empty state
 * is the first thing a new user sees on most pages, so it should explain what
 * will appear here and offer the action that makes it appear — otherwise the page
 * reads as broken rather than new.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="surface flex flex-col items-center px-6 py-12 text-center">
      {Icon && (
        <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-md border border-slate-700/60 bg-slate-900/60 text-slate-500">
          <Icon size={18} aria-hidden="true" />
        </span>
      )}
      <p className="font-semibold text-slate-100">{title}</p>
      <p className="mt-1.5 max-w-measure text-sm leading-6 text-slate-400">{description}</p>
      {action && (
        <Link href={action.href} className="button-secondary button-sm mt-5">
          {action.label}
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
