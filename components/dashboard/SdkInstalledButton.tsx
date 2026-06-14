"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SdkInstalledButton({ done }: { done: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function mark() {
    setLoading(true);
    try {
      await fetch("/api/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "sdkInstalled", value: !done }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={mark}
      disabled={loading}
      className="button-secondary !px-4 !py-2 text-sm"
    >
      {loading ? "..." : done ? "Unmark" : "Mark installed"}
    </button>
  );
}
