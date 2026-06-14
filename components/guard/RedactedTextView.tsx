export function RedactedTextView({ text }: { text?: string }) {
  if (!text) return null;
  return <div><p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Safe / redacted text</p><pre className="whitespace-pre-wrap break-words rounded-xl border border-slate-800 bg-slate-950/70 p-4 font-mono text-sm leading-6 text-slate-300">{text}</pre></div>;
}
