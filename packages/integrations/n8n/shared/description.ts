import type { INodeTypeBaseDescription } from "n8n-workflow";

/**
 * Fields that are identical across every node version. Anything version-specific
 * (version number, outputs, subtitle wording) is set in the version class.
 */
export const soterGuardBaseDescription: INodeTypeBaseDescription = {
  displayName: "SoterAI",
  name: "soterGuard",
  icon: { light: "file:soterai-mark.svg", dark: "file:soterai-mark.dark.svg" },
  iconColor: "purple",
  group: ["transform"],
  description:
    "Detect prompt injection, jailbreaks, secrets, PII, and unsafe AI instructions in n8n workflows",
  defaultVersion: 2,
  codex: {
    categories: ["Development", "Utility"],
    alias: [
      "security",
      "guardrail",
      "guardrails",
      "prompt injection",
      "jailbreak",
      "firewall",
      "PII",
      "redact",
      "secrets",
      "moderation",
      "safety",
      "OWASP",
    ],
    resources: {
      primaryDocumentation: [
        {
          url: "https://github.com/yashchauhan66/Soter-AI/tree/main/packages/integrations/n8n",
        },
      ],
    },
  },
};
