import Link from "next/link";
import { ArrowRight, BarChart3, CheckCircle2, Gauge, ShieldCheck, Zap } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";

/**
 * Evidence — benchmark numbers, OWASP mapping, and India PII coverage.
 *
 * ## Why these are one section
 *
 * They were three consecutive full-height sections, each with its own centred
 * heading and its own single outbound link. All three answer the same buyer
 * question — "prove it" — so the reader paid for three scroll stops and three
 * heading blocks to receive one idea. Merging them removes two headings, two
 * section borders, and one redundant call to action, and lets the numbers sit
 * directly above the coverage they were measured against.
 *
 * ## On the metric colours
 *
 * The four figures previously rendered in two different accents — three cyan and
 * one lime on the false-positive rate. All four are favourable numbers measured
 * on the same run, so a second colour on one of them encoded nothing. One accent
 * now, which also stops the row reading as two groups of unequal importance.
 */
const benchmarkMetrics = [
  { value: "100%", label: "Recall", basis: "2,200 synthetic attacks", Icon: ShieldCheck },
  { value: "0.00%", label: "False-positive rate", basis: "1,000 benign controls", Icon: Zap },
  { value: "17.83ms", label: "Analyzer p95", basis: "Local benchmark run", Icon: Gauge },
  { value: "10", label: "Attack categories", basis: "Synthetic public corpus", Icon: BarChart3 },
];

const attackCategories = [
  "Prompt injection",
  "Jailbreak / DAN",
  "Encoding / obfuscation",
  "Multilingual (Hindi)",
  "RAG poisoning",
  "Tool abuse",
  "MCP risk",
  "PII detection",
  "Secrets / credentials",
  "Unsafe output",
];

const owaspCoverage = [
  ["LLM01", "Prompt injection", "Instruction overrides, jailbreak combinations, and prompt extraction."],
  ["LLM02", "Sensitive information disclosure", "PII, Indian identifiers, credentials, tokens, and database URLs."],
  ["LLM05", "Improper output handling", "Leaked instructions, unsafe claims, and suspicious links in output."],
  ["LLM10", "Unbounded consumption", "Text-size, per-minute, and monthly usage controls."],
];

const indiaIdentifiers = ["Aadhaar-like", "PAN", "GSTIN", "UPI ID", "IFSC", "Indian mobile"];

export function Evidence() {
  return (
    <section className="section">
      <div className="container-page">
        <SectionHeading
          center
          eyebrow="Evidence"
          title="Published numbers, published limits"
          copy="Latest generated run: 2,200 synthetic attack cases and 1,000 benign controls, evaluated with the production detector. This is self-maintained regression evidence — not an independent audit, and not a production guarantee."
        />

        <dl className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {benchmarkMetrics.map((metric) => (
            <div className="card p-6 text-center" key={metric.label}>
              <metric.Icon className="mx-auto text-cyan" size={26} aria-hidden="true" />
              <dd data-numeric className="mt-3 text-3xl font-bold text-cyan">
                {metric.value}
              </dd>
              <dt className="mt-1 text-sm font-medium text-slate-200">{metric.label}</dt>
              <p className="mt-1 text-xs text-slate-400">{metric.basis}</p>
            </div>
          ))}
        </dl>

        <ul className="mt-6 flex flex-wrap justify-center gap-2">
          {attackCategories.map((category) => (
            <li className="badge-neutral" key={category}>
              {category}
            </li>
          ))}
        </ul>

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          {/* OWASP mapping as a definition list rather than four cards: the ID is a
              label for its row, not a card heading, and rows pack all four items
              into the height one of those cards used to take. */}
          <div className="card p-7">
            <h3 className="text-lg font-semibold text-slate-100">OWASP LLM Top 10 alignment</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Controls map to the risk areas below. Alignment supports risk reduction; it is not a certification or a
              claim of complete coverage.
            </p>
            <dl className="mt-6 space-y-4">
              {owaspCoverage.map(([id, title, copy]) => (
                <div className="flex gap-3" key={id}>
                  <span
                    data-numeric
                    className="mt-0.5 h-fit shrink-0 rounded-md bg-cyan/10 px-2 py-1 text-xs font-bold text-cyan"
                  >
                    {id}
                  </span>
                  <div>
                    <dt className="text-sm font-semibold text-slate-200">{title}</dt>
                    <dd className="mt-1 text-sm leading-6 text-slate-400">{copy}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>

          <div className="card p-7">
            <h3 className="text-lg font-semibold text-slate-100">Built for India</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Detect and redact local personal-data patterns, plus contextual student, patient, and bank identifiers
              that generic PII models miss.
            </p>
            <ul className="mt-6 grid grid-cols-2 gap-2.5">
              {indiaIdentifiers.map((label) => (
                <li className="surface flex items-center gap-2 px-3 py-2.5 text-sm text-slate-300" key={label}>
                  <CheckCircle2 className="shrink-0 text-slate-500" size={15} aria-hidden="true" />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link href="/benchmark" className="button-secondary">
            Benchmark methodology <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link href="/compliance" className="button-ghost">
            Full compliance mapping
          </Link>
        </div>
      </div>
    </section>
  );
}

