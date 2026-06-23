import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { auth } from "@/auth";
import { SignUpForm } from "@/components/auth/SignUpForm";

export const dynamic = "force-dynamic";

export default async function SignUpPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");
  return (
    <main className="container-page flex min-h-[calc(100vh-4rem)] items-center py-16">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 flex items-center gap-2 font-semibold tracking-wide">
          <span className="rounded-md border border-cyan/25 bg-cyan/10 p-2 text-cyan"><ShieldCheck size={18} aria-hidden="true" /></span>
          Soter<span className="text-cyan">AI</span>
        </div>
        <div className="card p-7">
          <p className="eyebrow">Create account</p>
          <h1 className="mt-3 text-2xl font-bold">Secure your first AI workflow</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">Create a workspace with input protection, output inspection, risk logs, and security evidence.</p>
          <SignUpForm />
          <p className="mt-6 text-sm text-slate-500">
            Already have an account? <Link href="/signin" className="text-cyan hover:text-cyan/80">Sign in</Link>
          </p>
        </div>
      </div>
    </main>
  );
}