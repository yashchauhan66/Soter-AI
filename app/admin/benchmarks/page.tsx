import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { BENCHMARK_PREVIEW_GAPS } from "@/lib/benchmarks";

export const dynamic = "force-dynamic";

export default async function AdminBenchmarksPage() {
  await requireAdmin();
  const [datasets, runs, snapshots] = await Promise.all([countAll("BenchmarkDataset"), countAll("BenchmarkRun"), countAll("DetectorAccuracySnapshot")]);
  return (
    <div>
      <p className="eyebrow">Admin - Internal Preview</p>
      <h1 className="mt-2 text-3xl font-bold">Benchmark and accuracy preview</h1>
      <p className="mt-3 text-slate-400">Internal benchmark scaffold only. Do not present these counts as production accuracy proof; public snapshots need dataset size, limitations, and no sensitive examples.</p>
      <div className="mt-7 grid gap-4 sm:grid-cols-3">
        {[["Datasets", datasets], ["Runs", runs], ["Public-safe snapshots", snapshots]].map(([label, value]) => <section className="card p-5" key={String(label)}><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-2xl font-bold">{String(value)}</p></section>)}
      </div>
      <section className="card mt-7 p-5">
        <h2 className="text-lg font-semibold">Benchmark preview gap list</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-400">
          {BENCHMARK_PREVIEW_GAPS.map((gap) => (
            <li key={gap}>{gap}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

async function countAll(table: string) {
  const rows = await db.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT COUNT(*)::bigint AS count FROM "${table}"`);
  return Number(rows[0]?.count ?? 0);
}
