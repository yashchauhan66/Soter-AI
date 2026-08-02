/**
 * Audit: run the guard-core (browser + IDE extension) engine over the SAME
 * independent held-out corpus used for the SaaS path, to measure the extension
 * product's real recall/FPR. Authored 2026-08-02, never used for tuning.
 */
import { DecisionEngine } from "../../packages/guard-core/src/DecisionEngine";
import { AUDIT_ATTACKS, AUDIT_BENIGN } from "./_audit-heldout-2026-08-02";

const engine = new DecisionEngine();
// guard-core GuardAction values are lowercase: allow | warn | redact | block | approval_required
// thresholds (PolicyEvaluator default): warn 15, redact 35, block 70, approval 85
const MITIGATING = new Set(["warn", "redact", "block", "approval_required"]);
const HARD = new Set(["block", "approval_required"]);
// On benign traffic every non-allow action is user-visible friction in the
// extension UI (warn = overlay banner, redact = content rewritten, block = stop).
const FRICTION = new Set(["warn", "redact", "block", "approval_required"]);

async function main() {
  const byCat = new Map<string, { total: number; hit: number; hard: number }>();
  const misses: string[] = [];
  let hit = 0;
  let hard = 0;
  const lat: number[] = [];
  for (const c of AUDIT_ATTACKS) {
    const t0 = performance.now();
    const d = await engine.scan(c.text, { context: "prompt", skipCache: true });
    lat.push(performance.now() - t0);
    const act = String(d.decision);
    const caught = MITIGATING.has(act);
    if (caught) hit++;
    if (HARD.has(act)) hard++;
    const agg = byCat.get(c.cat) ?? { total: 0, hit: 0, hard: 0 };
    agg.total++; if (caught) agg.hit++; if (HARD.has(act)) agg.hard++; byCat.set(c.cat, agg);
    if (!caught) misses.push(`  MISS ${c.id} [${c.cat}] ${act} score=${d.riskScore} :: ${c.text.slice(0, 80)}`);
  }
  const fps: string[] = [];
  let fp = 0;
  let fpHard = 0;
  for (const c of AUDIT_BENIGN) {
    const t0 = performance.now();
    const d = await engine.scan(c.text, { context: "prompt", skipCache: true });
    lat.push(performance.now() - t0);
    const act = String(d.decision);
    if (FRICTION.has(act)) {
      fp++;
      if (HARD.has(act)) fpHard++;
      fps.push(`  FP   ${c.id} [${c.cat}] ${act} score=${d.riskScore} cats=${d.categories.join("/")} :: ${c.text.slice(0, 76)}`);
    }
  }
  lat.sort((a, b) => a - b);
  const q = (p: number) => lat[Math.min(lat.length - 1, Math.floor(lat.length * p))];
  const pct = (n: number, t: number) => `${((n / t) * 100).toFixed(1)}%`;
  console.log("\n═════════ guard-core (browser + IDE extension) engine, independent held-out set ═════════");
  console.log(`ATTACK recall (any action): ${pct(hit, AUDIT_ATTACKS.length)} (${hit}/${AUDIT_ATTACKS.length})`);
  console.log(`  · hard block/approval:    ${pct(hard, AUDIT_ATTACKS.length)} (${hard}/${AUDIT_ATTACKS.length})`);
  console.log(`BENIGN friction rate:      ${pct(fp, AUDIT_BENIGN.length)} (${fp}/${AUDIT_BENIGN.length})  [hard ${fpHard}]`);
  console.log(`Latency per input: p50 ${q(0.5).toFixed(2)}ms · p95 ${q(0.95).toFixed(2)}ms · max ${lat[lat.length - 1].toFixed(2)}ms`);
  console.log("\n── per-category (any / hard) ──");
  for (const [cat, a] of [...byCat.entries()].sort((x, y) => x[1].hit / x[1].total - y[1].hit / y[1].total)) {
    console.log(`  ${pct(a.hit, a.total).padStart(7)} / ${pct(a.hard, a.total).padStart(7)}  ${cat} (${a.hit}/${a.total})`);
  }
  console.log(`\n── misses (${misses.length}) ──`);
  misses.forEach((m) => console.log(m));
  console.log(`\n── false positives (${fps.length}) ──`);
  fps.forEach((m) => console.log(m));
}
main().catch((e) => { console.error(e); process.exit(1); });
