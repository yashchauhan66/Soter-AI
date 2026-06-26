import type { Metadata, Viewport } from "next";
import Link from "next/link";
import Image from "next/image";
import { Inter, JetBrains_Mono } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { HeaderNav } from "@/components/auth/HeaderNav";
import { AiAssistant } from "@/components/dashboard/AiAssistant";
import { PHLaunchBanner } from "@/components/marketing/PHLaunchBanner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  preload: true,
  fallback: ["system-ui", "-apple-system", "sans-serif"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
  preload: true,
  fallback: ["Consolas", "Monaco", "monospace"],
});

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://soterai.publicvm.com";
const siteName = "SoterAI";
const siteDescription =
  "SoterAI is an AI security command layer for chatbots, RAG apps, and autonomous agents, protecting teams from prompt injection, data leakage, unsafe outputs, and agent abuse.";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b1117" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${siteName} | AI Security Command Layer`,
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
    "agent security",
    "SoterAI",
    "AI safety",
    "LLM security",
    "AI guardrail platform",
  ],
  authors: [{ name: "SoterAI" }],
  creator: "SoterAI",
  publisher: "SoterAI",
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
    siteName,
    title: `${siteName} - AI Security Command Layer`,
    description: siteDescription,
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "SoterAI AI security platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteName} - AI Security Command Layer`,
    description: siteDescription,
    images: ["/opengraph-image.png"],
    site: "@soterai",
  },
  category: "technology",
  icons: {
    icon: [{ url: "/icon.png", sizes: "32x32" }, { url: "/icon-192.png", sizes: "192x192" }],
    apple: [{ url: "/apple-icon.png", sizes: "180x180" }],
  },
  manifest: "/manifest.webmanifest",
  classification: "AI Security",
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION || "02ofzVC3PhtpFHCtRZ4s7lsPIoZA0mTJ4-zFS5Og4Aw",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-cyan focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink"
        >
          Skip to main content
        </a>
        <AuthProvider>
          <PHLaunchBanner />
          <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-ink/90 backdrop-blur-xl">
            <div className="container-page flex h-16 items-center justify-between">
              <Link href="/" className="flex min-w-0 items-center font-semibold tracking-wide">
                <Image src="/logo.png" alt="SoterAI" width={114} height={40} priority className="h-9 w-auto" />
              </Link>
              <HeaderNav />
            </div>
          </header>
          <div id="main-content" tabIndex={-1}>{children}</div>
          <footer className="border-t border-slate-800 bg-slate-950/45 py-12 text-sm text-slate-500">
            <div className="container-page">
              <div className="flex flex-col justify-between gap-8 sm:flex-row">
                <div className="max-w-xs">
                  <Link href="/" className="flex items-center font-semibold tracking-wide">
                    <Image src="/logo.png" alt="SoterAI" width={97} height={34} className="h-8 w-auto" />
                  </Link>
                  <p className="mt-3 leading-6 text-slate-500">
                    AI security command layer for chatbots, RAG apps, and autonomous agents.
                  </p>
                </div>
                <div className="flex flex-wrap gap-10">
                  <div>
                    <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Product</p>
                    <div className="flex flex-col gap-2">
                      <Link href="/#features" className="hover:text-slate-300">Features</Link>
                      <Link href="/docs" className="hover:text-slate-300">Documentation</Link>
                      <Link href="/pricing" className="hover:text-slate-300">Pricing</Link>
                      <Link href="/playground" className="hover:text-slate-300">Playground</Link>
                      <Link href="/demo" className="hover:text-slate-300">Demo</Link>
                      <Link href="/dashboard/integrations" className="hover:text-slate-300">Integrations</Link>
                    </div>
                  </div>
                  <div>
                    <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Company</p>
                    <div className="flex flex-col gap-2">
                      <Link href="/trust" className="hover:text-slate-300">Trust</Link>
                      <Link href="/status" className="hover:text-slate-300">Status</Link>
                      <Link href="/terms" className="hover:text-slate-300">Terms</Link>
                      <Link href="/privacy" className="hover:text-slate-300">Privacy</Link>
                      <Link href="/security" className="hover:text-slate-300">Security</Link>
                      <Link href="/support" className="hover:text-slate-300">Support</Link>
                    </div>
                  </div>
                  <div>
                    <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Compare</p>
                    <div className="flex flex-col gap-2">
                      <Link href="/comparison" className="hover:text-slate-300">vs Competitors</Link>
                      <Link href="/benchmarks" className="hover:text-slate-300">Benchmarks</Link>
                      <Link href="/case-studies" className="hover:text-slate-300">Case Studies</Link>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-slate-800 pt-6 sm:flex-row">
                <p className="text-xs">&copy; {new Date().getFullYear()} SoterAI. All rights reserved.</p>
                <p className="text-xs">Security intelligence for AI systems in production.</p>
              </div>
            </div>
          </footer>
        </AuthProvider>
        <AiAssistant />
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || ""} />
      </body>
    </html>
  );
}