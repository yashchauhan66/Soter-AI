"use client";

import { AlertTriangle, RotateCw } from "lucide-react";

export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="container-page py-16">
      <div className="card mx-auto max-w-xl p-8">
        <div className="flex items-start gap-4">
          <span className="rounded-xl bg-red-500/15 p-3 text-red-300"><AlertTriangle /></span>
          <div className="min-w-0">
            <h1 className="text-xl font-bold">This dashboard view ran into an error.</h1>
            <p className="mt-2 break-words text-sm text-slate-400">{error.message}</p>
            <button onClick={reset} className="button-primary mt-5 gap-2"><RotateCw size={16} /> Retry</button>
          </div>
        </div>
      </div>
    </div>
  );
}
