"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Loader2, UserPlus } from "lucide-react";
import { VerifyEmailOtpForm } from "./VerifyEmailOtpForm";

type SignupSuccess = {
  email: string;
  password: string;
  emailSent: boolean;
  developmentOtp?: string;
};

export function SignUpForm() {
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<SignupSuccess | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(null);
    setNotice("");
    try {
      const form = new FormData(event.currentTarget);
      const email = String(form.get("email") ?? "");
      const password = String(form.get("password") ?? "");
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
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
      if (data.verificationRequired) {
        setSuccess({
          email,
          password,
          emailSent: data.emailSent !== false,
          developmentOtp: data.developmentOtp,
        });
        return;
      }
      const signInResult = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (!signInResult || signInResult.error) {
        setNotice("Account created. Please sign in with your new credentials.");
      } else {
        window.location.assign("/dashboard");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign up.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <VerifyEmailOtpForm
        email={success.email}
        initialEmailSent={success.emailSent}
        initialDevelopmentOtp={success.developmentOtp}
        onSuccess={async () => {
          const result = await signIn("credentials", {
            email: success.email,
            password: success.password,
            redirect: false,
          });
          if (result?.error) {
            window.location.assign("/signin?verified=1");
            return;
          }
          window.location.assign("/dashboard/onboarding");
        }}
      />
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium" htmlFor="name">
          Your name
        </label>
        <input id="name" name="name" autoComplete="name" maxLength={120} className="input" placeholder="Priya Sharma" />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium" htmlFor="email">
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required className="input" placeholder="you@example.com" />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={200}
          className="input"
          placeholder="Minimum 8 characters"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium" htmlFor="organizationName">
            Workspace name
          </label>
          <input id="organizationName" name="organizationName" maxLength={120} className="input" placeholder="Acme Corp" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium" htmlFor="organizationType">
            Workspace type
          </label>
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
      {notice && <p className="rounded-xl bg-cyan/10 p-3 text-sm text-cyan">{notice}</p>}
      {error && <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
    </form>
  );
}
