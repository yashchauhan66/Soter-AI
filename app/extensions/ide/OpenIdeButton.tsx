'use client';

import {
  ArrowUpRight,
  Check,
  Copy,
  Download,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Timer,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

/** After this many seconds we soften the headline to reassure a slow cold start. */
const SLOW_AT = 12;

type OpenIdeButtonProps = {
  ideName: string;
  deepLink: string;
  fallbackUrl: string;
  fallbackLabel: string;
  searchName: string;
  extensionId: string;
  vsixUrl?: string;
  className?: string;
};

/**
 * One-click "Open in {IDE}" with an enterprise-grade install console.
 *
 * The IDE deep link fires the instant the user clicks (zero added delay). The
 * popup then shows a live launch status on top AND keeps every fallback route
 * (marketplace listing, direct .vsix download, copy-to-clipboard extension id)
 * visible from the very first second — so if the editor doesn't open, the user
 * is never left waiting with no way forward.
 */
export function OpenIdeButton({
  ideName,
  deepLink,
  fallbackUrl,
  fallbackLabel,
  searchName,
  extensionId,
  vsixUrl,
  className,
}: OpenIdeButtonProps) {
  const [open, setOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [copied, setCopied] = useState(false);

  // Derived, not stored: a single source of truth, nothing to synchronize.
  const slow = elapsed >= SLOW_AT;

  const launch = useCallback(() => {
    window.location.href = deepLink;
  }, [deepLink]);

  const close = useCallback(() => {
    setOpen(false);
    setElapsed(0);
    setCopied(false);
  }, []);

  // Click = fire the deep link immediately + open the install console.
  const openAndLaunch = useCallback(() => {
    setOpen(true);
    setElapsed(0);
    setCopied(false);
    launch();
  }, [launch]);

  const copyId = useCallback(() => {
    const done = () => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    };
    // Legacy fallback for browsers/contexts where the async clipboard API is
    // unavailable or rejected (e.g. missing permission, non-secure context).
    const legacyCopy = () => {
      const ta = document.createElement('textarea');
      ta.value = extensionId;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        done();
      } catch {
        /* no-op */
      }
      document.body.removeChild(ta);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(extensionId).then(done).catch(legacyCopy);
    } else {
      legacyCopy();
    }
  }, [extensionId]);

  // Elapsed-time ticker: setState lives inside the timer callback only.
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => setElapsed((e) => e + 1), 1000);
    return () => clearTimeout(timer);
  }, [open, elapsed]);

  // Escape closes the console.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, close]);

  return (
    <>
      <button
        type="button"
        onClick={openAndLaunch}
        className={
          className ??
          'mt-4 inline-flex min-h-10 items-center justify-center gap-2 bg-cyan px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-cyan/90'
        }
      >
        Open in {ideName}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[99] flex items-center justify-center overflow-y-auto px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-label={`Install SoterAI IDE Guard in ${ideName}`}
        >
          <style>{`@keyframes soterai-sweep{0%{transform:translateX(-110%)}100%{transform:translateX(320%)}}`}</style>
          <button
            type="button"
            aria-label="Close dialog"
            onClick={close}
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
          />
          <div className="relative my-auto w-full max-w-lg border border-slate-700 bg-[#0d1724] shadow-2xl shadow-black/60">
            <div className="flex items-center gap-3 border-b border-slate-800 px-6 py-4">
              <span className="flex h-9 w-9 items-center justify-center border border-cyan/30 bg-cyan/10">
                <ShieldCheck className="h-5 w-5 text-cyan" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white">SoterAI IDE Guard</p>
                <p className="text-[11px] text-slate-300">
                  Local-first AI security · verified registry release
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="inline-flex h-8 w-8 items-center justify-center text-slate-300 transition hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="px-6 py-5">
              {/* Live launch status */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {slow ? `Still opening ${ideName}…` : `Launching ${ideName}…`}
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-slate-300">
                    {slow
                      ? 'A first-time launch can take a little while — it will land on the extension page.'
                      : 'Your editor is opening with SoterAI IDE Guard ready to install.'}
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 border border-slate-700 bg-[#070d15] px-2.5 py-1.5 font-mono text-xs font-semibold text-cyan">
                  <Timer className="h-3.5 w-3.5" aria-hidden="true" />
                  {elapsed}s
                </span>
              </div>

              <div className="relative mt-4 h-1.5 w-full overflow-hidden bg-slate-800">
                <span
                  className="absolute inset-y-0 w-2/5 bg-cyan"
                  style={{ animation: 'soterai-sweep 1.4s ease-in-out infinite' }}
                />
              </div>

              <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-slate-300">
                <Loader2
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-cyan"
                  aria-hidden="true"
                />
                If your browser shows an “Open {ideName}?” prompt, click{' '}
                <strong className="text-white">Open</strong>.
              </p>

              {/* Fallbacks — always visible, never gated behind a timer */}
              <div className="mt-5 border-t border-slate-800 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                  {ideName} didn&apos;t open? Use one of these instead
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={launch}
                    className="inline-flex min-h-10 items-center justify-center gap-2 border border-slate-700 px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 hover:text-white"
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    Re-send open request
                  </button>
                  <a
                    href={fallbackUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-10 items-center justify-center gap-2 border border-slate-700 px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 hover:text-white"
                  >
                    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                    {fallbackLabel}
                  </a>
                  {vsixUrl ? (
                    <a
                      href={vsixUrl}
                      className="inline-flex min-h-10 items-center justify-center gap-2 border border-slate-700 px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 hover:text-white sm:col-span-2"
                    >
                      <Download className="h-4 w-4" aria-hidden="true" />
                      Download the .vsix to install manually
                    </a>
                  ) : null}
                </div>

                <div className="mt-3 border border-slate-800 bg-[#070d15] px-4 py-3">
                  <p className="flex items-center gap-2 text-xs font-semibold text-white">
                    <Search className="h-3.5 w-3.5 text-cyan" aria-hidden="true" />
                    Or search inside {ideName}
                  </p>
                  <p className="mt-1.5 text-xs leading-5 text-slate-300">
                    Open Extensions (
                    <kbd className="border border-slate-700 bg-slate-800 px-1 font-mono text-[10px] text-white">
                      Ctrl
                    </kbd>
                    +
                    <kbd className="border border-slate-700 bg-slate-800 px-1 font-mono text-[10px] text-white">
                      Shift
                    </kbd>
                    +
                    <kbd className="border border-slate-700 bg-slate-800 px-1 font-mono text-[10px] text-white">
                      X
                    </kbd>
                    ) and search for <strong className="text-white">{searchName}</strong>.
                  </p>
                  <button
                    type="button"
                    onClick={copyId}
                    className="mt-2.5 inline-flex min-h-9 items-center gap-2 border border-slate-700 bg-slate-900 px-3 py-1.5 font-mono text-xs text-cyan transition hover:bg-slate-800"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-lime" aria-hidden="true" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {copied ? 'Copied!' : extensionId}
                  </button>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-[11px] text-slate-400">
                  If nothing happens, {ideName} may not be installed on this device yet.
                </p>
                <button
                  type="button"
                  onClick={close}
                  className="inline-flex min-h-9 shrink-0 items-center justify-center border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 hover:text-white"
                >
                  Close
                </button>
              </div>
              <span className="sr-only" aria-live="polite">
                Launching {ideName}. {elapsed} seconds elapsed. Approve the browser prompt if one
                appears, or use a fallback install option below.
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}