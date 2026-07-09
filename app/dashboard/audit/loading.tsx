export default function AuditLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-28 rounded bg-white/5" />
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-16 rounded-xl bg-white/5" />
      ))}
    </div>
  )
}