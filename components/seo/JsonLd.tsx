import { safeJsonLd } from "@/lib/seo/jsonLd";

/**
 * Renders a JSON-LD <script> for structured data.
 *
 * Centralizes the markup so pages don't repeat the dangerouslySetInnerHTML
 * boilerplate. Pass any schema.org object (or @graph) as `data`.
 *
 * Uses safeJsonLd() to escape <, >, & and line separators to prevent
 * </script> breakout XSS attacks.
 */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }}
    />
  );
}
