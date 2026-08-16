'use client';

import { Check, Copy, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

type CopyState = 'idle' | 'copied' | 'failed';

export function CopyInstallCommand({ command }: { command: string }) {
  const [state, setState] = useState<CopyState>('idle');
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(command);
      setState('copied');
    } catch {
      setState('failed');
    }

    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setState('idle'), 2200);
  }, [command]);

  const label = state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy';
  const Icon = state === 'copied' ? Check : state === 'failed' ? TriangleAlert : Copy;

  return (
    <div className="flex min-w-0 items-center border border-slate-700 bg-[#070d15]">
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap px-3 py-2.5 text-xs text-slate-300">
        {command}
      </code>
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex h-9 min-w-9 shrink-0 items-center justify-center gap-1.5 border-l border-slate-700 px-2.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
        aria-label={`${label} install command`}
        title={`${label} install command`}
      >
        <Icon
          className={state === 'failed' ? 'h-3.5 w-3.5 text-amber-400' : 'h-3.5 w-3.5 text-cyan'}
          aria-hidden="true"
        />
        <span className="hidden sm:inline">{label}</span>
      </button>
      <span className="sr-only" aria-live="polite">
        {state === 'copied' ? 'Install command copied to clipboard.' : null}
        {state === 'failed'
          ? 'Could not copy the install command. Select the command manually.'
          : null}
      </span>
    </div>
  );
}
