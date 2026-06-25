"use client";
import { useState } from "react";
import { MessageSquare, X } from "lucide-react";

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);

  async function submit(formData: FormData) {
    const response = await fetch("/api/ops/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: "INTEGRATION_HELP",
        priority: "NORMAL",
        subject: "In-app product feedback",
        message: formData.get("message"),
      }),
    });
    setOk(response.ok);
    setMessage(response.ok ? "Feedback sent to support." : "Feedback could not be sent.");
  }

  return (
    // Bottom-most button in the vertical floating stack (bottom-5).
    // AI Help sits above at bottom-[72px], Tour at bottom-[132px].
    <div className="fixed bottom-5 right-5 z-50">
      {/* Toggle button — shows X when open, MessageSquare when closed */}
      <button
        type="button"
        title={open ? "Close feedback" : "Send feedback"}
        aria-label={open ? "Close feedback" : "Send feedback"}
        onClick={() => {
          setOpen(!open);
          // Reset status message when reopening
          if (open) { setMessage(""); setOk(false); }
        }}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-cyan text-ink shadow-glow transition hover:scale-105 hover:bg-cyan/90"
      >
        {open ? <X size={19} /> : <MessageSquare size={19} />}
      </button>

      {/* Feedback panel — opens above the button */}
      {open && (
        <form
          action={submit}
          className="absolute bottom-14 right-0 w-80 max-w-[calc(100vw-2.5rem)] rounded-2xl border border-slate-700 bg-panel p-4 shadow-2xl shadow-black/40 backdrop-blur-xl"
        >
          {/* Panel header with title + close button */}
          <div className="mb-3 flex items-center justify-between">
            <label htmlFor="feedback-message" className="font-semibold text-white">
              Product feedback
            </label>
            <button
              type="button"
              aria-label="Close feedback"
              onClick={() => { setOpen(false); setMessage(""); setOk(false); }}
              className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>

          <textarea
            id="feedback-message"
            name="message"
            required
            minLength={10}
            className="input min-h-24 w-full"
            placeholder="Share feedback without credentials or raw sensitive data."
          />
          <button className="button-primary mt-3 w-full !py-2">Send</button>
          {message && (
            <p
              role="status"
              aria-live="polite"
              className={`mt-2 text-xs ${ok ? "text-cyan" : "text-red-300"}`}
            >
              {message}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
