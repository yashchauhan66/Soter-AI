'use client';

import { ArrowRight, ArrowUpRight, RefreshCw, Search, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

/**
 * How long we ask the user to wait while the IDE launches. The deep link is
 * fired immediately on click (so the browser permission prompt appears right
 * away); the countdown below is a friendly status screen covering the typical
 * IDE cold-start time, after which we show fallbacks in case nothing opened.
 */
const WAIT_SECONDS = 5;

type Phase = 'waiting' | 'check';

type OpenIdeButtonProps = {
  ideName: string;
  deepLink: string;
  fallbackUrl: string;
  fallbackLabel: string;
  searchName: string;
  extensionId: string;
  className?: string;
};

/**
 * One-click "Open in {IDE}" button with a guided redirect popup.
 *
 * Clicking fires the IDE protocol deep link (vscode:/cursor:/windsurf:/kiro:...)
 * immediately and opens a modal that keeps the user informed: a "please wait"
 * countdown while the editor launches, then a check-in screen with retry, a
 * registry fallback, and the exact extension name to search for inside the
 * IDE — so a blocked or missing IDE never leaves the user stuck.
 */
export function OpenIdeButton({
  ideName,
  deepLink,
  fallbackUrl,
  fallbackLabel,
  searchName,
  extensionId,
  className,
}: OpenIdeButtonProps) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('waiting');
  const [secondsLeft, setSecondsLeft] = useState(WAIT_SECONDS);

  const launch = useCallback(() => {
    window.location.href = deepLink;
  }, [deepLink]);

  const close = useCallback(() => {
    setOpen(false);
    setPhase('waiting');
    setSecondsLeft(WAIT_SECONDS);
  }, []);

  // Click = fire the deep link right away + show the "please wait" popup.
  const openAndLaunch = useCallback(() => {
    setOpen(true);
    setPhase('waiting');
    setSecondsLeft(WAIT_SECONDS);
    launch();
  }, [launch]);

  // Friendly wait screen: tick once per second, then move to the check-in.
  useEffect(() => {
    if (!open || phase !== 'waiting') return;
    if (secondsLeft <= 0) {
      setPhase('check');
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [open, phase, secondsLeft]);

  // Escape closes the dialog.
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
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[99] flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Open SoterAI IDE Guard in ${ideName}`}
        >
          <button
            type="button"
            aria-label="Close dialog"
            onClick={close}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-md border border-slate-700 bg-[#0d1724] p-6 shadow-2xl shadow-black/50 sm:p-7">
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            {phase === 'waiting' ? (
              <div>
                <p className="text-xs font-bold uppercase text-cyan">One-click install</p>
                <h3 className="mt-3 text-xl font-bold text-white">Redirecting to {ideName}…</h3>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  Hang tight — just a few seconds! We&apos;re opening{' '}
                  <strong className="text-white">SoterAI IDE Guard</strong> inside {ideName}. If
                  your browser asks for permission, click{' '}
                  <strong className="text-white">Open {ideName}</strong> and we&apos;ll take it
                  from there.
                </p>

                <div className="mt-5 flex items-center gap-4 border border-slate-700 bg-[#070d15] p-4">
                  <span
                    className="w-14 shrink-0 text-center font-mono text-4xl font-bold text-cyan"
                    aria-hidden="true"
                  >
                    {secondsLeft}s
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="h-1.5 w-full bg-slate-800">
                      <div
                        className="h-1.5 bg-cyan transition-all duration-1000 ease-linear"
                        style={{ width: `${(secondsLeft / WAIT_SECONDS) * 100}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-300">
                      Please wait while {ideName} launches — it will open straight to the extension
                      page, ready to install.
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={launch}
                    className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 bg-cyan px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-cyan/90"
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    Didn&apos;t get the prompt? Send again
                  </button>
                  <button
                    type="button"
                    onClick={close}
                    className="inline-flex min-h-10 items-center justify-center border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
                <span className="sr-only" aria-live="polite">
                  Redirecting to {ideName}. Please wait about {secondsLeft} seconds while your
                  editor launches.
                </span>
              </div>
            ) : (
              <div>
                <p className="text-xs font-bold uppercase text-lime">All set</p>
                <h3 className="mt-3 text-xl font-bold text-white">
                  {ideName} should be open now
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  Check your taskbar — {ideName} is opening straight to the SoterAI IDE Guard
                  page, ready to install. If nothing happened, your browser may have blocked the
                  redirect, or {ideName} isn&apos;t installed on this device yet.
                </p>

                <div className="mt-5 border border-slate-700 bg-[#070d15] p-4">
                  <p className="flex items-start gap-2 text-xs leading-5 text-slate-200">
                    <Search className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan" aria-hidden="true" />
                    <span>
                      <strong className="text-white">Plan B — search inside {ideName}:</strong>{' '}
                      open the Extensions view (<code className="text-cyan">Ctrl+Shift+X</code>)
                      and search for <strong className="text-white">{searchName}</strong> —
                      publisher <code className="text-cyan">soterai</code>, extension id{' '}
                      <code className="text-cyan">{extensionId}</code>.
                    </span>
                  </p>
                </div>

                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={launch}
                    className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 bg-cyan px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-cyan/90"
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    Try opening {ideName} again
                  </button>
                  <a
                    href={fallbackUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-10 items-center justify-center gap-1.5 border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 hover:text-white"
                  >
                    {fallbackLabel} fallback
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}