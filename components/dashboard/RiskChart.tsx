import { BarList } from "@/components/ui/Chart";

/**
 * Top risk types.
 *
 * The bar rendering moved to the shared `BarList` primitive in
 * `components/ui/Chart.tsx`. This file previously owned its own meter markup,
 * which is how the dashboard ended up with three visually different bar meters
 * (this one, the governance provider list, and the usage meter) for the same job.
 *
 * `BarList` also supplies the severity-by-rank tone, so the ranking is legible
 * without reading the labels — the earlier version painted every bar brand teal,
 * i.e. the product's positive colour on a list of risks.
 *
 * Server component; no interactivity.
 */
export function RiskChart({ data }: { data: { label: string; value: number }[] }) {
  return (
    <div className="card p-6">
      <h2 className="text-base font-semibold text-slate-100">Top risk types</h2>
      <BarList
        className="mt-5"
        // Enum names are a database detail: RISK_TYPE_X reads as noise to an
        // operator. Underscores become spaces at the boundary rather than in
        // BarList, which should stay agnostic about where its labels came from.
        data={data.map((item) => ({ ...item, label: item.label.replaceAll("_", " ") }))}
        emptyMessage="No material risks recorded this month."
        showShare
      />
    </div>
  );
}

