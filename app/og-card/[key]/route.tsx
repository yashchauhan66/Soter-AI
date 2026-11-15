import { OG_KEYS, getOgCard } from "@/lib/og/cards";
import { renderOgCard } from "@/lib/og/renderCard";

/**
 * /og-card/<key>.png: the share card for one page, drawn at build time.
 * Only keys in lib/og/cards.ts exist. Anything else is a real 404, so this route cannot be
 * used to draw arbitrary text.
 */
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return OG_KEYS.map((key) => ({ key: `${key}.png` }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const card = key.endsWith(".png") ? getOgCard(key.slice(0, -4)) : null;
  if (!card) return new Response("Not found", { status: 404 });
  const image = renderOgCard(card);
  image.headers.set("Cache-Control", "public, max-age=3600, s-maxage=604800");
  return image;
}
