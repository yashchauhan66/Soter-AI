import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { SignInForm } from "@/components/auth/SignInForm";
import { safeCallbackUrl } from "@/lib/auth/callback";

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await auth();
  if (session?.user?.id) {
    const existing = await db.user.findUnique({ where: { id: session.user.id }, select: { id: true } });
    if (existing) redirect("/dashboard");
  }
  const params = await searchParams;
  return (
    <main className="container-page flex min-h-[calc(100vh-4rem)] items-center py-16">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 flex items-center gap-2 font-semibold tracking-wide">
          <span className="rounded-md border border-cyan/25 bg-cyan/10 p-2 text-cyan"><ShieldCheck size={18} aria-hidden="true" /></span>
          Soter<span className="text-cyan">AI</span>
        </div>
        <div className="card p-7">
          <p className="eyebrow">Sign in</p>
          <h1 className="mt-3 text-2xl font-bold">Welcome back</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">Access your AI security dashboard, guard decisions, and workspace controls.</p>
          <SignInForm callbackUrl={safeCallbackUrl(params.callbackUrl)} initialError={params.error} />
          <p className="mt-6 text-sm text-slate-500">
            New to SoterAI? <Link href="/signup" className="text-cyan hover:text-cyan/80">Create an account</Link>
          </p>
        </div>
        <p className="mt-6 text-xs leading-5 text-slate-500">
          Sessions are JWT-encoded and last 24 hours. Sign out from the dashboard menu when finished on shared devices.
        </p>
      </div>
    </main>
  );
}