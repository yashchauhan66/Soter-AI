"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ClientProjectActions({ projectId, badgeEnabled }: { projectId: string; badgeEnabled: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggleBadge() {
    setLoading(true);
    try {
      await fetch("/api/projects/badge", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: projectId, badgeEnabled: !badgeEnabled }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggleBadge}
      disabled={loading}
      className="rounded-md border border-slate-700 px-3 py-1.5 text-slate-300 hover:border-cyan/50"
    >
      {loading ? "..." : badgeEnabled ? "Disable badge" : "Enable badge"}
    </button>
  );
}
