"use client"

import { useEffect } from "react"
import Link from "next/link"

export default function AgentControlError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 text-4xl">⚠️</div>
      <h2 className="mb-2 text-xl font-semibold text-white">Something went wrong</h2>
      <p className="mb-6 max-w-md text-sm text-slate-400">
        An unexpected error occurred. Please try again or contact support if the issue persists.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-xl bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-500/20"
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="rounded-xl bg-white/5 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/10"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}