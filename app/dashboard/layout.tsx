import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (session?.user?.isAdmin) redirect("/admin");
  return <main><DashboardShell>{children}</DashboardShell></main>;
}
