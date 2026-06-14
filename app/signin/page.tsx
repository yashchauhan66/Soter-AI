import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SignInForm } from "@/components/auth/SignInForm";

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/dashboard");
  const params = await searchParams;
  return (
    <main className="container-page flex min-h-[calc(100vh-4rem)] items-center py-16">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 flex items-center gap-2 font-bold">
          <span className="rounded-lg bg-cyan/15 p-2 text-cyan"><ShieldCheck size={18} /></span>
          CyberRakshak Guard
        </div>
        <div className="card p-7">
          <p className="eyebrow">Sign in</p>
          <h1 className="mt-3 text-2xl font-bold">Welcome back</h1>
          <p className="mt-2 text-sm text-slate-400">Use your CyberRakshak Guard credentials to access the dashboard.</p>
          <SignInForm callbackUrl={params.callbackUrl ?? "/dashboard"} initialError={params.error} />
          <p className="mt-6 text-sm text-slate-500">
            New to CyberRakshak? <Link href="/signup" className="text-cyan">Create an account</Link>
          </p>
        </div>
        <p className="mt-6 text-xs text-slate-500">
          Sessions are JWT-encoded and last 24 hours. Sign out from the dashboard menu when finished on shared devices.
        </p>
      </div>
    </main>
    
  );
}
