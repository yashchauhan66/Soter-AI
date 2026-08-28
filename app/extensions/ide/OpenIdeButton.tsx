'use client';

import {
  ArrowUpRight,
  CheckCircle2,
  Circle,
  Download,
  Info,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Timer,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

/** Seconds after which we switch to the "should be open by now" check-in. */
const TROUBLESHOOT_AT = 30;

type Phase = 'launching' | 'troubleshoot';

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
 * One-click "Open in {IDE}" with an enterprise-grade launch console.
 *
 * The IDE deep link fires the instant the user clicks (zero added delay), and
 * the popup becomes a live status console: staged progress, an elapsed timer,
 * a browser-prompt hint, and honest expectations for the editor cold start.
 * After TROUBLESHOOT_AT seconds it switches to a check-in screen with retry,
 * registry fallback, direct .vsix download, and the exact extension name to
 * search inside the IDE — so nobody is left wondering whether it worked.
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

  // Derived, not stored: one source of truth, nothing to synchronize.
  const phase: Phase = elapsed >= TROUBLESHOOT_AT ? 'troubleshoot' : 'launching';

  const launch = useCallback(() => {
    window.location.href = deepLink;
  }, [deepLink]);

  const close = useCallback(() => {
    setOpen(false);
    setElapsed(0);
  }, []);

  // Click = fire the deep link immediately + open the launch console.
  const openAndLaunch = useCallback(() => {
    setOpen(true);
    setElapsed(0);
    launch();
  }, [launch]);

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
          className="fixed inset-0 z-[99] flex items-center justify-center px-4"
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
          <div className="relative w-full max-w-lg border border-slate-700 bg-[#0d1724] shadow-2xl shadow-black/60">
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
              {phase === 'launching' ? (
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-white">Launching {ideName}…</h3>
                      <p className="mt-1 text-xs leading-5 text-slate-300">
                        Hang tight — your editor is opening with SoterAI IDE Guard ready to install.
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

                  <ol className="mt-5 space-y-3">
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-lime" aria-hidden="true" />
                      <div>
                        <p className="text-sm font-semibold text-white">Install request sent</p>
                        <p className="text-xs text-slate-300">
                          We asked your system to open {ideName} — instantly, with no extra steps.
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <Loader2
                        className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-cyan"
                        aria-hidden="true"
                      />
                      <div>
                        <p className="text-sm font-semibold text-white">{ideName} is starting…</p>
                        <p className="text-xs leading-5 text-slate-300">
                          If your browser shows an “Open {ideName}?” prompt, click{' '}
                          <strong className="text-white">Open</strong>. A cold start usually takes
                          10–30 seconds.
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" aria-hidden="true" />
                      <div>
                        <p className="text-sm font-semibold text-slate-200">
                          Extension page opens automatically
                        </p>
                        <p className="text-xs text-slate-300">
                          {ideName} will land on SoterAI IDE Guard, ready to install — no searching
                          needed.
                        </p>
                      </div>
                    </li>
                  </ol>

                  <div className="mt-5 flex items-start gap-2 border border-slate-800 bg-[#070d15] px-3 py-2.5">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan" aria-hidden="true" />
                    <p className="text-xs leading-5 text-slate-300">
                      Keep this window open. If {ideName} hasn&apos;t appeared in your taskbar after
                      ~30 seconds, we&apos;ll show you instant fallbacks.
                    </p>
                  </div>

                  <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={launch}
                      className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 bg-cyan px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-cyan/90"
                    >
                      <RefreshCw className="h-4 w-4" aria-hidden="true" />
                      Re-send open request
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
                    Launching {ideName}. {elapsed} seconds elapsed. Approve the browser prompt if
                    one appears.
                  </span>
                </div>
              ) : null}

              {phase === 'troubleshoot' ? (
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {ideName} should be open by now
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-slate-300">
                    Check your taskbar — {ideName} may have opened behind this window. If it
                    didn&apos;t, one of these will get you installed in seconds.
                  </p>

                  <div className="mt-4 space-y-2">
                    <button
                      type="button"
                      onClick={launch}
                      className="inline-flex min-h-10 w-full items-center justify-center gap-2 bg-cyan px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-cyan/90"
                    >
                      <RefreshCw className="h-4 w-4" aria-hidden="true" />
                      Try opening {ideName} again
                    </button>
                    <a
                      href={fallbackUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-10 w-full items-center justify-center gap-2 border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 hover:text-white"
                    >
                      <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                      {fallbackLabel}
                    </a>
                    {vsixUrl ? (
                      <a
                        href={vsixUrl}
                        className="inline-flex min-h-10 w-full items-center justify-center gap-2 border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 hover:text-white"
                      >
                        <Download className="h-4 w-4" aria-hidden="true" />
                        Download the .vsix and install manually
                      </a>
                    ) : null}
                  </div>

                  <div className="mt-4 border border-slate-800 bg-[#070d15] px-4 py-3">
                    <p className="flex items-center gap-2 text-xs font-semibold text-white">
                      <Search className="h-3.5 w-3.5 text-cyan" aria-hidden="true" />
                      Fastest manual route — search inside {ideName}
                    </p>
                    <p className="mt-1.5 text-xs leading-5 text-slate-300">
                      Open the Extensions view (<kbd className="border border-slate-700 bg-slate-800 px-1 font-mono text-[10px] text-white">Ctrl</kbd>
                      +<kbd className="border border-slate-700 bg-slate-800 px-1 font-mono text-[10px] text-white">Shift</kbd>
                      +<kbd className="border border-slate-700 bg-slate-800 px-1 font-mono text-[10px] text-white">X</kbd>) and search for{' '}
                      <strong className="text-white">{searchName}</strong> — publisher{' '}
                      <code className="text-cyan">soterai</code>, extension id{' '}
                      <code className="text-cyan">{extensionId}</code>.
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <p className="text-[11px] text-slate-400">
                      Still stuck? {ideName} may not be installed on this device yet.
                    </p>
                    <button
                      type="button"
                      onClick={close}
                      className="inline-flex min-h-9 shrink-0 items-center justify-center border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 hover:text-white"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}