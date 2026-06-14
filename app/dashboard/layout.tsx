import { DashboardShell } from "@/components/dashboard/DashboardShell";
export default function DashboardLayout({ children }: { children: React.ReactNode }) { return <main><DashboardShell>{children}</DashboardShell></main>; }
