import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free AI Prompt Injection Scanner",
  description:
    "Scan any prompt for injection, jailbreak, PII leakage, and unsafe-output risk in seconds with SoterAI's free AI security scanner. No signup required.",
  alternates: { canonical: "/scanner" },
  openGraph: {
    title: "Free AI Prompt Injection Scanner | SoterAI",
    description:
      "Test any prompt for injection, jailbreaks, and data-leak risk with SoterAI's free scanner.",
    url: "/scanner",
  },
};

export default function ScannerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
