export default function AuditLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-28 rounded bg-slate-800/60" />
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-16 rounded-xl bg-slate-800/60" />
      ))}
    </div>
  )
}