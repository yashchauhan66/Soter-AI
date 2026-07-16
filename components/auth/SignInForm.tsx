"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, LogIn } from "lucide-react";

function authErrorMessage(error?: string) {
  if (!error) return "";
  if (error === "CredentialsSignin") return "Email or password is incorrect, or the account email is not verified.";
  return "Could not sign in. Please try again.";
}

// Client-side input validation so obviously-bad input is caught before a
// network round-trip and the user gets a specific, actionable message instead
// of a generic "incorrect" from the server. The server (zod in auth.ts) remains
// the source of truth; this is a UX layer, not a security boundary.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateCredentials(email: string, password: string) {
  if (!email) return "Please enter your email address.";
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return "Please enter a valid email address.";
  if (!password) return "Please enter your password.";
  if (password.length < 8) return "Password must be at least 8 characters.";
  return "";
}

function safeCallbackUrl(value: string) {
  if (!value) return "/dashboard";
  try {
    const decoded = decodeURIComponent(value).trim();
    if (!decoded.startsWith("/") || decoded.startsWith("//")) return "/dashboard";
    if (decoded.includes("\\") || /[\u0000-\u001f]/.test(decoded)) return "/dashboard";
    return decoded;
  } catch {
    return "/dashboard";
  }
}

export function SignInForm({ callbackUrl, initialError, initialNotice }: { callbackUrl: string; initialError?: string; initialNotice?: string }) {
  const router = useRouter();
  const [error, setError] = useState(authErrorMessage(initialError));
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const form = new FormData(event.currentTarget);
      const email = String(form.get("email") ?? "").trim().toLowerCase();
      const password = String(form.get("password") ?? "");
      const validationError = validateCredentials(email, password);
      if (validationError) {
        setError(validationError);
        return;
      }
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (!result || result.error) {
        setError(authErrorMessage(result?.error) || "Email or password is incorrect.");
        return;
      }
      router.push(safeCallbackUrl(callbackUrl));
      router.refresh();
    } catch {
      // Network/offline: no response ever arrived. Show an actionable message
      // instead of a raw "Failed to fetch".
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} className="input" placeholder="you@example.com" />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required minLength={8} maxLength={200} className="input" placeholder="At least 8 characters" />
      </div>
      <div className="text-right text-sm">
        <Link href="/forgot-password" className="text-cyan hover:text-cyan/80">
          Forgot password?
        </Link>
      </div>
      <button disabled={loading} className="button-primary w-full gap-2">
        {loading ? <Loader2 className="animate-spin" size={16} /> : <LogIn size={16} />}
        {loading ? "Signing in..." : "Sign in"}
      </button>
      {initialNotice && <p role="status" className="rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-300">{initialNotice}</p>}
      {error && (
        <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300">
          {error}{" "}
          <Link href="/forgot-password" className="font-medium text-cyan hover:text-cyan/80">
            Reset your password
          </Link>
        </p>
      )}
    </form>
  );
  
}
