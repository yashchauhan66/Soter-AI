export default function DashboardLoading() {
  return (
    <div className="container-page py-12">
      <div className="grid gap-7 lg:grid-cols-[240px_1fr]">
        <div className="card h-72 animate-pulse" />
        <div className="space-y-4">
          <div className="h-9 w-64 animate-pulse rounded-xl bg-slate-800" />
          <div className="h-4 w-96 animate-pulse rounded-xl bg-slate-800" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="card h-32 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
