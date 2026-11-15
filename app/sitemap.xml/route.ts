import { renderSitemapIndex } from "@/lib/seo/sitemapData";

/**
 * /sitemap.xml: an index of the segment sitemaps at /sitemaps/<segment>.xml.
 * Submit this one URL in Search Console and Bing Webmaster Tools.
 *
 * Static at build time. The data is plain constants plus the blog and docs registries.
 */
export const dynamic = "force-static";

export function GET() {
  return new Response(renderSitemapIndex(), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
