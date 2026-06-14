import { ResetPasswordForm } from "@/components/auth/PasswordResetForms";
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) { const { token = "" } = await searchParams; return <main className="container-page py-20"><ResetPasswordForm token={token} /></main>; }
