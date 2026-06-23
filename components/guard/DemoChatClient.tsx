"use client";

import { useState } from "react";
import type { GuardResult } from "@/lib/guard/types";
import { RiskBadge } from "./RiskBadge";

export function DemoChatClient() {
  const [message, setMessage] = useState("My email is arjun@example.com. Can you help update my profile?");
  const [result, setResult] = useState<GuardResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function send() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/guard/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message, direction: "INPUT" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? data.reason ?? "Guard comparison failed.");
      setResult(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Guard comparison failed.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  const unguardedReply = /system prompt|hidden prompt/i.test(message)
    ? "A chatbot without a gateway may try to answer this control-extraction request."
    : `Thanks. I received: "${message}"`;

  return (
    <div>
      <div className="card mx-auto max-w-3xl p-5">
        <textarea className="input min-h-28" maxLength={8000} value={message} onChange={(event) => setMessage(event.target.value)} />
        <button className="button-primary mt-3 w-full" onClick={send} disabled={loading || !message.trim()}>
          {loading ? "Checking..." : "Compare responses"}
        </button>
        {error && <p className="mt-3 rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
      </div>
      {result && (
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <article className="card border-red-500/20 p-6">
            <p className="text-xs font-bold uppercase tracking-wider text-red-300">Without guard</p>
            <h2 className="mt-3 text-xl font-semibold">Unfiltered simulation</h2>
            <p className="mt-5 rounded-xl bg-slate-950/60 p-4 leading-7 text-slate-300">{unguardedReply}</p>
            <p className="mt-4 text-sm text-slate-500">Illustrative only. No external model is called.</p>
          </article>
          <article className="card border-cyan/30 p-6">
            <div className="flex justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-cyan">With SoterAI</p>
                <h2 className="mt-3 text-xl font-semibold">Policy-aware path</h2>
              </div>
              <RiskBadge action={result.action} />
            </div>
            <p className="mt-5 rounded-xl bg-slate-950/60 p-4 leading-7 text-slate-300">
              {result.allowed ? `Protected input: "${result.safeText}"` : result.reason}
            </p>
            <p className="mt-4 text-sm font-semibold text-cyan">
              {result.action === "BLOCK"
                ? result.riskTypes.includes("SYSTEM_PROMPT_LEAK_ATTEMPT")
                  ? "System prompt leak attempt blocked"
                  : "Prompt injection blocked"
                : result.action === "ALLOW_WITH_REDACTION"
                  ? "PII or sensitive data redacted"
                  : result.action === "REWRITE"
                    ? "Risky instruction removed"
                    : result.action === "HUMAN_REVIEW"
                      ? "Held for human review"
                    : "Message allowed"}
            </p>
          </article>
        </div>
      )}
    </div>
  );
}
