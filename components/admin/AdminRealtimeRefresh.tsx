"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Radio, RefreshCw } from "lucide-react";

export function AdminRealtimeRefresh({ intervalMs = 15000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [seconds, setSeconds] = useState(Math.round(intervalMs / 1000));

  function refresh() {
    setSeconds(Math.round(intervalMs / 1000));
    startTransition(() => router.refresh());
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSeconds((current) => {
        if (current <= 1) {
          return Math.round(intervalMs / 1000);
        }
        return current - 1;
      });
    }, 1000);
    const refreshTimer = window.setInterval(() => {
      startTransition(() => router.refresh());
    }, intervalMs);

    return () => {
      window.clearInterval(timer);
      window.clearInterval(refreshTimer);
    };
  }, [intervalMs, router, startTransition]);

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-200">
      <span className="inline-flex h-9 items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 text-emerald-200">
        <Radio size={14} className="text-emerald-300" />
        Live
        <span className="font-mono text-emerald-100">{seconds}s</span>
      </span>
      <button
        type="button"
        onClick={refresh}
        title="Refresh dashboard"
        aria-label="Refresh dashboard"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-700 bg-slate-900/70 text-slate-200 transition hover:border-cyan/60 hover:text-cyan"
      >
        <RefreshCw size={15} className={isPending ? "animate-spin" : ""} />
      </button>
    </div>
  );
}
