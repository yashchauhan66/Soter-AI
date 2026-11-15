import type { Metadata, Viewport } from "next";
import { OptionalAnalytics } from "@/components/privacy/OptionalAnalytics";
import { saDisplay, saMono } from "@/components/sa/fonts";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { getBrandPreviewIcon } from "@/components/layout/Logo";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { JsonLd } from "@/components/seo/JsonLd";
import { SITE_NAME, siteJsonLd } from "@/lib/seo/schema";
import "./globals.css";
import "@/components/layout/brand-lettering.css";

// Empty until the owner sets NEXT_PUBLIC_GA_MEASUREMENT_ID. The live site loaded
// gtag/js?id= with no ID, which measures nothing and costs a request.
const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || "";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://soterai.in";
const siteName = SITE_NAME;
const brandPreviewIcon = getBrandPreviewIcon();
// Same sentence the homepage uses, so a page that sets no description of its
// own still describes the product the way the homepage does (140 characters).
const siteDescription =
  "Check prompts and AI replies, redact secrets and personal data, flag prompt injection, and hold risky agent actions. Try it free, no signup.";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Allow zoom. The previous config omitted these, and while it did not set
  // maximumScale=1 outright, being explicit documents that pinch-zoom is
  // permitted (WCAG 1.4.4). Never set maximumScale or userScalable=false here.
  maximumScale: 5,
  userScalable: true,
  // Matches --surface-0 (#fbfaf7, warm paper) from globals.css. Mobile browser chrome frames
  // the page, so any drift between these two values renders as a visible seam at
  // the top of the viewport on iOS and Android. Update both together.
  //
  // Both entries are white on purpose. The product has one theme; reporting a
  // dark theme-color to a device in dark mode would tint the browser chrome
  // against a white page.
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#fbfaf7" },
    { media: "(prefers-color-scheme: light)", color: "#fbfaf7" },
  ],
  colorScheme: "light",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    // Fallback for a page that sets no title of its own. Same text as the
    // homepage title (58 characters).
    default: `AI Security Command Layer for LLMs and Agents | ${siteName}`,
    // The suffix is 13 characters, so a plain page title must be 47 or fewer to
    // keep the rendered title within 60. Titles that already name the brand
    // are made absolute by buildMetadata() in lib/seo/metadata.ts.
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  // No `keywords`: Google has ignored the tag since 2009, and the old list
  // (31 terms, several India-only) described a different product than the one
  // on the page. Topic targeting lives in each page's title, headings and copy.
  authors: [
    { name: "Yash Chauhan", url: `${siteUrl}/about` },
    { name: siteName, url: siteUrl },
  ],
  creator: "Yash Chauhan",
  publisher: "Yash Chauhan",
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
    title: `AI Security Command Layer for LLMs and Agents | ${siteName}`,
    description: siteDescription,
    images: [
      {
        url: "/og-card/default.png",
        width: 1200,
        height: 630,
        alt: "SoterAI, the AI security command layer",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `AI Security Command Layer | ${siteName}`,
    description: siteDescription,
    images: ["/og-card/default.png"],
  },
  category: "technology",
  icons: brandPreviewIcon ? {
    icon: [{ url: brandPreviewIcon, sizes: "223x223", type: "image/png" }],
    apple: [{ url: brandPreviewIcon, sizes: "223x223" }],
  } : {
    icon: [{ url: "/brand/selected/icon.png", sizes: "32x32" }, { url: "/brand/selected/icon-192.png", sizes: "192x192" }],
    apple: [{ url: "/brand/selected/apple-icon.png", sizes: "180x180" }],
  },
  manifest: "/manifest.webmanifest",
  classification: "AI Security",
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION || "02ofzVC3PhtpFHCtRZ4s7lsPIoZA0mTJ4-zFS5Og4Aw",
  },
  // The author tag comes from `authors` above. The old `founder`, `owner`,
  // `geo.region`, `geo.placename` and `country` tags are gone: none is a
  // standard search signal, and the geo tags described a single-country site.
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
    <html lang="en-IN" data-scroll-behavior="smooth" className={`${saDisplay.variable} ${saMono.variable}`}>
      <head>
        <link rel="preload" href="/brand/soterai-signature.woff" as="font" type="font/woff" crossOrigin="anonymous" />
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
          <SiteChrome footer={<><SiteFooter currentYear={new Date().getFullYear()} /><OptionalAnalytics gaId={GA_ID} cloudflareToken="48b07d6eac054c2a9337aac571e5c563" /></>}>
            {children}
          </SiteChrome>
        </AuthProvider>

      </body>
    </html>
  );
}
