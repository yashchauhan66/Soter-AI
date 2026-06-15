import { getCurrentProject } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/auth/guards";
import { ensureCustomerOnboarding } from "@/lib/phase8/onboarding";
import { OnboardingWizard } from "./OnboardingWizard";

export async function OnboardingExperience({ type, title, description }: { type: "BETA" | "AGENCY" | "ENTERPRISE"; title: string; description: string }) {
  const [active, project] = await Promise.all([getActiveOrganization(), getCurrentProject()]);
  if (!active) return <div className="card p-8">Create an organization to begin onboarding.</div>;
  const onboarding = await ensureCustomerOnboarding({ organizationId: active.org.id, userId: active.membership.userId, projectId: project.id, type });
  return <div><p className="eyebrow">Launch onboarding</p><h1 className="mt-2 text-3xl font-bold">{title}</h1><p className="mb-8 mt-3 max-w-3xl text-slate-400">{description}</p><OnboardingWizard onboardingId={onboarding.id} type={type} projectId={project.id} initialSteps={onboarding.stepEvents} /></div>;
}
