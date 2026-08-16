import Link from "next/link";
import { Compass, ArrowLeft, LayoutDashboard, BookOpen } from "lucide-react";

/**
 * Branded 404. Without this file, unmatched routes render Next.js's default
 * unstyled 404, which is a jarring dead-end. This gives the user orientation and
 * three real ways forward (home, dashboard, docs).
 */
export default function NotFound() {
  return (
    <main className="container-page flex min-h-[70vh] flex-col items-center justify-center py-24 text-center">
      <span className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan/10 text-cyan">
        <Compass size={30} />
      </span>
      <p className="eyebrow">Error 404</p>
      <h1 className="mt-2 text-3xl font-bold">This page doesn&apos;t exist</h1>
      <p className="mx-auto mt-3 max-w-md text-slate-200">
        The link may be outdated or the page may have moved. Here are a few places that do exist.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link href="/" className="button-primary inline-flex items-center gap-2">
          <ArrowLeft size={16} /> Back to home
        </Link>
        <Link href="/dashboard" className="button-secondary inline-flex items-center gap-2">
          <LayoutDashboard size={16} /> Go to dashboard
        </Link>
        <Link href="/docs" className="button-secondary inline-flex items-center gap-2">
          <BookOpen size={16} /> Read the docs
        </Link>
      </div>
    </main>
  );
}
