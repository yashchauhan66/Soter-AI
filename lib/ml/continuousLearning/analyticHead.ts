/**
 * Analytic (gradient-free) continual-learning head.
 *
 * WHY THIS EXISTS — the honest version of "har minute train hota rahe"
 *   Retraining transformer WEIGHTS every minute cannot work: there is no window to
 *   validate in, and each update risks catastrophic forgetting (this repo has the
 *   receipt — v4 was newer than v3 and measured WORSE on identical rows). So the
 *   naive loop makes the model weaker while reporting that it is learning.
 *
 *   Analytic Continual Learning solves exactly this shape. Freeze the encoder, and
 *   update only a LINEAR head with recursive least squares. The update is:
 *
 *     - closed-form (no gradients, no learning rate, no epochs, no convergence risk)
 *     - O(d^2) per sample — microseconds at d=512, on CPU, in-process
 *     - provably equal to ridge regression retrained on ALL data seen so far
 *
 *   That last property is the whole point, and this module's test asserts it to
 *   1e-9: learning incrementally gives bit-for-bit the same head as retraining from
 *   scratch on everything. "Non-forgetting" here is not a mitigation or a heuristic
 *   — the forgetting term is algebraically absent.
 *
 *   References: ACIL (Zhuang et al. 2022) established RLS-based class-incremental
 *   learning as equivalent to joint training; REAL / DS-AL / GACL extend it. The
 *   fit to this codebase is unusually clean because `embed()` in
 *   lib/guard/semanticClassifier.ts is ALREADY a frozen, deterministic, 512-dim
 *   L2-normalized encoder running synchronously in the guard hot path.
 *
 * WHAT THIS BUYS, STATED HONESTLY
 *   A linear head over feature-hashed n-grams is not a transformer. It will not
 *   match v7 on semantics. What it does is learn a NEW attack shape within seconds
 *   of a human labelling it, with a mathematical guarantee that nothing already
 *   learned is lost — which is the property the fast tier needs and the one the
 *   slow (weights) tier cannot provide. It is a complement to v7, never a
 *   replacement, and like every other tier it stays behind the promotion gate.
 *
 * WHAT IT DOES NOT DO
 *   No I/O, no clock, no network, no global state. It does not decide anything in
 *   the guard path; wiring it there requires the same measured evidence every other
 *   tier needed (promotionGate.ts).
 */

/**
 * Ridge regularization. Also sets the initial inverse-autocorrelation P0 = I/lambda,
 * so it doubles as the prior strength: larger = the head moves more slowly on early
 * samples. 1.0 is the neutral default used by the ACIL line of work.
 */
export const DEFAULT_RIDGE = 1.0;

export interface AnalyticHeadState {
  dim: number;
  classes: number;
  ridge: number;
  /** Row-major d*d inverse autocorrelation. */
  p: number[];
  /** Row-major d*c weights. */
  w: number[];
  samplesSeen: number;
}

/**
 * A linear head trained by recursive least squares over a frozen feature space.
 *
 * Invariant maintained after every `learn` call, for any order and any batching:
 *
 *     W == (X^T X + ridge*I)^-1 X^T Y   over every sample ever passed to learn()
 *
 * i.e. the incremental head IS the batch-retrained head. Asserted in
 * tests/ml/analytic-head.test.ts against a direct dense solve.
 */
export class AnalyticHead {
  readonly dim: number;
  readonly classes: number;
  readonly ridge: number;

  /** Inverse autocorrelation (d x d), symmetric. Starts at I/ridge. */
  private p: Float64Array;
  /** Weights (d x c), row-major. Starts at zero. */
  private w: Float64Array;
  private seen = 0;

  /** Scratch buffers, allocated once — learn() is on a per-request path. */
  private readonly u: Float64Array;
  private readonly err: Float64Array;

  constructor(dim: number, classes: number, ridge: number = DEFAULT_RIDGE) {
    if (!Number.isInteger(dim) || dim <= 0) throw new Error(`dim must be a positive integer, got ${dim}`);
    if (!Number.isInteger(classes) || classes <= 0) throw new Error(`classes must be a positive integer, got ${classes}`);
    if (!(ridge > 0) || !Number.isFinite(ridge)) throw new Error(`ridge must be a positive finite number, got ${ridge}`);

    this.dim = dim;
    this.classes = classes;
    this.ridge = ridge;

    this.p = new Float64Array(dim * dim);
    for (let i = 0; i < dim; i += 1) this.p[i * dim + i] = 1 / ridge;
    this.w = new Float64Array(dim * classes);
    this.u = new Float64Array(dim);
    this.err = new Float64Array(classes);
  }

  get samplesSeen(): number {
    return this.seen;
  }

  /**
   * Score one feature vector. Returns a `classes`-length raw score vector.
   * Caller decides how to threshold — this head is a scorer, not a decision.
   */
  predict(x: Float64Array | number[]): Float64Array {
    if (x.length !== this.dim) throw new Error(`expected ${this.dim} features, got ${x.length}`);
    const { dim, classes, w } = this;
    const out = new Float64Array(classes);
    for (let i = 0; i < dim; i += 1) {
      const xi = x[i];
      if (xi === 0) continue; // embed() output is sparse-ish; skipping is a real win
      const row = i * classes;
      for (let c = 0; c < classes; c += 1) out[c] += xi * w[row + c];
    }
    return out;
  }

  /**
   * Absorb one labelled sample. Rank-1 RLS update:
   *
   *     u = P x                (d)
   *     s = 1 + x.u            (scalar, always >= 1 since P stays PSD)
   *     g = u / s              (d)   the Kalman-style gain
   *     W += g (y - W^T x)^T   (d x c rank-1 outer product)
   *     P -= u u^T / s         (d x d rank-1 downdate; P symmetric so x^T P = u^T)
   *
   * Processing samples one at a time is not an approximation of the batch update —
   * for RLS the two are identical, which is why order and batching do not matter.
   *
   * @param x frozen-encoder features, length `dim`
   * @param y target vector, length `classes` (one-hot, or +-1, or soft — any target
   *          the least-squares objective is meaningful for)
   */
  learn(x: Float64Array | number[], y: Float64Array | number[]): void {
    if (x.length !== this.dim) throw new Error(`expected ${this.dim} features, got ${x.length}`);
    if (y.length !== this.classes) throw new Error(`expected ${this.classes} targets, got ${y.length}`);

    const { dim, classes, p, w, u, err } = this;

    // u = P x, and s = 1 + x.u, in one pass over P.
    let s = 1;
    for (let i = 0; i < dim; i += 1) {
      const row = i * dim;
      let acc = 0;
      for (let j = 0; j < dim; j += 1) acc += p[row + j] * x[j];
      u[i] = acc;
      s += x[i] * acc;
    }

    // s is 1 + x^T P x with P positive semi-definite, so s >= 1. A non-finite s
    // means the caller passed non-finite features; refuse rather than poison P.
    if (!Number.isFinite(s) || s < 1) {
      throw new Error(`RLS denominator ${s} is invalid — feature vector must be finite`);
    }

    // err = y - W^T x
    for (let c = 0; c < classes; c += 1) err[c] = y[c];
    for (let i = 0; i < dim; i += 1) {
      const xi = x[i];
      if (xi === 0) continue;
      const row = i * classes;
      for (let c = 0; c < classes; c += 1) err[c] -= xi * w[row + c];
    }

    // W += (u/s) err^T
    for (let i = 0; i < dim; i += 1) {
      const gi = u[i] / s;
      if (gi === 0) continue;
      const row = i * classes;
      for (let c = 0; c < classes; c += 1) w[row + c] += gi * err[c];
    }

    // P -= u u^T / s. Written symmetrically so floating-point drift cannot make P
    // asymmetric over millions of updates, which would silently break the invariant.
    for (let i = 0; i < dim; i += 1) {
      const ui = u[i];
      if (ui === 0) continue;
      const scaled = ui / s;
      const row = i * dim;
      for (let j = i; j < dim; j += 1) {
        const delta = scaled * u[j];
        p[row + j] -= delta;
        if (j !== i) p[j * dim + i] -= delta;
      }
    }

    this.seen += 1;
  }

  /** Absorb a batch. Identical result to calling learn() per row, in any order. */
  learnBatch(xs: ReadonlyArray<Float64Array | number[]>, ys: ReadonlyArray<Float64Array | number[]>): void {
    if (xs.length !== ys.length) throw new Error(`${xs.length} feature rows vs ${ys.length} target rows`);
    for (let i = 0; i < xs.length; i += 1) this.learn(xs[i], ys[i]);
  }

  /**
   * Serialize. P is d*d doubles (2 MB at d=512), which is the real cost of this
   * approach — stated here rather than discovered in production.
   */
  toJSON(): AnalyticHeadState {
    return {
      dim: this.dim,
      classes: this.classes,
      ridge: this.ridge,
      p: Array.from(this.p),
      w: Array.from(this.w),
      samplesSeen: this.seen,
    };
  }

  static fromJSON(state: AnalyticHeadState): AnalyticHead {
    const head = new AnalyticHead(state.dim, state.classes, state.ridge);
    if (state.p.length !== state.dim * state.dim) throw new Error("P has the wrong shape for dim");
    if (state.w.length !== state.dim * state.classes) throw new Error("W has the wrong shape for dim/classes");
    head.p = Float64Array.from(state.p);
    head.w = Float64Array.from(state.w);
    head.seen = state.samplesSeen;
    return head;
  }
}
