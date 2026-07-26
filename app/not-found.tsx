"use client";

import Link from "next/link";
import { Home, ArrowLeft } from "lucide-react";

export default function NotFoundPage() {
  return (
    <main className="container-page flex min-h-[70vh] items-center justify-center py-16">
      <div className="mx-auto max-w-lg text-center">
        {/* Large 404 */}
        <p className="text-[120px] font-black leading-none text-slate-800 select-none">
          404
        </p>

        <h1 className="mt-4 text-2xl font-bold text-slate-200">
          Page not found
        </h1>

        <p className="mt-3 text-slate-400 leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          Check the URL or navigate back to a known section.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/dashboard"
            className="button-primary gap-2"
          >
            <Home size={16} />
            Go to dashboard
          </Link>

          <button
            type="button"
            onClick={() => window.history.back()}
            className="button-secondary gap-2"
          >
            <ArrowLeft size={16} />
            Go back
          </button>
        </div>

        <div className="mt-10">
          <p className="text-xs text-slate-600">
            Need help?{" "}
            <Link
              href="/docs"
              className="text-cyan hover:underline"
            >
              Browse documentation
            </Link>
            {" "}or{" "}
            <Link
              href="/dashboard/support"
              className="text-cyan hover:underline"
            >
              contact support
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
