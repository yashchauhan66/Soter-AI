import { DashboardSidebar } from "./DashboardSidebar";
import { FeedbackWidget } from "@/components/ops/FeedbackWidget";
import { DashboardTourProvider } from "@/components/onboarding/DashboardTourProvider";
import { TourOverlay } from "@/components/onboarding/TourOverlay";
import { TourTrigger } from "@/components/onboarding/TourTrigger";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <DashboardTourProvider>
      <div className="container-page py-8">
        <div className="grid gap-7 lg:grid-cols-[240px_1fr]">
          <DashboardSidebar />
          <section className="min-w-0">{children}</section>
        </div>
        <FeedbackWidget />
      </div>
      <TourOverlay />
      <TourTrigger />
    </DashboardTourProvider>
  );
}
