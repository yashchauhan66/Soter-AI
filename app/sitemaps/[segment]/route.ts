import { SEGMENT_NAMES, renderSitemapSegment } from "@/lib/seo/sitemapData";

/**
 * /sitemaps/<segment>.xml: one child sitemap. An unknown name returns a real 404,
 * not an empty sitemap.
 */
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return SEGMENT_NAMES.map((name) => ({ segment: `${name}.xml` }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ segment: string }> }) {
  const { segment } = await params;
  const xml = segment.endsWith(".xml") ? renderSitemapSegment(segment.slice(0, -4)) : null;
  if (!xml) return new Response("Not found", { status: 404 });
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
