"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Mail } from "lucide-react";

type Props = {
  email: string;
  initialEmailSent?: boolean;
  onSuccess: () => void | Promise<void>;
};

export function VerifyEmailOtpForm({
  email,
  initialEmailSent = true,
  onSuccess,
}: Props) {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState(
    initialEmailSent ? "" : "The first email could not be sent. Request a new code below.",
  );
  const [message, setMessage] = useState(initialEmailSent ? "We sent a 6-digit code to your inbox." : "");
  const [resendLoading, setResendLoading] = useState(false);
  const [cooldown, setCooldown] = useState(initialEmailSent ? 60 : 0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function handleVerify(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "Verification failed. Please try again.");
        setOtp("");
        inputRef.current?.focus();
        return;
      }
      setVerified(true);
      setMessage("Email verified. Taking you to sign in…");
      window.setTimeout(() => void onSuccess(), 900);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResendLoading(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) {
        const retryAfter = Number(response.headers.get("Retry-After"));
        if (Number.isFinite(retryAfter) && retryAfter > 0) setCooldown(retryAfter);
        setError(data.message ?? "Could not send a new code.");
        return;
      }
      setMessage("A fresh code has been sent. It expires in 10 minutes.");
      setOtp("");
      setCooldown(60);
      inputRef.current?.focus();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send a new code.");
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <div className="mt-6">
      <div className="mb-6 text-center">
        {verified ? (
          <CheckCircle2 className="mx-auto mb-3 text-emerald-400" size={34} aria-hidden="true" />
        ) : (
          <Mail className="mx-auto mb-3 text-cyan" size={34} aria-hidden="true" />
        )}
        <h2 className="text-2xl font-bold">Check your email</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Enter the 6-digit code sent to <span className="font-medium text-slate-200">{email}</span>.
          The code expires in 10 minutes.
        </p>
      </div>

      <form onSubmit={handleVerify} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium" htmlFor="email-verification-otp">
            Verification code
          </label>
          <input
            ref={inputRef}
            id="email-verification-otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            maxLength={6}
            className="input text-center text-2xl tracking-[0.45em]"
            autoFocus
            required
            disabled={verified}
          />
        </div>

        <button disabled={loading || verified || otp.length !== 6} className="button-primary w-full gap-2">
          {loading ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
          {verified ? "Verified" : loading ? "Verifying…" : "Verify email"}
        </button>

        {error && <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
        {message && <p role="status" className="rounded-xl bg-cyan/10 p-3 text-sm text-cyan">{message}</p>}

        <button
          type="button"
          onClick={handleResend}
          disabled={resendLoading || verified || cooldown > 0}
          className="w-full text-sm text-cyan hover:text-cyan/80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {resendLoading
            ? "Sending…"
            : cooldown > 0
              ? `Resend code in ${cooldown}s`
              : "Didn't receive it? Resend code"}
        </button>
      </form>
    </div>
  );
}
