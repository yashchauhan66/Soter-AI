import { Code2, Headphones, ShieldCheck, UsersRound, type LucideIcon } from "lucide-react";

export type ActivationPathKey = "developer" | "security" | "support" | "agency";

export interface ActivationPath {
  key: ActivationPathKey;
  label: string;
  who: string;
  outcome: string;
  href: string;
  icon: LucideIcon;
  steps: string[];
}

export const ACTIVATION_PATHS: ActivationPath[] = [
  {
    key: "developer",
    label: "Developer",
    who: "I need to protect an app or agent",
    outcome: "First guarded API request",
    href: "/dashboard/integrations",
    icon: Code2,
    steps: ["Create API key", "Copy server-side snippet", "Send blocked test prompt", "Open logs"],
  },
  {
    key: "security",
    label: "Security lead",
    who: "I need policy, proof, and monitoring",
    outcome: "Governed workspace with evidence",
    href: "/dashboard/usage-governance",
    icon: ShieldCheck,
    steps: ["Enable policy", "Review risky providers", "Connect alerts", "Export report"],
  },
  {
    key: "support",
    label: "Support owner",
    who: "I need to protect a chatbot",
    outcome: "Safer support flow with reports",
    href: "/dashboard/onboarding",
    icon: Headphones,
    steps: ["Choose chatbot stack", "Guard inputs", "Guard outputs", "Test red-team examples"],
  },
  {
    key: "agency",
    label: "Agency",
    who: "I manage multiple client bots",
    outcome: "Client-ready report and badge",
    href: "/dashboard/agency",
    icon: UsersRound,
    steps: ["Create client", "Run demo scan", "Generate report", "Share badge rules"],
  },
];

export function nextOnboardingAction(items: Array<{ title: string; href: string; done: boolean }>) {
  return items.find((item) => !item.done) ?? items[items.length - 1];
}
