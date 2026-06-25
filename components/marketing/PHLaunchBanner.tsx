"use client";

import { useState, useEffect } from "react";
import { ExternalLink, Rocket, X } from "lucide-react";

const LAUNCH_DATE = new Date("2026-06-30T00:01:00-07:00"); // 12:01 AM PT
const PH_URL = "https://www.producthunt.com";

function getTimeLeft(now: Date) {
  const diff = LAUNCH_DATE.getTime() - now.getTime();
  if (diff <= 0) return null;

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  return { days, hours, minutes, seconds };
}

export function PHLaunchBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(getTimeLeft(new Date()));
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setMounted(true);
      setTimeLeft(getTimeLeft(new Date()));
    });

    const timer = setInterval(() => {
      setTimeLeft(getTimeLeft(new Date()));
    }, 1000);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(timer);
    };
  }, []);

  if (dismissed || !mounted || !timeLeft) return null;

  return (
    <div className="relative border-b border-cyan-900/50 bg-gradient-to-r from-cyan-950/80 via-slate-950 to-cyan-950/80">
      <div className="container-page flex items-center justify-between py-2.5">
        <div className="flex items-center gap-2 text-sm">
          <Rocket size={16} className="text-cyan" />
          <span className="hidden sm:inline text-slate-300">
            🚀 Launching on <strong className="text-cyan">Product Hunt</strong>
          </span>
          <span className="sm:hidden text-slate-300">
            🚀 PH Launch
          </span>
          <span className="text-cyan font-mono font-bold tabular-nums">
            {timeLeft.days > 0 && `${timeLeft.days}d `}
            {String(timeLeft.hours).padStart(2, "0")}h {String(timeLeft.minutes).padStart(2, "0")}m {String(timeLeft.seconds).padStart(2, "0")}s
          </span>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={PH_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-md bg-cyan px-3 py-1 text-xs font-semibold text-ink transition hover:bg-cyan/90"
          >
            Follow us <ExternalLink size={12} />
          </a>
          <button
            onClick={() => setDismissed(true)}
            className="rounded-md p-1 text-slate-500 transition hover:bg-slate-800 hover:text-slate-300"
            aria-label="Dismiss banner"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
