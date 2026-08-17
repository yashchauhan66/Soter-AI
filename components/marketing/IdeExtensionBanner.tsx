import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

export function IdeExtensionBanner() {
  return (
    <div className="relative border-b border-emerald-900/40 bg-gradient-to-r from-emerald-950/70 via-slate-950 to-emerald-950/70">
      <div className="container-page flex flex-wrap items-center justify-center gap-x-3 gap-y-1 py-2.5 sm:justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Sparkles size={16} className="shrink-0 text-emerald-300" aria-hidden="true" />
          <p className="text-slate-200">
            <span className="font-semibold text-emerald-300">Free IDE extension</span> for
            risk-free vibe coding — keep secrets out of AI.
          </p>
        </div>
        <Link
          href="/extensions/ide"
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-400 px-3 py-1 text-xs font-semibold text-ink transition hover:bg-emerald-300"
        >
          Get SoterAI IDE Guard <ArrowRight size={12} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}