"use client";

import { Shield } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function RunRedTeamButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ jobId?: string; runId?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/redteam/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, confirmed: true }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "Failed to start red-team run.");
      } else {
        setResult(data);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        className="inline-flex items-center gap-2 rounded-xl bg-cyan px-4 py-2 text-sm font-semibold text-black transition hover:bg-cyan/90 disabled:opacity-50"
        type="button"
        disabled={loading}
        onClick={handleRun}
      >
        <Shield size={16} />
        {loading ? "Starting..." : "Run red-team test"}
      </button>
      {result && (
        <p className="mt-2 text-xs text-emerald-400">
          Run started (job: {result.jobId ?? "pending"}).
        </p>
      )}
      {error && (
        <p className="mt-2 text-xs text-rose-400">{error}</p>
      )}
    </div>
  );
}
