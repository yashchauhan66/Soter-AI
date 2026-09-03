"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Modal dialog, built on Radix `@radix-ui/react-dialog`.
 *
 * ## Why a dependency instead of the existing hand-rolled overlays
 *
 * Seven components in this codebase hand-rolled a modal: `CommandPalette`,
 * `AdminCommandPalette`, `DashboardShell`'s mobile drawer, `MobileNav`,
 * `DocsMobileNav`, `DocsSearch`, and `TourOverlay`. Each one re-implemented, from
 * scratch:
 *
 *   - an Escape keydown listener
 *   - a Tab focus trap by querying `'a[href], button:not([disabled]), …'`
 *   - `document.body.style.overflow = "hidden"` scroll locking
 *   - focus restore to the trigger on close
 *
 * That is four pieces of subtle, easy-to-get-wrong behaviour duplicated seven
 * times, and they had already diverged: some restore the *previous* overflow
 * value and some hard-reset it to `""` (which breaks a page that was already
 * scroll-locked); the `querySelectorAll` traps miss `<input>`, `<select>`,
 * `<textarea>`, and `[contenteditable]`, so a keyboard user could Tab out of a
 * dialog that contained a text field — which the CommandPalette does.
 *
 * Radix handles all four correctly, plus `aria-modal`, `aria-labelledby` wiring,
 * pointer-down-outside dismissal, and scroll-lock that compensates for the
 * scrollbar width so the page behind does not shift when the dialog opens.
 *
 * ## Why Radix specifically
 *
 * It is unstyled (no competing design system to fight), it is the primitive layer
 * under shadcn/ui so the patterns are conventional, and `react-dialog` pulls only
 * focus/dismiss/portal utilities — no CSS, no animation runtime, no icon set.
 *
 * The visual language is entirely this project's own: `--surface-3`, the shared
 * radii, and the `.button-icon` close affordance.
 */

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

const SIZE = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
} as const;

/**
 * Dialog surface.
 *
 * `title` is required rather than optional. Radix warns at runtime when a dialog
 * has no accessible name, and a modal with no heading is a usability problem
 * regardless of assistive tech — so the type system asks for one. Pass
 * `titleVisuallyHidden` for a dialog whose heading would be redundant on screen
 * (the command palette, where the search field is self-evident).
 */
export function DialogContent({
  children,
  title,
  description,
  titleVisuallyHidden = false,
  size = "md",
  className,
  hideClose = false,
  onOpenAutoFocus,
}: {
  children: ReactNode;
  title: string;
  description?: string;
  titleVisuallyHidden?: boolean;
  size?: keyof typeof SIZE;
  className?: string;
  /** Hides the corner close button when the dialog supplies its own. */
  hideClose?: boolean;
  onOpenAutoFocus?: (event: Event) => void;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="animate-overlay-in fixed inset-0 z-overlay bg-slate-900/60 backdrop-blur-sm" />

      <DialogPrimitive.Content
        onOpenAutoFocus={onOpenAutoFocus}
        className={cn(
          "animate-scale-in fixed left-1/2 top-1/2 z-overlay w-[calc(100vw-2rem)]",
          "-translate-x-1/2 -translate-y-1/2 rounded-panel border border-slate-700/70",
          "bg-panel shadow-elevation-4",
          SIZE[size],
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
          <div className="min-w-0">
            {titleVisuallyHidden ? (
              <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
            ) : (
              <DialogPrimitive.Title className="text-base font-semibold text-slate-100">
                {title}
              </DialogPrimitive.Title>
            )}
            {description && (
              <DialogPrimitive.Description className="mt-1 text-sm leading-6 text-slate-400">
                {description}
              </DialogPrimitive.Description>
            )}
          </div>

          {!hideClose && (
            <DialogPrimitive.Close className="button-icon shrink-0" aria-label="Close dialog">
              <X size={15} aria-hidden="true" />
            </DialogPrimitive.Close>
          )}
        </div>

        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/** Body region with the standard inset. Separate so a dialog can opt out. */
export function DialogBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-5 py-4", className)}>{children}</div>;
}

/** Action row. Right-aligned on desktop, full-width stacked on mobile. */
export function DialogFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 border-t border-slate-800 px-5 py-4 sm:flex-row sm:justify-end",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Edge-anchored sheet, for navigation drawers rather than centred modals.
 *
 * Shares Radix's focus trap and scroll lock with `DialogContent`; only the
 * position and entrance differ.
 */
export function SheetContent({
  children,
  title,
  side = "right",
  className,
}: {
  children: ReactNode;
  /** Always required — see the note on DialogContent. */
  title: string;
  side?: "left" | "right";
  className?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="animate-overlay-in fixed inset-0 z-overlay bg-slate-900/60 backdrop-blur-sm" />

      <DialogPrimitive.Content
        className={cn(
          "animate-slide-in-right fixed inset-y-0 z-overlay flex w-full max-w-[320px] flex-col",
          "border-slate-800 bg-ink shadow-elevation-4",
          side === "right" ? "right-0 border-l" : "left-0 border-r",
          className,
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-800 px-4">
          <DialogPrimitive.Title className="text-xs font-semibold uppercase tracking-micro text-slate-500">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Close className="button-icon" aria-label="Close">
            <X size={15} aria-hidden="true" />
          </DialogPrimitive.Close>
        </div>

        <div className="flex-1 overflow-y-auto">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
