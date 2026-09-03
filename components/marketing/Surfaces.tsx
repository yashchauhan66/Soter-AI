import Link from "next/link";
import {
  ArrowRight,
  Bot,
  FileCheck2,
  Globe,
  ScrollText,
  SquareCode,
  Terminal,
  Workflow,
  Zap,
} from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { productStatus, STATUS_BADGE } from "@/lib/marketing/launchStatus";

/**
 * Deployment surfaces — where SoterAI can be installed.
 *
 * ## Why this section exists
 *
 * The homepage previously opened, immediately under the hero, with two loose
 * cards for Browser Guard and IDE Guard — and then listed *both of them again*
 * further down inside the Features grid, with the same copy and the same
 * destinations. A visitor met the same two products twice before reaching any
 * new information, which reads as padding.
 *
 * There is one list of surfaces now, and it is the canonical one:
 * `productStatus` in `lib/marketing/launchStatus.ts`, which the pricing page
 * also renders. Eight entries at `lg:grid-cols-4` is two even rows.
 *
 * ## What was removed
 *
 * - The secondary "View node (n8n-nodes-soterai)" link on three of the tiles.
 *   Two links to the same product, stacked, is a choice the reader should not
 *   have to make; the tile's own CTA covers it.
 * - The "Opens the Chrome / Edge installer chooser" hint paragraphs. The CTA
 *   already says "Choose your browser", so the hint restated the link.
 */

/** One icon per surface. Kept here because it is presentation, not product data. */
const SURFACE_ICONS: Record<string, typeof Globe> = {
  "API Guard": Terminal,
  "Browser Guard": Globe,
  "IDE Guard": SquareCode,
  "n8n Guard": Workflow,
  "Make Guard": Workflow,
  "Zapier Guard": Zap,
  "MCP / Agent Guard": Bot,
  "Audit Evidence": FileCheck2,
};

/**
 * Browser and IDE Guard ship one product across many hosts, so their tiles open
 * a chooser rather than a single install link — and say so in the CTA itself.
 */
const OVERRIDES: Record<string, { href: string; cta: string }> = {
  "Browser Guard": { href: "/extensions/browser", cta: "Choose your browser" },
  "IDE Guard": { href: "/extensions/ide", cta: "Choose your IDE" },
};

export function Surfaces() {
  return (
    <section className="section">
      <div className="container-page">
        <SectionHeading
          eyebrow="Deployment surfaces"
          title="Install it where your team already uses AI"
          copy="One policy engine, one audit trail. Pick the surface that matches how AI enters your workflow — server-side, in the browser, in the editor, or inside an automation."
        />

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {productStatus.map((product) => {
            const Icon = SURFACE_ICONS[product.name] ?? ScrollText;
            const override = OVERRIDES[product.name];
            return (
              <Link
                key={product.name}
                href={override?.href ?? product.href}
                className="card card-interactive group flex flex-col p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="inline-flex rounded-md border border-slate-700/60 bg-slate-900/60 p-2 text-slate-400">
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <span className={STATUS_BADGE[product.status]}>{product.status}</span>
                </div>

                <h3 className="mt-4 text-base font-semibold text-slate-100">{product.name}</h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-slate-400">{product.copy}</p>

                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-cyan">
                  {override?.cta ?? product.cta}
                  <ArrowRight
                    size={14}
                    aria-hidden="true"
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
