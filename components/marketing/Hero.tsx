import Link from "next/link";
import { ArrowRight, CheckCircle2, PlayCircle, ShieldCheck } from "lucide-react";
import { LiveThreatConsole } from "@/components/marketing/LiveThreatConsole";
import { heroCopy } from "@/lib/marketing/launchStatus";

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
  return (
    <section className="relative isolate overflow-hidden border-b border-slate-800">
      {/* Decorative grid. `pointer-events-none` so it never swallows a CTA click.

          The dark version also painted a full-bleed scrim over the hero to darken
          the left side under the headline. On white there is nothing to darken —
          the scrim would be a grey wash across the copy — so it is gone, and the
          grid alone carries the texture. */}
      <div className="pointer-events-none absolute inset-0 z-[1] grid-fade mask-radial-fade opacity-60" />

      <div className="container-page relative z-10 grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-[1.02fr_.98fr] lg:py-24">
        <div>
          <span className="badge-neutral">
            <ShieldCheck size={13} aria-hidden="true" className="text-cyan" />
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
              benchmark pages four internal links from the site's strongest page.

              The figures are `text-slate-100`, not teal. Four large teal numbers
              directly under a teal badge and beside a teal CTA meant the accent
              appeared five times above the fold, so none of the five read as
              important. A metric is credible when it is legible, not when it is
              coloured. */}
          <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-slate-800 pt-8 sm:grid-cols-4">
            {trustStats.map((stat) => (
              <div key={stat.label}>
                <dt className="sr-only">{stat.label}</dt>
                <dd>
                  <Link href={stat.href} className="group block">
                    <span
                      data-numeric
                      className="block text-2xl font-semibold text-slate-100 sm:text-3xl"
                    >
                      {stat.value}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500 group-hover:text-slate-300">
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

          {/* The seven product badges that used to sit here are gone. They linked
              to the same eight destinations as the Surfaces grid in the very next
              section, which now shows each one with a status chip and a line of
              copy — so the badges were a compressed, less useful copy of content
              the reader was about to reach anyway. */}
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
              <p className="text-[11px] font-semibold uppercase tracking-micro text-slate-500">For {audience}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{outcome}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

