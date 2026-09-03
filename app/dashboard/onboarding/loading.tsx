export default function OnboardingLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-32 rounded bg-slate-800/60" />
      <div className="h-48 rounded-2xl bg-slate-800/60" />
      <div className="grid gap-4 sm:grid-cols-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-slate-800/60" />
        ))}
      </div>
    </div>
  )
}