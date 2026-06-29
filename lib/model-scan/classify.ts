/**
 * Classification of pickle imports into supply-chain risk severities, plus the
 * dangerous-callable database. Mirrors the threat model used by picklescan /
 * Protect AI modelscan / HiddenLayer model scanners.
 */
import type { PickleImport } from "./pickle";

export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

const SEVERITY_ORDER: Severity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
export function maxSeverity(a: Severity, b: Severity): Severity {
  return SEVERITY_ORDER.indexOf(a) >= SEVERITY_ORDER.indexOf(b) ? a : b;
}
export function highestSeverity(list: Severity[]): Severity {
  return list.reduce<Severity>((acc, s) => maxSeverity(acc, s), "LOW");
}

// Direct arbitrary code / command execution → CRITICAL.
const CRITICAL_MODULES = new Set([
  "os", "posix", "nt", "subprocess", "runpy", "pty", "commands", "popen2",
  "multiprocessing", "asyncio.subprocess",
]);
const CRITICAL_CALLABLES: Record<string, Set<string>> = {
  builtins: new Set(["eval", "exec", "compile", "__import__", "execfile", "input"]),
  __builtin__: new Set(["eval", "exec", "compile", "__import__", "execfile", "input"]),
  os: new Set(["*"]),
  posix: new Set(["*"]),
  nt: new Set(["*"]),
  subprocess: new Set(["*"]),
  runpy: new Set(["*"]),
  pty: new Set(["spawn"]),
  code: new Set(["interact", "InteractiveInterpreter", "InteractiveConsole"]),
  bdb: new Set(["run"]),
  pdb: new Set(["run", "runeval", "runcall"]),
  timeit: new Set(["timeit", "Timer"]),
};

// Network / fs / reflection / nested deserialization → HIGH.
const HIGH_MODULES = new Set([
  "socket", "ssl", "ftplib", "telnetlib", "smtplib", "ctypes", "cffi",
  "requests", "urllib", "urllib2", "urllib.request", "httplib", "http.client",
  "shutil", "webbrowser", "importlib", "imp", "dill", "marshal", "shelve",
  "venv", "sysconfig", "distutils",
]);
const HIGH_CALLABLES: Record<string, Set<string>> = {
  builtins: new Set(["getattr", "setattr", "open", "globals", "vars", "delattr"]),
  __builtin__: new Set(["getattr", "setattr", "open", "globals", "vars", "delattr"]),
  operator: new Set(["attrgetter", "methodcaller", "itemgetter"]),
  functools: new Set(["partial", "reduce"]),
  pickle: new Set(["loads", "load", "Unpickler"]),
  _pickle: new Set(["loads", "load", "Unpickler"]),
  numpy: new Set(["load", "loads"]),
  sys: new Set(["*"]),
  base64: new Set(["b64decode", "b64decode"]),
};

export interface ImportFinding {
  module: string;
  name: string;
  severity: Severity;
  reason: string;
}

export function classifyImport(imp: PickleImport): ImportFinding | null {
  const module = imp.module.trim();
  const name = imp.name.trim();
  const root = module.split(".")[0];

  const critSet = CRITICAL_CALLABLES[module] ?? CRITICAL_CALLABLES[root];
  if (CRITICAL_MODULES.has(module) || CRITICAL_MODULES.has(root) || (critSet && (critSet.has("*") || critSet.has(name)))) {
    return { module, name, severity: "CRITICAL", reason: `Imports ${module}.${name}, which enables arbitrary code or command execution.` };
  }

  const highSet = HIGH_CALLABLES[module] ?? HIGH_CALLABLES[root];
  if (HIGH_MODULES.has(module) || HIGH_MODULES.has(root) || (highSet && (highSet.has("*") || highSet.has(name)))) {
    return { module, name, severity: "HIGH", reason: `Imports ${module}.${name}, which can reach the network, filesystem, or nested deserialization.` };
  }

  return null;
}

// Modules that legitimately appear in ML weight pickles (numpy/torch reconstructors).
const KNOWN_SAFE_PREFIXES = [
  "numpy", "numpy.core", "numpy._core", "torch", "torch._utils", "torch.storage",
  "collections", "_codecs", "copyreg", "__main__", "argparse", "pandas",
  "sklearn", "scipy", "joblib",
];

export function isKnownSafeImport(imp: PickleImport): boolean {
  const m = imp.module.trim();
  return KNOWN_SAFE_PREFIXES.some((p) => m === p || m.startsWith(p + "."));
}
