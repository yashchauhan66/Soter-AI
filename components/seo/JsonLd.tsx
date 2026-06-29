/**
 * Renders a JSON-LD <script> for structured data.
 *
 * Centralizes the markup so pages don't repeat the dangerouslySetInnerHTML
 * boilerplate. Pass any schema.org object (or @graph) as `data`.
 */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify output is safe to embed; no user-controlled HTML.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
