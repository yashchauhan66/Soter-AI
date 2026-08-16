"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import {
  DEFAULT_RPM,
  FREE_PLAN_LIMIT_PER_MONTH,
  MAX_TEXT_LENGTH,
  PUBLIC_ANALYZE_RPM,
} from "@/lib/guard/constants";

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="ml-2 text-slate-300 hover:text-slate-300"
      aria-label={`Copy ${value}`}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

export default function SettingsPage() {
  const settings: [string, string][] = [
    ["Maximum text length", `${MAX_TEXT_LENGTH.toLocaleString("en-IN")} characters`],
    ["Default API rate", `${DEFAULT_RPM} requests/minute`],
    ["Public playground rate", `${PUBLIC_ANALYZE_RPM} requests/minute/IP`],
    ["Free monthly limit", `${FREE_PLAN_LIMIT_PER_MONTH.toLocaleString("en-IN")} requests`],
    ["Input policy", "Block leak attempts; rewrite isolated injection or jailbreak text"],
    ["Output policy", "Block system prompt and secret leakage"],
  ];

  const copyableValues = new Set([
    `${MAX_TEXT_LENGTH.toLocaleString("en-IN")} characters`,
    `${DEFAULT_RPM} requests/minute`,
    `${PUBLIC_ANALYZE_RPM} requests/minute/IP`,
    `${FREE_PLAN_LIMIT_PER_MONTH.toLocaleString("en-IN")} requests`,
  ]);

  return (
    <div>
      <p className="eyebrow">Configuration</p>
      <h1 className="mt-2 text-3xl font-bold">Guard Configuration</h1>
      <p className="mt-2 text-sm text-slate-300">These are system-wide defaults. Per-project settings coming soon.</p>
      <div className="card mt-7 max-w-2xl p-6">
        <h2 className="font-semibold">Guard defaults</h2>
        <dl className="mt-5 divide-y divide-slate-800 text-sm">
          {settings.map(([label, value]) => (
            <div className="flex justify-between gap-5 py-4" key={label}>
              <dt className="text-slate-300">{label}</dt>
              <dd className="flex items-center text-right">
                {value}
                {copyableValues.has(value) && <CopyButton value={value} />}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-5 rounded-xl bg-amber-500/5 p-4 text-sm leading-6 text-amber-200">
          These limits are read from your server configuration. Per-project policy editing is on the roadmap.
        </p>
      </div>
    </div>
  );
}
