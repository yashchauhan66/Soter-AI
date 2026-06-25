/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: process.cwd(),
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,
  // Tree-shake large icon/util barrels so only the icons actually used are bundled.
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  async headers() {
    const scriptSources = ["'self'", "'unsafe-inline'", "https://checkout.razorpay.com", "https://www.googletagmanager.com", "https://www.google-analytics.com"];
    if (process.env.NODE_ENV !== "production") scriptSources.push("'unsafe-eval'");
    const securityHeaders = [
      { key: "Content-Security-Policy", value: `default-src 'self'; script-src ${scriptSources.join(" ")}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.razorpay.com https://www.google-analytics.com; font-src 'self'; connect-src 'self' https://*.razorpay.com https://www.google-analytics.com https://www.googletagmanager.com https://analytics.google.com; frame-src https://*.razorpay.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'` },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    if (process.env.NODE_ENV === "production") {
      securityHeaders.push({ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" });
    }
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
