"use client";

import { AlertTriangle, RotateCw } from "lucide-react";
import { signOut } from "next-auth/react";

function getDisplayMessage(message: string): { text: string; isAuthError: boolean } {
  const lower = message.toLowerCase();
  if (lower.includes("session") || lower.includes("sign in")) {
    return { text: "Your session has expired. Please sign in again.", isAuthError: true };
  }
  if (lower.includes("not found")) {
    return { text: "The requested resource was not found.", isAuthError: false };
  }
  if (lower.includes("permission") || lower.includes("forbidden")) {
    return { text: "You don't have permission to access this.", isAuthError: false };
  }
  return { text: "Something went wrong. Please try again.", isAuthError: false };
}

export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  const { text, isAuthError } = getDisplayMessage(error.message);
  return (
    <div className="container-page py-16">
      <div className="card mx-auto max-w-xl p-8" role="alert">
        <div className="flex items-start gap-4">
          <span className="rounded-xl bg-red-500/15 p-3 text-red-300"><AlertTriangle /></span>
          <div className="min-w-0">
            <h1 autoFocus className="text-xl font-bold">This dashboard view ran into an error.</h1>
            <p className="mt-2 break-words text-sm text-slate-400">{text}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              {isAuthError ? (
                <button onClick={() => signOut({ callbackUrl: "/signin" })} className="button-primary">Sign in again</button>
              ) : null}
              <button onClick={reset} className="button-secondary gap-2"><RotateCw size={16} /> Retry</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
