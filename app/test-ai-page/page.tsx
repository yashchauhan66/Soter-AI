"use client";

import { useState } from "react";
import type { FormEvent } from "react";

const fakeSensitiveResponse = "Debug note: API_KEY=synthetic_api_key_value should never be exposed in an AI response.";

export default function TestAIPage() {
  const [response, setResponse] = useState("No response yet.");
  const [lastPrompt, setLastPrompt] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const prompt = String(formData.get("prompt") ?? "");
    setLastPrompt(prompt);
    setResponse("Mock response received. This local page did not contact an AI provider.");
  }

  function handleContenteditableSubmit() {
    const value = document.querySelector<HTMLElement>("[data-mock-contenteditable]")?.innerText ?? "";
    setLastPrompt(value);
    setResponse("Mock contenteditable response received.");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100">
      <section className="mx-auto max-w-5xl space-y-8">
        <header className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wider text-cyan">Soter local test surface</p>
          <h1 className="text-3xl font-bold">Mock AI Page</h1>
          <p className="max-w-3xl text-sm text-slate-400">
            Local textarea, contenteditable, file upload, and fake response area for browser-extension smoke testing.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block text-sm font-medium" htmlFor="mock-prompt">
            Prompt textarea
          </label>
          <textarea
            id="mock-prompt"
            name="prompt"
            className="min-h-40 w-full rounded-md border border-slate-700 bg-slate-900 p-4 text-sm outline-none focus:border-cyan"
            placeholder="Paste a fake prompt here"
          />
          <div className="flex flex-wrap gap-3">
            <button className="rounded-md bg-cyan px-4 py-2 text-sm font-semibold text-slate-950" type="submit">
              Send
            </button>
            <label className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200">
              Upload file
              <input className="sr-only" multiple type="file" />
            </label>
          </div>
        </form>

        <section className="space-y-3">
          <label className="block text-sm font-medium" htmlFor="mock-editable">
            Contenteditable input
          </label>
          <div
            id="mock-editable"
            data-mock-contenteditable
            contentEditable
            suppressContentEditableWarning
            className="min-h-28 rounded-md border border-slate-700 bg-slate-900 p-4 text-sm outline-none focus:border-cyan"
          />
          <button className="rounded-md bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-950" onClick={handleContenteditableSubmit} type="button">
            Send Contenteditable
          </button>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <button className="rounded-md border border-slate-700 px-4 py-2 text-sm" onClick={() => setResponse("Clean mock response with no sensitive data.")} type="button">
              Show Clean Response
            </button>
            <button className="rounded-md border border-rose-500 px-4 py-2 text-sm text-rose-200" onClick={() => setResponse(fakeSensitiveResponse)} type="button">
              Show Fake Sensitive Response
            </button>
          </div>
          <div className="rounded-md border border-slate-800 bg-slate-900 p-4">
            <h2 className="text-sm font-semibold">Fake AI response</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm text-slate-300">{response}</p>
          </div>
        </section>

        <section className="rounded-md border border-slate-800 bg-slate-900 p-4">
          <h2 className="text-sm font-semibold">Last mock prompt seen by page</h2>
          <p className="mt-3 min-h-6 whitespace-pre-wrap text-xs text-slate-500">{lastPrompt || "None"}</p>
        </section>
      </section>
    </main>
  );
}
