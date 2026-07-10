#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════════
// SoterAI — Server-Process Resource Sampler (Phase 5)
// ═══════════════════════════════════════════════════════════════════════════════
// Samples CPU% and working-set (RSS) of the SERVER process — not the load driver —
// while a load test runs against it. Closes the "no server memory/CPU profiling"
// limitation of the earlier harness.
//
// It resolves the PID listening on the target port (Windows: netstat, POSIX: lsof),
// then polls the OS for that process's CPU/memory at a fixed interval, printing a
// JSON summary (peak/mean RSS, peak/mean CPU%) on SIGINT or after a duration.
//
// Usage:
//   node scripts/perf/server-resource-monitor.js --port 3199 --duration 60
//   node scripts/perf/server-resource-monitor.js --pid 2804 --interval 500
//   PID resolved from the port is printed so it can be pinned across runs.
// ═══════════════════════════════════════════════════════════════════════════════

const { execFile } = require("node:child_process");
const os = require("node:os");

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const PORT = Number(arg("port", process.env.LOAD_SERVER_PORT ?? 3199));
const EXPLICIT_PID = arg("pid", process.env.LOAD_SERVER_PID);
const INTERVAL_MS = Number(arg("interval", 500));
const DURATION_S = Number(arg("duration", 0)); // 0 = until SIGINT
const IS_WINDOWS = process.platform === "win32";

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout);
    });
  });
}

async function pidForPort(port) {
  if (IS_WINDOWS) {
    const out = await run("netstat", ["-ano"]);
    for (const line of out.split(/\r?\n/)) {
      if (line.includes(`:${port} `) && /LISTENING/i.test(line)) {
        const pid = line.trim().split(/\s+/).pop();
        if (pid && pid !== "0") return Number(pid);
      }
    }
    throw new Error(`No LISTENING process found on port ${port}.`);
  }
  const out = await run("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"]);
  const pid = out.split(/\s+/).filter(Boolean)[0];
  if (!pid) throw new Error(`No process found on port ${port}.`);
  return Number(pid);
}

// Returns { rssBytes, cpuPercent } for a PID. On Windows uses a single WMIC read of
// WorkingSetSize + a delta of KernelModeTime/UserModeTime across two samples.
async function sampleWindows(pid, prev) {
  const out = await run("wmic", [
    "process", "where", `ProcessId=${pid}`, "get",
    "WorkingSetSize,KernelModeTime,UserModeTime", "/format:csv",
  ]);
  const line = out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).find((l) => /^\S+,\d/.test(l) && l.split(",").length >= 4);
  if (!line) throw new Error(`Process ${pid} not found (exited?).`);
  const parts = line.split(",");
  // CSV columns (sorted alpha): Node,KernelModeTime,UserModeTime,WorkingSetSize
  const kernel = Number(parts[1]);
  const user = Number(parts[2]);
  const rssBytes = Number(parts[3]);
  const cpu100ns = kernel + user; // 100-nanosecond ticks
  const now = performance.now();
  let cpuPercent = 0;
  if (prev) {
    const cpuMs = (cpu100ns - prev.cpu100ns) / 10_000; // 100ns → ms
    const wallMs = now - prev.now;
    if (wallMs > 0) cpuPercent = (cpuMs / wallMs) * 100 / os.cpus().length;
  }
  return { rssBytes, cpuPercent, _state: { cpu100ns, now } };
}

async function samplePosix(pid, prev) {
  // ps reports %cpu (since process start) and rss in KB.
  const out = await run("ps", ["-o", "rss=,%cpu=", "-p", String(pid)]);
  const [rssKb, pcpu] = out.trim().split(/\s+/).map(Number);
  return { rssBytes: rssKb * 1024, cpuPercent: pcpu, _state: {} };
}

async function main() {
  const pid = EXPLICIT_PID ? Number(EXPLICIT_PID) : await pidForPort(PORT);
  const sampler = IS_WINDOWS ? sampleWindows : samplePosix;
  console.error(`[monitor] sampling PID ${pid} every ${INTERVAL_MS}ms${DURATION_S ? ` for ${DURATION_S}s` : " until SIGINT"}`);

  const rss = [];
  const cpu = [];
  let prev = null;
  let stopped = false;

  const deadline = DURATION_S ? Date.now() + DURATION_S * 1000 : Infinity;
  process.on("SIGINT", () => { stopped = true; });
  process.on("SIGTERM", () => { stopped = true; });

  while (!stopped && Date.now() < deadline) {
    try {
      const s = await sampler(pid, prev);
      prev = s._state;
      rss.push(s.rssBytes);
      if (s.cpuPercent > 0 || rss.length > 1) cpu.push(s.cpuPercent);
    } catch (e) {
      console.error(`[monitor] ${e.message}`);
      break;
    }
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }

  const mb = (b) => +(b / 1024 / 1024).toFixed(1);
  const mean = (a) => (a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2) : 0);
  const max = (a) => (a.length ? +Math.max(...a).toFixed(2) : 0);

  const summary = {
    pid,
    port: EXPLICIT_PID ? undefined : PORT,
    samples: rss.length,
    intervalMs: INTERVAL_MS,
    server: {
      peakRssMb: mb(Math.max(...rss, 0)),
      meanRssMb: mb(rss.reduce((x, y) => x + y, 0) / (rss.length || 1)),
      peakCpuPercent: max(cpu),
      meanCpuPercent: mean(cpu),
      cpuCores: os.cpus().length,
    },
  };
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(`[monitor] fatal: ${e.message}`);
  process.exitCode = 1;
});
