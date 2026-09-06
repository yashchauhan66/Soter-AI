/** Validate the exact-binomial McNemar p-value against hand-computable cases. */
function mcnemarExact(b: number, c: number): number {
  const n = b + c;
  if (n === 0) return 1;
  const logFact: number[] = [0];
  for (let i = 1; i <= n; i++) logFact[i] = logFact[i - 1] + Math.log(i);
  const logPmf = (k: number) => logFact[n] - logFact[k] - logFact[n - k] - n * Math.LN2;
  const kObs = Math.min(b, c);
  let tail = 0;
  for (let k = 0; k <= kObs; k++) tail += Math.exp(logPmf(k));
  return Math.min(1, 2 * tail);
}

const cases: Array<[number, number, number | null]> = [
  [0, 0, 1],
  [1, 0, 1],          // 2*0.5 = 1.0
  [2, 0, 0.5],        // 2*0.25
  [3, 0, 0.25],       // 2*0.125
  [10, 0, 2 * Math.pow(0.5, 10)],
  [5, 5, null],
  [8, 1, null],
  [15, 5, null],
  [30, 20, null],
];
let fails = 0;
for (const [b, c, exp] of cases) {
  const p = mcnemarExact(b, c);
  const ok = exp === null || Math.abs(p - exp) < 1e-9;
  if (!ok) fails++;
  console.log(`b=${String(b).padStart(3)} c=${String(c).padStart(3)}  p=${p.toFixed(8)}` +
    (exp !== null ? `   expected ${exp.toFixed(8)}  ${ok ? "OK" : "FAIL"}` : ""));
}
const sym = mcnemarExact(12, 4).toFixed(12) === mcnemarExact(4, 12).toFixed(12);
console.log(`symmetry b/c swap: ${sym ? "OK" : "FAIL"}`);
if (!sym) fails++;
const big = mcnemarExact(400, 350);
console.log(`large n (400,350): p=${big.toFixed(6)} finite=${Number.isFinite(big)}`);
if (!Number.isFinite(big)) fails++;
// A lopsided split must be significant; an even split must not be.
console.log(`(10,0) significant: ${mcnemarExact(10, 0) < 0.05 ? "OK" : "FAIL"}`);
console.log(`(5,5) not significant: ${mcnemarExact(5, 5) > 0.05 ? "OK" : "FAIL"}`);
if (mcnemarExact(10, 0) >= 0.05 || mcnemarExact(5, 5) <= 0.05) fails++;
console.log(fails === 0 ? "\nALL MCNEMAR CHECKS PASSED" : `\n${fails} CHECK(S) FAILED`);
process.exit(fails === 0 ? 0 : 1);
