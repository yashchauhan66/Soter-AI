import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { HeaderNav } from "@/components/auth/HeaderNav";
import "./globals.css";

const siteUrl = "https://soter.dev";
const siteName = "Soter Guard";
const siteDescription =
  "AI security guardrail platform protecting chatbots, RAG apps, and AI agents from prompt injection, jailbreaks, PII leakage, and unsafe outputs. F1=1.0000 benchmark.";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0f1117" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${siteName} | AI Security Guardrail Platform`,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  keywords: [
    "AI security",
    "prompt injection protection",
    "LLM guardrails",
    "chatbot security",
    "jailbreak detection",
    "PII redaction",
    "RAG security",
    "AI agent firewall",
    "OWASP LLM Top 10",
    "India PII detection",
    "Aadhaar redaction",
    "AI safety",
    "guardrail platform",
    "Soter",
    "CyberRakshak",
  ],
  authors: [{ name: "Soter" }],
  creator: "Soter",
  publisher: "Soter",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: siteName,
    title: `${siteName} — AI Security Guardrail Platform`,
    description: siteDescription,
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "Soter Guard — AI Security Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@soterdev",
    creator: "@soterdev",
    title: `${siteName} — AI Security Guardrail Platform`,
    description: siteDescription,
    images: ["/twitter-image.png"],
  },
  alternates: {
    canonical: siteUrl,
  },
  icons: {
    icon: [{ url: "/icon.png", sizes: "32x32" }],
    apple: [{ url: "/apple-icon.png", sizes: "180x180" }],
  },
  manifest: "/manifest.webmanifest",
  category: "technology",
  classification: "AI Security",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        {/* Skip-to-content link for keyboard users */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-cyan focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink"
        >
          Skip to main content
        </a>
        <AuthProvider>
          <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-ink/85 backdrop-blur-xl">
            <div className="container-page flex h-16 items-center justify-between">
              <Link href="/" className="flex items-center gap-2 font-bold">
                <span className="rounded-lg bg-cyan/15 p-2 text-cyan"><ShieldCheck size={20} aria-hidden="true" /></span>
                CyberRakshak <span className="text-cyan">Guard</span>
              </Link>
              <HeaderNav />
            </div>
          </header>
          <div id="main-content" tabIndex={-1}>{children}</div>
          <footer className="border-t border-slate-800 py-10 text-sm text-slate-500">
            <div className="container-page flex flex-col justify-between gap-4 sm:flex-row">
              <p>CyberRakshak Guard. Defensive AI security for chatbot flows.</p>
              <div className="flex flex-wrap gap-4"><Link href="/trust">Trust</Link><Link href="/status">Status</Link><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link></div>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
