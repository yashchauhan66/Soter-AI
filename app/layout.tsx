import type { Metadata, Viewport } from "next";
import { GoogleAnalytics } from "@next/third-parties/google";
import { inter, jetbrainsMono } from "@/app/fonts";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { JsonLd } from "@/components/seo/JsonLd";
import { siteJsonLd } from "@/lib/seo/schema";
import "./globals.css";
;


const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://soterai.in";
const siteName = "SoterAI";
const siteDescription =
  "SoterAI is an AI security platform for chatbots, RAG apps, copilots, and autonomous agents. Detect prompt injection, jailbreaks, AI data leakage, unsafe outputs, risky tool calls, secrets, and Indian PII such as Aadhaar, PAN, GSTIN, UPI, and IFSC.";

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
    default: `${siteName} | AI Security Platform for Prompt Injection, RAG and Agent Security`,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  keywords: [
    "AI security",
    "AI security platform",
    "AI security guard",
    "AI security guardrails",
    "prompt injection protection",
    "prompt injection detector",
    "LLM guardrails",
    "LLM security",
    "LLM firewall",
    "chatbot security",
    "jailbreak detection",
    "PII redaction",
    "RAG security",
    "RAG security platform",
    "AI agent firewall",
    "AI agent security",
    "OWASP LLM Top 10",
    "India PII detection",
    "agent security",
    "SoterAI",
    "AI safety",
    "AI guardrail platform",
    "AI security India",
    "Aadhaar PII detection",
    "Indian AI compliance",
    "generative AI security",
    "LLM security India",
    "chatbot security India",
    "AI agent protection",
    "enterprise AI security",
    "AI data leakage prevention",
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
    title: `${siteName} - AI Security Platform for LLM Apps and AI Agents`,
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
    title: `${siteName} - AI Security Platform`,
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
  alternates: {
    // en and x-default only. Hindi (hi) and en-IN removed — no Hindi content
    // exists; mismatched hreflang signals harm index quality and confuse
    // Google's language detection. Re-add when genuine Hindi pages are live.
    canonical: siteUrl,
    languages: {
      "en": siteUrl,
      "x-default": siteUrl,
    },
  },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        {/* Performance hints: warm up the Google Analytics connection so the
            tag loads off the critical path (better LCP / INP → better ranking). */}
        <link rel="preconnect" href="https://www.googletagmanager.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
        <link rel="preconnect" href="https://www.google-analytics.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://www.google-analytics.com" />
      </head>
      <body className="font-sans">
        <JsonLd data={siteJsonLd} />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-cyan focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink"
        >
          Skip to main content
        </a>
        <AuthProvider>
          <SiteChrome currentYear={new Date().getFullYear()}>{children}</SiteChrome>
        </AuthProvider>
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || ""} />
      </body>
    </html>
  );
}
