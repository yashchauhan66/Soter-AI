import { cn } from "@/lib/utils";

/**
 * Guard verdict pill.
 *
 * Two changes:
 *
 * - Uses the shared `.badge-*` variants instead of a bespoke
 *   `rounded-full px-3 py-1` shape, so the verdict matches every other status
 *   chip in the product.
 * - `ALLOW_WITH_REDACTION` and the fallback both previously had their own hue
 *   (amber and violet). Violet does not exist in the palette, and a fourth colour
 *   on a four-state control means the reader has to learn four mappings. The
 *   fallback is now neutral: an unrecognised action is by definition not a
 *   severity signal.
 */
export function RiskBadge({ action }: { action: string }) {
  const variant =
    action === "BLOCK"
      ? "badge-danger"
      : action === "ALLOW"
        ? "badge-success"
        : action === "ALLOW_WITH_REDACTION"
          ? "badge-warning"
          : "badge-neutral";

  return <span className={cn(variant, "font-semibold")}>{action.replaceAll("_", " ")}</span>;
}
