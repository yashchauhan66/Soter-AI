/**
 * Deterministic benchmark-mode setup and environment fingerprinting.
 *
 * Latency numbers are only comparable across runs when the conditions that move
 * them are recorded with the numbers. This module captures those conditions and
 * applies the controls a local benchmark can legitimately apply.
 *
 * It deliberately does NOT change any security behaviour: it never disables a
 * detector, never lowers a threshold, and never touches policy. The only process
 * state it mutates is scheduling priority, GC timing, and benchmark-scoped env
 * vars that select *deterministic* (not weaker) code paths.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import os from "node:os";
import { performance, PerformanceObserver } from "node:perf_hooks";
import v8 from "node:v8";

export interface CpuLoadSnapshot {
  /** OS 1/5/15-minute load average. 0 on Windows (not implemented by the OS). */
  loadavg: number[];
  /** Aggregate busy fraction across all cores, sampled over `sampleMs`. */
  busyFraction: number;
  sampleMs: number;
  cores: number;
}

export interface EnvFingerprint {
  capturedAt: string;
  node: {
    version: string;
    v8: string;
    execArgv: string[];
    /** True when --expose-gc is available, i.e. GC can be controlled. */
    gcExposed: boolean;
    /** True when the JIT-affecting flags that make runs non-comparable are absent. */
    jitDefaults: boolean;
    heapSizeLimitMiB: number;
  };
  os: {
    platform: string;
    release: string;
    arch: string;
    totalMemMiB: number;
    freeMemMiB: number;
  };
  cpu: {
    model: string;
    logicalCores: number;
    speedMHz: number;
    /**
     * Windows: current/max clock as reported by CIM, which is the closest
     * available equivalent of a Linux CPU governor reading. `null` when the
     * query is unavailable or not authorised.
     */
    governor: {
      source: string;
      currentClockMHz: number | null;
      maxClockMHz: number | null;
      note: string;
    };
  };
  process: {
    pid: number;
    /** OS scheduling priority after benchmark-mode setup. */
    priority: number;
    priorityLabel: string;
    priorityRequested: string;
    priorityApplied: boolean;
  };
  load: {
    before: CpuLoadSnapshot;
  };
  /** Names of processes that can move a latency percentile if they run mid-trial. */
  backgroundProcesses: {
    counted: number;
    notable: Array<{ name: string; cpuSeconds: number | null }>;
    source: string;
  };
  benchmarkMode: {
    envApplied: Record<string, string>;
    warmupIterations: number;
    gcBetweenPhases: boolean;
  };
}

export interface GcAccounting {
  collections: number;
  totalPauseMs: number;
  maxPauseMs: number;
  byKind: Record<string, number>;
}

const PRIORITY_LABELS: Record<number, string> = {
  [-20]: "PRIORITY_HIGHEST",
  [-14]: "PRIORITY_HIGH",
  [-7]: "PRIORITY_ABOVE_NORMAL",
  0: "PRIORITY_NORMAL",
  10: "PRIORITY_BELOW_NORMAL",
  19: "PRIORITY_LOW",
};

function priorityLabel(value: number): string {
  return PRIORITY_LABELS[value] ?? `raw(${value})`;
}

/** Sample aggregate CPU busy fraction over a short window. */
export function sampleCpuLoad(sampleMs = 250): CpuLoadSnapshot {
  const read = () => {
    let idle = 0;
    let total = 0;
    for (const cpu of os.cpus()) {
      for (const [kind, value] of Object.entries(cpu.times)) {
        total += value;
        if (kind === "idle") idle += value;
      }
    }
    return { idle, total };
  };
  const a = read();
  const deadline = performance.now() + sampleMs;
  // Deliberate busy-free wait: Atomics.wait blocks without burning the CPU we
  // are trying to measure.
  const shared = new Int32Array(new SharedArrayBuffer(4));
  while (performance.now() < deadline) {
    Atomics.wait(shared, 0, 0, Math.max(1, deadline - performance.now()));
  }
  const b = read();
  const idleDelta = b.idle - a.idle;
  const totalDelta = b.total - a.total;
  return {
    loadavg: os.loadavg(),
    busyFraction: totalDelta > 0 ? Number((1 - idleDelta / totalDelta).toFixed(4)) : 0,
    sampleMs,
    cores: os.cpus().length,
  };
}

function readWindowsGovernor(): EnvFingerprint["cpu"]["governor"] {
  if (process.platform !== "win32") {
    return {
      source: "unavailable",
      currentClockMHz: null,
      maxClockMHz: null,
      note: "governor read is implemented for win32 only in this harness",
    };
  }
  try {
    const out = execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "$c = Get-CimInstance Win32_Processor | Select-Object -First 1; " +
          "Write-Output ($c.CurrentClockSpeed.ToString() + ',' + $c.MaxClockSpeed.ToString())",
      ],
      { encoding: "utf8", timeout: 20_000, windowsHide: true },
    ).trim();
    const [current, max] = out.split(",").map((v) => Number(v));
    return {
      source: "Win32_Processor (CIM)",
      currentClockMHz: Number.isFinite(current) ? current : null,
      maxClockMHz: Number.isFinite(max) ? max : null,
      note:
        "Windows exposes no Linux-style cpufreq governor. CurrentClockSpeed vs MaxClockSpeed " +
        "is the available proxy for whether the CPU is throttled or boosting during the trial.",
    };
  } catch (err) {
    return {
      source: "Win32_Processor (CIM) — query failed",
      currentClockMHz: null,
      maxClockMHz: null,
      note: `governor proxy unavailable: ${(err as Error).message.slice(0, 160)}`,
    };
  }
}

/** Processes that historically move percentiles on a developer laptop. */
const NOTABLE_PROCESS_RE =
  /^(OneDrive|Dropbox|GoogleDriveFS|MsMpEng|MpDefenderCoreService|SearchIndexer|SearchProtocolHost|TiWorker|TrustedInstaller|Code|Cursor|Windsurf|chrome|msedge|firefox|Teams|Docker Desktop|com\.docker\.backend|dockerd|node|zoom|Slack|Spotify)/i;

function readBackgroundProcesses(): EnvFingerprint["backgroundProcesses"] {
  if (process.platform !== "win32") {
    return { counted: 0, notable: [], source: "unavailable (win32 only in this harness)" };
  }
  try {
    const out = execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Get-Process | ForEach-Object { $_.ProcessName + '|' + [string]$_.CPU }",
      ],
      { encoding: "utf8", timeout: 25_000, windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
    );
    const rows = out
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, cpu] = line.split("|");
        const cpuSeconds = Number(cpu);
        return { name, cpuSeconds: Number.isFinite(cpuSeconds) ? Number(cpuSeconds.toFixed(2)) : null };
      });
    const notable = new Map<string, number | null>();
    for (const row of rows) {
      if (!NOTABLE_PROCESS_RE.test(row.name)) continue;
      const prev = notable.get(row.name);
      const next = (prev ?? 0) + (row.cpuSeconds ?? 0);
      notable.set(row.name, Number(next.toFixed(2)));
    }
    return {
      counted: rows.length,
      notable: [...notable.entries()]
        .map(([name, cpuSeconds]) => ({ name, cpuSeconds }))
        .sort((a, b) => (b.cpuSeconds ?? 0) - (a.cpuSeconds ?? 0))
        .slice(0, 15),
      source: "Get-Process",
    };
  } catch (err) {
    return {
      counted: 0,
      notable: [],
      source: `Get-Process failed: ${(err as Error).message.slice(0, 160)}`,
    };
  }
}

export interface BenchmarkModeOptions {
  /** Requested OS scheduling priority. Default: above-normal, never realtime. */
  priority?: "normal" | "above_normal" | "high";
  warmupIterations: number;
  gcBetweenPhases: boolean;
  /**
   * Deterministic env vars applied for the run. These must only *pin* behaviour
   * (e.g. force the hybrid detection tier that production uses) — never weaken it.
   */
  env?: Record<string, string>;
}

/**
 * Apply the controls a local benchmark may legitimately apply, then fingerprint
 * the resulting environment. Returns the fingerprint for the evidence artifact.
 */
export function enterBenchmarkMode(options: BenchmarkModeOptions): EnvFingerprint {
  const requested = options.priority ?? "above_normal";
  const priorityValue =
    requested === "high" ? os.constants.priority.PRIORITY_HIGH
      : requested === "above_normal" ? os.constants.priority.PRIORITY_ABOVE_NORMAL
      : os.constants.priority.PRIORITY_NORMAL;

  let priorityApplied = false;
  try {
    os.setPriority(process.pid, priorityValue);
    priorityApplied = true;
  } catch {
    // Raising priority can require elevation; a failure is recorded, not fatal.
    priorityApplied = false;
  }

  const envApplied: Record<string, string> = {};
  for (const [key, value] of Object.entries(options.env ?? {})) {
    process.env[key] = value;
    envApplied[key] = value;
  }

  const load = sampleCpuLoad(250);

  let priority = 0;
  try {
    priority = os.getPriority(process.pid);
  } catch {
    priority = Number.NaN;
  }

  const cpus = os.cpus();
  return {
    capturedAt: new Date().toISOString(),
    node: {
      version: process.version,
      v8: process.versions.v8,
      execArgv: [...process.execArgv],
      gcExposed: typeof (globalThis as { gc?: () => void }).gc === "function",
      jitDefaults: !process.execArgv.some((a) =>
        /^--(jitless|no-opt|max-opt|no-turbofan|interpreted-frames-native-stack|predictable)/.test(a),
      ),
      heapSizeLimitMiB: Number((v8.getHeapStatistics().heap_size_limit / 1024 / 1024).toFixed(1)),
    },
    os: {
      platform: process.platform,
      release: os.release(),
      arch: process.arch,
      totalMemMiB: Number((os.totalmem() / 1024 / 1024).toFixed(1)),
      freeMemMiB: Number((os.freemem() / 1024 / 1024).toFixed(1)),
    },
    cpu: {
      model: cpus[0]?.model ?? "unknown",
      logicalCores: cpus.length,
      speedMHz: cpus[0]?.speed ?? 0,
      governor: readWindowsGovernor(),
    },
    process: {
      pid: process.pid,
      priority,
      priorityLabel: priorityLabel(priority),
      priorityRequested: requested,
      priorityApplied,
    },
    load: { before: load },
    backgroundProcesses: readBackgroundProcesses(),
    benchmarkMode: {
      envApplied,
      warmupIterations: options.warmupIterations,
      gcBetweenPhases: options.gcBetweenPhases,
    },
  };
}

/** Force a full GC when --expose-gc is present. Returns whether it ran. */
export function collectGarbage(): boolean {
  const gc = (globalThis as { gc?: (options?: { type?: string; execution?: string }) => void }).gc;
  if (typeof gc !== "function") return false;
  try {
    gc({ type: "major", execution: "sync" });
  } catch {
    gc();
  }
  return true;
}

/**
 * Observe GC pauses for the duration of a measured phase so a percentile can be
 * attributed to (or cleared of) garbage collection instead of policy cost.
 */
export function startGcAccounting(): () => GcAccounting {
  const acc: GcAccounting = { collections: 0, totalPauseMs: 0, maxPauseMs: 0, byKind: {} };
  const kinds: Record<number, string> = {
    1: "scavenge",
    2: "minor_mark_compact",
    4: "mark_sweep_compact",
    8: "incremental_marking",
    16: "weak_callbacks",
  };
  let observer: PerformanceObserver | undefined;
  try {
    observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const kind = kinds[(entry as unknown as { detail?: { kind?: number } }).detail?.kind ?? 0] ?? "other";
        acc.collections += 1;
        acc.totalPauseMs += entry.duration;
        acc.maxPauseMs = Math.max(acc.maxPauseMs, entry.duration);
        acc.byKind[kind] = Number(((acc.byKind[kind] ?? 0) + entry.duration).toFixed(4));
      }
    });
    observer.observe({ entryTypes: ["gc"] });
  } catch {
    observer = undefined;
  }
  return () => {
    try {
      observer?.disconnect();
    } catch {
      /* ignore */
    }
    return {
      collections: acc.collections,
      totalPauseMs: Number(acc.totalPauseMs.toFixed(4)),
      maxPauseMs: Number(acc.maxPauseMs.toFixed(4)),
      byKind: acc.byKind,
    };
  };
}

/** Stable content fingerprint of a benchmark payload, for run-to-run comparison. */
export function payloadFingerprint(value: unknown): { bytes: number; sha256: string } {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  return {
    bytes: Buffer.byteLength(serialized, "utf8"),
    sha256: createHash("sha256").update(serialized).digest("hex").slice(0, 16),
  };
}
