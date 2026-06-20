/**
 * Skeleton components for loading states.
 * Uses the .animate-shimmer CSS class for a subtle gradient shimmer effect.
 */

// ── Skeleton base ─────────────────────────────────────────────────
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-shimmer rounded-xl ${className}`} />;
}

// ── SkeletonCard ──────────────────────────────────────────────────
export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`card animate-shimmer overflow-hidden border-slate-800/50 p-5 ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-20" />
        </div>
        <Skeleton className="h-10 w-10 rounded-xl" />
      </div>
    </div>
  );
}

// ── SkeletonTable ─────────────────────────────────────────────────
export function SkeletonTable({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="card overflow-hidden p-5">
      <Skeleton className="mb-4 h-5 w-40" />
      <div className="space-y-4">
        {/* Header */}
        <div className="flex gap-6">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-3 flex-1" />
          ))}
        </div>
        {/* Rows */}
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-6">
            {Array.from({ length: cols }).map((_, j) => (
              <Skeleton key={j} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SkeletonFeatureGrid ───────────────────────────────────────────
export function SkeletonFeatureGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card animate-shimmer overflow-hidden border-slate-800/50 p-4">
          <div className="flex items-start gap-3">
            <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-44" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── SkeletonDashboard ─────────────────────────────────────────────
export function SkeletonDashboard() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-10 w-full max-w-xl rounded-xl" />
      </div>

      {/* Health cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      {/* Quick actions */}
      <div className="card animate-shimmer overflow-hidden border-slate-800/50 p-5">
        <Skeleton className="mb-4 h-4 w-28" />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>

      {/* Activity + Sidebar */}
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <SkeletonTable rows={4} cols={5} />
        <div className="space-y-6">
          <SkeletonCard />
          <div className="card animate-shimmer overflow-hidden border-slate-800/50 p-5">
            <Skeleton className="mb-4 h-5 w-24" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        </div>
      </div>

      {/* Feature grid */}
      <div>
        <Skeleton className="mb-6 h-6 w-32" />
        <SkeletonFeatureGrid count={8} />
      </div>
    </div>
  );
}
