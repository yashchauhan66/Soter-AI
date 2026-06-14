import {
  DEFAULT_RPM,
  FREE_PLAN_LIMIT_PER_MONTH,
  MAX_TEXT_LENGTH,
  PUBLIC_ANALYZE_RPM,
} from "@/lib/guard/constants";

export default function SettingsPage() {
  const settings = [
    ["Maximum text length", `${MAX_TEXT_LENGTH.toLocaleString("en-IN")} characters`],
    ["Default API rate", `${DEFAULT_RPM} requests/minute`],
    ["Public playground rate", `${PUBLIC_ANALYZE_RPM} requests/minute/IP`],
    ["Free monthly limit", `${FREE_PLAN_LIMIT_PER_MONTH.toLocaleString("en-IN")} requests`],
    ["Input policy", "Block leak attempts; rewrite isolated injection or jailbreak text"],
    ["Output policy", "Block system prompt and secret leakage"],
  ];

  return (
    <div>
      <p className="eyebrow">Configuration</p>
      <h1 className="mt-2 text-3xl font-bold">Settings</h1>
      <div className="card mt-7 max-w-2xl p-6">
        <h2 className="font-semibold">Phase 1 guard defaults</h2>
        <dl className="mt-5 divide-y divide-slate-800 text-sm">
          {settings.map(([label, value]) => (
            <div className="flex justify-between gap-5 py-4" key={label}>
              <dt className="text-slate-500">{label}</dt>
              <dd className="text-right">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-5 rounded-xl bg-amber-500/5 p-4 text-sm leading-6 text-amber-200">
          Phase 1 reads these limits from server environment variables. Per-project policy editing is a Phase 2 capability.
        </p>
      </div>
    </div>
  );
}
