"use client";
import { useState } from "react";
export function FeedbackButtons({ guardLogId }: { guardLogId: string }) {
  const [saved, setSaved] = useState("");
  async function submit(feedback: "FALSE_POSITIVE" | "FALSE_NEGATIVE" | "CORRECT") { const response = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ guardLogId, feedback }) }); setSaved(response.ok ? "Saved" : "Failed"); }
  return <div><p className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-500">Detection feedback</p><div className="mt-2 flex flex-wrap gap-2"><button onClick={() => submit("FALSE_POSITIVE")} className="button-secondary !px-2 !py-1 text-xs">Incorrect block</button><button onClick={() => submit("FALSE_NEGATIVE")} className="button-secondary !px-2 !py-1 text-xs">Missed risk</button><button onClick={() => submit("CORRECT")} className="button-secondary !px-2 !py-1 text-xs">Correct</button>{saved && <span className="text-xs text-cyan">{saved}</span>}</div></div>;
}
