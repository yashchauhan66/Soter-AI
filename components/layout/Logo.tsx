import Image from "next/image";

/** The selected release artwork is available in every build mode. */
export const BRAND_ICON_PATH = "/brand/selected/symbol.png";

/** Keep catalog artwork local to an explicitly enabled development preview. */
export function getBrandPreviewIcon(): string | undefined {
  const image = process.env.NEXT_PUBLIC_SOTER_PREVIEW_ICON_DATA;
  return process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_SOTER_BRAND_PREVIEW === "option-2" &&
    image?.startsWith("data:image/png;base64,")
    ? image
    : undefined;
}

/** Selected hexagon symbol with the locally served SoterAI Signature lettering. */
export function Logo({
  /** Mark size in px. The wordmark scales from this. */
  size = 30,
  /** Set false in tight spots. */
  showWordmark = true,
  /** `priority` on the header instance only; the footer mark is far below the fold. */
  priority = false,
  /** Optional ID so a home link can use its visible wordmark as its accessible name. */
  wordmarkId,
  className,
}: {
  size?: number;
  showWordmark?: boolean;
  priority?: boolean;
  wordmarkId?: string;
  className?: string;
}) {
  const previewIcon = getBrandPreviewIcon();
  return (
    <span data-brand-lockup="sentinel-s" data-brand-geometry="selected-hexagon" data-brand-lettering="signature" className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <Image
        src={previewIcon ?? BRAND_ICON_PATH}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        priority={priority}
        className="shrink-0"
      />
      {showWordmark && (
        <span
          id={wordmarkId}
          className="soter-wordmark whitespace-nowrap leading-none text-slate-100"
          style={{ fontSize: size * 0.78 }}
        >
          SoterAI
        </span>
      )}
    </span>
  );
}
