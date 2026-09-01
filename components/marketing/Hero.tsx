import Link from "next/link";
import { ArrowRight, CheckCircle2, PlayCircle, ShieldCheck } from "lucide-react";
import { LiveThreatConsole } from "@/components/marketing/LiveThreatConsole";
import { heroCopy, productStatus } from "@/lib/marketing/launchStatus";

/**
 * Homepage hero.
 *
 * Structural changes from the previous version, and why:
 *
 * - **One primary action.** There were three CTAs of near-equal weight
 *   (playground, signup, book demo) plus a fourth benchmark link right below.
 *   Three primaries is zero primaries. The playground stays primary because it
 *   is the only zero-friction path; signup is secondary; sales drops to a quiet
 *   text link.
 * - **Proof stats are links, not decoration.** Each metric points at the page
 *   that substantiates it, so a number and its evidence are one click apart
 *   instead of needing a separate "see methodology" line.
 * - **Status chips are filtered.** All eight product statuses rendered as a wall
 *   of grey chips, including Labs and Coming Soon. Only shipping surfaces appear
 *   here; the rest live in Features where they have context.
 * - **Fluid type.** `text-display-xl` clamps instead of stepping, which removes
 *   the reflow the old `text-4xl sm:text-5xl lg:text-[3.4rem]` chain produced
 *   between 640px and 1024px.
 */

/** Each stat links to the evidence behind it. */
const trustStats: Array<{ value: string; label: string; href: string }> = [
  { value: "100%", label: "Recall on the published synthetic attack set", href: "/benchmark" },
  { value: "0.00%", label: "False positives across 1,000 benign controls", href: "/benchmark" },
  { value: "17.83ms", label: "p95 analyzer latency, latest local run", href: "/benchmarks" },
  { value: "3,200", label: "Published benchmark cases", href: "/benchmark" },
];

const assurances = ["Free public playground", "No signup to test", "Self-hosting available"];

const outcomes = [
  ["Developers", "Ship guarded AI features without rebuilding your stack."],
  ["Security teams", "Enforce one policy across AI prompts, outputs, and actions."],
  ["Indian teams", "Detect Aadhaar-like data, PAN, GSTIN, UPI, IFSC, and Hinglish risks."],
];

export function Hero() {
  // Surfaces that are actually shipping. Labs / Coming Soon chips would dilute
  // the hero's credibility, so they are surfaced in Features instead.
  const shippingProducts = productStatus.filter(
    (product) => product.status === "Stable" || product.status === "Beta",
  );

  return (
    <section className="relative isolate overflow-hidden border-b border-slate-800">
      {/* Decorative layers. pointer-events-none so they never swallow a CTA click. */}
      <div className="pointer-events-none absolute inset-0 z-[1] grid-fade mask-radial-fade opacity-40" />
      <div className="pointer-events-none absolute inset-0 z-[2] bg-[linear-gradient(90deg,rgba(8,17,31,0.88)_0%,rgba(8,17,31,0.55)_48%,rgba(8,17,31,0.2)_100%)]" />

      <div className="container-page relative z-10 grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-[1.02fr_.98fr] lg:py-24">
        <div>
          <span className="badge-brand">
            <ShieldCheck size={14} aria-hidden="true" />
            Runtime security for every AI interaction
          </span>

          {/* max-w-3xl rather than 4xl: at the smaller heading size a 4xl measure
              fits ~55 characters per line, which is past the comfortable range for
              display type and made the headline read as body copy. */}
          <h1 className="heading-hero mt-6 max-w-3xl">{heroCopy.headline}</h1>

          <p className="lede mt-6">{heroCopy.subheading}</p>

          {/* Single primary action. The tertiary route is text-only on purpose:
              three equally weighted buttons force a decision the visitor is not
              yet equipped to make. */}
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/playground" className="button-primary button-lg">
              <PlayCircle size={18} aria-hidden="true" /> {heroCopy.primaryCta}
            </Link>
            <Link href="/signup" className="button-secondary button-lg">
              Create free account
            </Link>
            <Link
              href="/contact-sales"
              className="inline-flex items-center gap-1.5 px-1 py-2 text-sm font-semibold text-slate-400 transition-colors hover:text-cyan"
            >
              {heroCopy.secondaryCta}
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>

          <ul className="mt-8 grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
            {assurances.map((item) => (
              <li className="flex items-center gap-2" key={item}>
                <CheckCircle2 className="shrink-0 text-lime" size={16} aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>

          {/* Proof rail. Linking each figure to its source also gives the
              benchmark pages four internal links from the site's strongest page. */}
          <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-slate-800 pt-8 sm:grid-cols-4">
            {trustStats.map((stat) => (
              <div key={stat.label}>
                <dt className="sr-only">{stat.label}</dt>
                <dd>
                  <Link href={stat.href} className="group block">
                    <span
                      data-numeric
                      className="block text-2xl font-black text-cyan transition-colors group-hover:text-cyan-300 sm:text-3xl"
                    >
                      {stat.value}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-slate-400 group-hover:text-slate-300">
                      {stat.label}
                    </span>
                  </Link>
                </dd>
              </div>
            ))}
          </dl>

          <p className="mt-4 text-xs leading-5 text-slate-500">
            Self-maintained synthetic benchmark, not an independent audit.{" "}
            <Link href="/benchmark" className="font-medium text-slate-400 underline hover:text-cyan">
              Dataset, methodology, and limitations
            </Link>
            .
          </p>

          <div className="mt-8 flex flex-wrap gap-2">
            {shippingProducts.map((product) => (
              <Link
                key={product.name}
                href={product.href}
                className="badge-neutral transition-colors hover:border-cyan/40 hover:text-white"
              >
                {product.name}
                <span className="text-cyan">{product.status}</span>
              </Link>
            ))}
          </div>
        </div>

        <LiveThreatConsole />
      </div>

      {/* Audience strip: resolves "is this for me?" before the first scroll. */}
      <div className="container-page relative z-10 pb-14">
        <div className="grid overflow-hidden rounded-panel border border-slate-800 bg-slate-950/70 sm:grid-cols-3">
          {outcomes.map(([audience, outcome], index) => (
            <div
              key={audience}
              className={`p-5 ${index > 0 ? "border-t border-slate-800 sm:border-l sm:border-t-0" : ""}`}
            >
              <p className="text-xs font-bold uppercase tracking-micro text-cyan">For {audience}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{outcome}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

