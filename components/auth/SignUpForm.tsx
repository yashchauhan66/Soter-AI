"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, UserPlus } from "lucide-react";

type SignupSuccess = {
  email: string;
  verificationEmailFailed: boolean;
  developmentVerificationUrl?: string;
};

export function SignUpForm() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<SignupSuccess | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(null);
    try {
      const form = new FormData(event.currentTarget);
      const email = String(form.get("email") ?? "");
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password: form.get("password"),
          name: form.get("name") || undefined,
          organizationName: form.get("organizationName") || undefined,
          organizationType: form.get("organizationType") || "DIRECT_BUSINESS",
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "Could not sign up.");
        return;
      }
      setSuccess({
        email,
        verificationEmailFailed: Boolean(data.verificationEmailFailed),
        developmentVerificationUrl: data.developmentVerificationUrl,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign up.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="mt-6 rounded-xl border border-cyan/25 bg-cyan/10 p-4 text-sm text-slate-200">
        <p className="font-semibold text-cyan">Account created. Verify your email to sign in.</p>
        <p className="mt-2 text-slate-300">
          {success.verificationEmailFailed
            ? `We could not send the verification email to ${success.email}. Check email settings, then request a new verification email.`
            : `We sent a verification link to ${success.email}. Open it, then come back to sign in.`}
        </p>
        {success.developmentVerificationUrl ? (
          <Link className="mt-4 inline-flex text-cyan hover:underline" href={success.developmentVerificationUrl}>
            Open development verification link
          </Link>
        ) : null}
        <Link className="button-primary mt-4 w-full" href="/signin">
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium" htmlFor="name">Your name</label>
        <input id="name" name="name" autoComplete="name" maxLength={120} className="input" placeholder="Priya Sharma" />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="input" placeholder="you@example.com" />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={200} className="input" placeholder="Minimum 8 characters" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium" htmlFor="organizationName">Workspace name</label>
          <input id="organizationName" name="organizationName" maxLength={120} className="input" placeholder="Acme Corp" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium" htmlFor="organizationType">Workspace type</label>
          <select id="organizationType" name="organizationType" defaultValue="DIRECT_BUSINESS" className="input">
            <option value="DIRECT_BUSINESS">Direct business</option>
            <option value="AGENCY">Agency</option>
          </select>
        </div>
      </div>
      <button disabled={loading} className="button-primary w-full gap-2">
        {loading ? <Loader2 className="animate-spin" size={16} /> : <UserPlus size={16} />}
        {loading ? "Creating..." : "Create account"}
      </button>
      {error && <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
    </form>
  );
}
