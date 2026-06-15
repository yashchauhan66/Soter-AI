import { DashboardSidebar } from "./DashboardSidebar";
import { FeedbackWidget } from "@/components/phase8/FeedbackWidget";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="container-page py-8">
      <div className="grid gap-7 lg:grid-cols-[240px_1fr]">
        <DashboardSidebar />
        <section className="min-w-0">{children}</section>
      </div>
      <FeedbackWidget />
    </div>
  );
}
