"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";

export function SignUpForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
          name: form.get("name") || undefined,
          organizationName: form.get("organizationName") || undefined,
          organizationType: form.get("organizationType") || "DIRECT_BUSINESS",
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "Could not sign up.");
        setLoading(false);
        return;
      }
      const signInResult = await signIn("credentials", {
        email: form.get("email"),
        password: form.get("password"),
        redirect: false,
      });
      if (!signInResult || signInResult.error) {
        setError("Account created but auto sign-in failed. Try signing in manually.");
        setLoading(false);
        return;
      }
      router.push("/dashboard/onboarding");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign up.");
      setLoading(false);
    }
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
