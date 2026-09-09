import type { Metadata, Viewport } from "next";
import { GoogleAnalytics } from "@next/third-parties/google";
import { inter, jetbrainsMono } from "@/app/fonts";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { JsonLd } from "@/components/seo/JsonLd";
import { siteJsonLd } from "@/lib/seo/schema";
import "./globals.css";
;


const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://soterai.in";
const siteName = "SoterAI";
const siteDescription =
  "Protect AI apps and agents from prompt injection, data leaks, unsafe outputs, and risky tool calls with SoterAI's runtime security platform.";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Allow zoom. The previous config omitted these, and while it did not set
  // maximumScale=1 outright, being explicit documents that pinch-zoom is
  // permitted (WCAG 1.4.4). Never set maximumScale or userScalable=false here.
  maximumScale: 5,
  userScalable: true,
  // Matches --surface-0 (#ffffff) from globals.css. Mobile browser chrome frames
  // the page, so any drift between these two values renders as a visible seam at
  // the top of the viewport on iOS and Android. Update both together.
  //
  // Both entries are white on purpose. The product has one theme; reporting a
  // dark theme-color to a device in dark mode would tint the browser chrome
  // against a white page.
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#ffffff" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
  colorScheme: "light",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    // Homepage title. Kept under ~60 chars so Google renders it whole instead of
    // truncating the tail; the dropped keywords ("prompt injection", "RAG",
    // "agent security") are each carried by their own dedicated landing page.
    default: `${siteName} | AI Security Platform for LLMs & Agents`,
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
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-cyan focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          Skip to main content
        </a>
        <AuthProvider>
          {/* The footer is passed as a prop, not imported by SiteChrome, so it
              stays a server component. See the note in SiteChrome. */}
          <SiteChrome footer={<SiteFooter currentYear={new Date().getFullYear()} />}>
            {children}
          </SiteChrome>
        </AuthProvider>
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || ""} />
      </body>
    </html>
  );
}
