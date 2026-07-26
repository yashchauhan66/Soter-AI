"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RefreshCw, Home, AlertTriangle } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Log the error to the console in development only
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.error("[SoterAI] Page error:", error);
    }
  }, [error]);

  return (
    <main className="container-page flex min-h-[70vh] items-center justify-center py-16">
      <div className="mx-auto max-w-lg text-center">
        {/* Icon */}
        <span className="inline-flex rounded-2xl bg-red-500/10 p-4 text-red-400">
          <AlertTriangle size={40} />
        </span>

        <h1 className="mt-5 text-2xl font-bold text-slate-200">
          Something went wrong
        </h1>

        <p className="mt-3 text-slate-400 leading-relaxed">
          The request could not be completed. No stack trace or server detail has been exposed.
          {error.digest && (
            <span className="mt-2 block font-mono text-xs text-slate-600">
              Reference: {error.digest}
            </span>
          )}
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => reset()}
            className="button-primary gap-2"
          >
            <RefreshCw size={16} />
            Try again
          </button>

          <Link
            href="/dashboard"
            className="button-secondary gap-2"
          >
            <Home size={16} />
            Go to dashboard
          </Link>
        </div>

        <p className="mt-10 text-xs text-slate-600">
          If the problem persists,{" "}
          <Link
            href="/dashboard/support"
            className="text-cyan hover:underline"
          >
            contact support
          </Link>
          {" "}with the reference above.
        </p>
      </div>
    </main>
  );
}
