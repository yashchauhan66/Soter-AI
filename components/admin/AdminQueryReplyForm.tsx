"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, Send } from "lucide-react";

type QueryKind = "contact" | "pilot" | "support";

export function AdminQueryReplyForm({
  kind,
  id,
  to,
  defaultSubject,
}: {
  kind: QueryKind;
  id: string;
  to: string;
  defaultSubject: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  async function submit(formData: FormData) {
    setMessage("");
    const response = await fetch("/api/admin/queries/reply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind,
        id,
        subject: String(formData.get("subject") ?? ""),
        body: String(formData.get("body") ?? ""),
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.message ?? "Email could not be sent.");
      return;
    }
    setMessage(`Sent to ${to}`);
    startTransition(() => router.refresh());
  }

  return (
    <form action={submit} className="mt-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
        <Mail size={14} />
        <span className="truncate">{to}</span>
      </div>
      <input name="subject" className="input py-2 text-sm" defaultValue={defaultSubject} maxLength={160} required />
      <textarea
        name="body"
        className="input mt-2 min-h-28 resize-y text-sm"
        placeholder="Write a helpful reply..."
        minLength={5}
        maxLength={5000}
        required
      />
      <button disabled={isPending} className="button-primary mt-2 w-full gap-2 py-2 text-sm">
        <Send size={15} />
        {isPending ? "Sending..." : "Send email"}
      </button>
      {message && <p className="mt-2 text-xs text-cyan">{message}</p>}
    </form>
  );
}
