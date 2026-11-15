"use client";

import { useState, type ComponentType } from "react";
import { Bot, Loader2 } from "lucide-react";

// The assistant is non-critical. Import its chat state and markdown renderer
// only when its own control is activated, not on idle, scroll or unrelated input.
// This keeps the chunk from competing with marketing render and hydration.
export function AiAssistantLoader() {
  const [Loaded, setLoaded] = useState<ComponentType<{ initialOpen?: boolean }> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function activate() {
    if (loading) return;
    setLoading(true);
    setError(false);
    try {
      const assistantExports = await import("./AiAssistant");
      setLoaded(() => assistantExports.AiAssistant);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  if (Loaded) return <Loaded initialOpen />;
  return (
    <div className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
      {error && <p role="status" className="mb-2 max-w-60 rounded-lg border border-slate-700 bg-panel p-3 text-sm text-slate-200">Assistant could not load. Use the button to try again.</p>}
      <button type="button" onClick={activate} disabled={loading} aria-busy={loading} aria-label={loading ? "Loading AI assistant" : "Open AI assistant"} className="flex h-12 w-12 items-center justify-center rounded-full border border-cyan bg-cyan text-white shadow-elevation-2 transition-colors hover:bg-cyan-press disabled:opacity-60">
        {loading ? <Loader2 size={22} aria-hidden="true" className="animate-spinner" /> : <Bot size={22} aria-hidden="true" />}
      </button>
    </div>
  );
}
