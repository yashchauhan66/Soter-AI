import { SkeletonDashboard } from "@/components/ui/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="container-page py-8">
      <div className="grid gap-7 lg:grid-cols-[240px_1fr]">
        <aside className="card h-fit animate-shimmer overflow-hidden border-slate-800/50 p-3">
          <div className="mb-3 space-y-3 px-3 py-3">
            <div className="h-3 w-20 rounded-xl bg-slate-800" />
            <div className="h-4 w-28 rounded-xl bg-slate-800" />
          </div>
          {/* Sidebar skeleton items */}
          <div className="space-y-5">
            {[1, 2, 3].map((group) => (
              <div key={group} className="px-3">
                <div className="mb-2 h-2.5 w-14 rounded-xl bg-slate-800" />
                <div className="space-y-1">
                  {Array.from({ length: 4 }).map((_, item) => (
                    <div key={item} className="h-9 rounded-xl bg-slate-800/60" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>
        <section className="min-w-0">
          <SkeletonDashboard />
        </section>
      </div>
    </div>
  );
}
