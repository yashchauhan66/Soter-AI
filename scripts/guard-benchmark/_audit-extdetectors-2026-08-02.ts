/**
 * Audit: the BROWSER extension's real engine. apps/extension/src/lib/scanner.ts
 * imports scanText from packages/detectors — not guard-core and not the SaaS
 * API — so this measures what the published extension can actually detect on
 * the independent held-out corpus. Authored 2026-08-02, never used for tuning.
 * Run: npx tsx scripts/guard-benchmark/_audit-extdetectors-2026-08-02.ts
 */
import { scanText } from "../../packages/detectors/src/index";
import { AUDIT_ATTACKS, AUDIT_BENIGN } from "./_audit-heldout-2026-08-02";

// The extension's policy layer keys off detectedDataTypes; anything with zero
// findings can never produce a warn/block no matter how the policy is set.
const main = () => {
  const byCat = new Map<string, { total: number; hit: number }>();
  const misses: string[] = [];
  let hit = 0;
  const lat: number[] = [];
  for (const c of AUDIT_ATTACKS) {
    const t0 = performance.now();
    const r = scanText(c.text);
    lat.push(performance.now() - t0);
    const caught = r.findings.length > 0;
    if (caught) hit++;
    const agg = byCat.get(c.cat) ?? { total: 0, hit: 0 };
    agg.total++; if (caught) agg.hit++; byCat.set(c.cat, agg);
    if (!caught) misses.push(`  MISS ${c.id} [${c.cat}] :: ${c.text.slice(0, 78)}`);
  }
  const fps: string[] = [];
  let fp = 0;
  for (const c of AUDIT_BENIGN) {
    const t0 = performance.now();
    const r = scanText(c.text);
    lat.push(performance.now() - t0);
    if (r.findings.length > 0) {
      fp++;
      fps.push(`  FLAG ${c.id} [${c.cat}] risk=${r.riskScore} types=${r.detectedDataTypes.join("/")} :: ${c.text.slice(0, 66)}`);
    }
  }
  lat.sort((a, b) => a - b);
  const pct = (n: number, t: number) => `${((n / t) * 100).toFixed(1)}%`;
  console.log("\n═════════ browser extension engine (packages/detectors scanText) ═════════");
  console.log(`ATTACK detection: ${pct(hit, AUDIT_ATTACKS.length)} (${hit}/${AUDIT_ATTACKS.length})`);
  console.log(`BENIGN flagged:   ${pct(fp, AUDIT_BENIGN.length)} (${fp}/${AUDIT_BENIGN.length})`);
  console.log(`Latency: p50 ${lat[Math.floor(lat.length * 0.5)].toFixed(3)}ms · p95 ${lat[Math.floor(lat.length * 0.95)].toFixed(3)}ms`);
  console.log("\n── per-category ──");
  for (const [cat, a] of [...byCat.entries()].sort((x, y) => x[1].hit / x[1].total - y[1].hit / y[1].total)) {
    console.log(`  ${pct(a.hit, a.total).padStart(7)}  ${cat} (${a.hit}/${a.total})`);
  }
  console.log(`\n── benign flags (${fps.length}) ──`);
  fps.forEach((m) => console.log(m));
  console.log(`\n── first 20 of ${misses.length} misses ──`);
  misses.slice(0, 20).forEach((m) => console.log(m));
};
main();
