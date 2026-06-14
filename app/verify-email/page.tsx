import { VerifyEmailClient } from "@/components/auth/VerifyEmailClient";
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) { const { token = "" } = await searchParams; return <main className="container-page py-20"><VerifyEmailClient token={token} /></main>; }
