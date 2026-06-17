"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2, LogIn } from "lucide-react";

function authErrorMessage(error?: string) {
  if (!error) return "";
  if (error === "CredentialsSignin") return "Email or password is incorrect, or the account email is not verified.";
  return "Could not sign in. Please try again.";
}

function safeCallbackUrl(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

export function SignInForm({ callbackUrl, initialError }: { callbackUrl: string; initialError?: string }) {
  const router = useRouter();
  const [error, setError] = useState(authErrorMessage(initialError));
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const form = new FormData(event.currentTarget);
      const result = await signIn("credentials", {
        email: form.get("email"),
        password: form.get("password"),
        redirect: false,
      });
      if (!result || result.error) {
        setError(authErrorMessage(result?.error) || "Email or password is incorrect.");
        return;
      }
      router.push(safeCallbackUrl(callbackUrl));
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="input" placeholder="you@example.com" />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required minLength={8} className="input" placeholder="At least 8 characters" />
      </div>
      <button disabled={loading} className="button-primary w-full gap-2">
        {loading ? <Loader2 className="animate-spin" size={16} /> : <LogIn size={16} />}
        {loading ? "Signing in..." : "Sign in"}
      </button>
      {error && <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
    </form>
  );
  
}
