import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { FeatureLanding, type FeatureLandingData } from "@/components/marketing/FeatureLanding";

export const metadata: Metadata = buildMetadata({
  title: "SoterAI Secret Guard — Secret Protection for AI Coding",
  description:
    "Find exposed API keys and passwords locally. Review redacted code and debug logs before sharing with AI. SoterAI Secret Guard for Windows.",
  path: "/vscode-ai-security",
  ogImage: "/og/soterai-secret-guard-preview-20261113.png",
  keywords: [
    "vscode secret scanner",
    "ai coding security",
    "api key redaction",
    "env secret protection",
    "safe debug context",
  ],
});

const data: FeatureLandingData = {
  path: "/vscode-ai-security",
  eyebrow: "SoterAI Secret Guard · Windows Preview",
  h1: "Check secrets before your next AI prompt",
  productName: "SoterAI Secret Guard",
  operatingSystem: "Windows",
  primaryCta: { label: "Join preview testing", href: "/support", external: false },
  secondaryCta: { label: "View extension information", href: "/extensions/ide" },
  scopeNote: "Preview testing is in progress. The current candidate is not a stable release. Local diagnostics do not intercept independent AI traffic.",
  intro:
    "For developers who build with AI: find recognized secrets locally, review redacted code and debug logs, and copy only the context you choose to share. Optional vault workflows replace reviewed credentials with placeholders and retain encrypted recovery.",
  features: [
    {
      title: "Catch secrets while you code",
      body: "Live findings identify supported API keys, passwords and other sensitive patterns in eligible files. Open the lightbulb for a reviewed next step. Diagnostics are visibility, not a block on another agent's reads.",
    },
    {
      title: "Review the whole line before copying",
      body: "Selecting one finding prepares the affected lines with recognized secrets filtered, including other detected values beside it. Copy only after reviewing the preview; changed source or preview requires a new review.",
    },
    {
      title: "Build context with synthetic examples",
      body: "Build an environment contract containing variable names, suggested types and synthetic examples. Original assignment values and comments are discarded. Review whether the names themselves are private.",
    },
    {
      title: "Keep useful debugging context",
      body: "Prepare a bounded log or stack trace with recognized-value redaction. Review the remaining error details, paths and hostnames before explicitly copying it into your AI workflow.",
    },
    {
      title: "Review vault protection and recovery",
      body: "Replace reviewed saved-file values with placeholders through the existing vault flow. Preview changes and preserve encrypted recovery. Applications intentionally given a value can still disclose it.",
    },
    {
      title: "See what is actually checked",
      body: "Guided setup shows Cline/Claude version compatibility and local check results. Configuration, local self-checks and live provider verification are separate observations.",
    },
  ],
  how: [
    {
      step: "Start with a test project",
      body: "Request the current Windows preview and use a separate test profile with synthetic credentials. Registry listings can serve an older version; check the version and release notes.",
    },
    {
      step: "Follow the recommended action",
      body: "Open Protect This Project Step by Step, or use a current live finding. Review sensitive files and choose the supported workflow for your task.",
    },
    {
      step: "Inspect the preview",
      body: "Review the generated context. Choose Copy reviewed text when ready, or keep the preview without changing the clipboard. Unknown private information may still need manual removal.",
    },
    {
      step: "Verify your chosen integration",
      body: "Configure the owner-reviewed adapter and inspect its current coverage. Test the actual supported tool route before relying on provider-request protection.",
    },
  ],
  limitations: [
    "The current candidate is a Windows x64 preview. Installed GUI, configured upgrade/recovery, real-provider and independent user acceptance remain incomplete.",
    "Detection is heuristic and signature-based. It reduces the risk of leaking secrets and PII, but it cannot guarantee that every sensitive value in every format is caught.",
    "The extension inspects context you route through its commands and its optional local broker. It cannot see traffic sent by other extensions that bypass it.",
    "Unrestricted same-user file access, other extensions' original buffers and independent uploads remain outside these controls.",
    "Redaction is best-effort; always review redacted output before sharing externally.",
  ],
  faqs: [
    {
      q: "Does the extension send my code to a server?",
      a: "Local scanning and preview generation do not require a SoterAI account or upload to a SoterAI server. Explicitly configured provider routes send their approved requests to that provider; anything you copy and paste is also governed by the destination's privacy policy.",
    },
    {
      q: "Does it protect every AI coding assistant automatically?",
      a: "No. You can use reviewed context in your chosen workflow, but interception requires an explicitly configured, supported managed route. Cline and Claude adapters check pinned versions. A different client, version or independent upload is not automatically covered.",
    },
    {
      q: "Is it free?",
      a: "Local features are free to use without a SoterAI account. The package's Business Source License applies; free use is not a claim of an OSI-approved open-source license.",
    },
    {
      q: "Will it be available on VS Code Marketplace and Open VSX?",
      a: "Both registries are intended distribution channels under soterai.soterai-ide-guard. The newer preview candidate has not been published by this work. Registry availability, supported target and version must be checked separately.",
    },
  ],
  related: [
    { label: "AI Platform Security", href: "/ai-platform-security" },
    { label: "Prompt Injection Protection", href: "/prompt-injection-protection" },
    { label: "MCP Security", href: "/mcp-security" },
    { label: "AI Data Leakage Prevention", href: "/ai-data-leakage-prevention" },
    { label: "Local AI Broker", href: "/local-ai-broker" },
    { label: "Limitations", href: "/limitations" },
  ],
};

export default function Page() {
  return <FeatureLanding data={data} />;
}
