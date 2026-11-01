"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// docs/soterai-lite/evidence/20261029-f26b-prepush-70e1c9a4/local-push-admission-02.cjs
var require_local_push_admission_02 = __commonJS({
  "docs/soterai-lite/evidence/20261029-f26b-prepush-70e1c9a4/local-push-admission-02.cjs"(exports2, module2) {
    "use strict";
    var assert2 = require("node:assert/strict");
    var path = require("node:path").win32;
    var VSIX = "6c299712aa6f8da35b32bacc12b3e4b26b9e5d26689a2fdcb7b06eadb186d12b";
    var SOURCE2 = "81fb9f8d559434242a67a316f0609a5c79c1b6b351cb783d7f3af365669f495f";
    var NATIVE = "995f5d4c122d0ef3d86184bf3d12d7ebd67d5b1114222bfd907a27d4d1e55c53";
    function canonicalDrive2(value) {
      assert2.equal(typeof value, "string");
      return value.replace(/^[dD]:\\/, "D:\\");
    }
    function locations(root2, collector2) {
      root2 = canonicalDrive2(root2);
      collector2 = canonicalDrive2(collector2);
      assert2.equal(typeof root2, "string");
      assert2.equal(typeof collector2, "string");
      assert2(/^D:\\SoterAI-Lite-test-profiles\\f26b-configured-push-[0-9]{8}T[0-9]{6}Z-[a-f0-9]{8}\\workspace$/.test(root2));
      assert2.equal(path.normalize(root2), root2);
      assert2.equal(collector2, path.join(path.dirname(root2), "collector.git"));
      assert2.equal(path.normalize(collector2), collector2);
    }
    function objectId(value) {
      assert2.equal(typeof value, "string");
      assert2(/^[a-f0-9]{40}$/.test(value) && value !== "0".repeat(40));
    }
    function authorizeLocalPush2(authority, root2, collector2, binding) {
      locations(root2, collector2);
      assert2(authority && Object.getPrototypeOf(authority) === Object.prototype);
      assert2.deepEqual(Object.keys(authority).sort(), ["schemaVersion", "kind", "allowedFixtureRuns", "allowedPushInvocations", "externalNetwork", "root", "collector", "vsixSha256", "sourceProofSha256", "native36AcceptanceSha256", "bindingSha256"].sort());
      assert2.equal(authority.schemaVersion, 1);
      assert2.equal(authority.kind, "EXPLICIT_USER_ONE_F26B_LOCAL_SYNTHETIC_PUSH_FIXTURE");
      assert2.equal(authority.allowedFixtureRuns, 1);
      assert2.equal(authority.allowedPushInvocations, 2);
      assert2.equal(authority.externalNetwork, false);
      assert2.equal(canonicalDrive2(authority.root), canonicalDrive2(root2));
      assert2.equal(canonicalDrive2(authority.collector), canonicalDrive2(collector2));
      assert2.equal(authority.vsixSha256, VSIX);
      assert2.equal(authority.sourceProofSha256, SOURCE2);
      assert2.equal(authority.native36AcceptanceSha256, NATIVE);
      assert2(typeof binding === "string" && /^[a-f0-9]{64}$/.test(binding));
      assert2.equal(authority.bindingSha256, binding);
    }
    function localRemoteSection2(root2, collector2) {
      locations(root2, collector2);
      return '\n[remote "synthetic-file-only"]\n	url = ' + collector2.replaceAll("\\", "/") + "\n";
    }
    function localPushArgs2(root2, collector2, tip, target, index) {
      locations(root2, collector2);
      objectId(tip);
      assert2(Number.isSafeInteger(index) && index >= 0 && index < 2);
      assert2.equal(target, index === 0 ? "refs/heads/public" : "refs/heads/blocked-secret");
      return ["--no-optional-locks", "-c", "protocol.allow=never", "-c", "protocol.file.allow=always", "-c", "gc.auto=0", "-c", "maintenance.auto=false", "-c", "core.fsmonitor=false", "-C", root2, "push", "--porcelain", "--no-progress", "--no-thin", "--no-follow-tags", "synthetic-file-only", tip + ":" + target];
    }
    function collectorProbeArgs2(root2, collector2, oid) {
      locations(root2, collector2);
      objectId(oid);
      return ["--no-optional-locks", "--git-dir=" + collector2, "cat-file", "-e", oid];
    }
    module2.exports = { canonicalDrive: canonicalDrive2, authorizeLocalPush: authorizeLocalPush2, localRemoteSection: localRemoteSection2, localPushArgs: localPushArgs2, collectorProbeArgs: collectorProbeArgs2 };
  }
});

// docs/soterai-lite/evidence/20261029-f26b-prepush-70e1c9a4/native-configured-push-02.host.ts.txt
var native_configured_push_02_host_ts_exports = {};
__export(native_configured_push_02_host_ts_exports, {
  beforeActivate: () => beforeActivate,
  run: () => run,
  setupDiagnostic: () => setupDiagnostic
});
module.exports = __toCommonJS(native_configured_push_02_host_ts_exports);
var vscode = __toESM(require("vscode"));
var import_strict = __toESM(require("node:assert/strict"));
var import_node_crypto = require("node:crypto");
var import_node_child_process = __toESM(require("node:child_process"));
var import_node_fs = __toESM(require("node:fs"));
var import_promises = __toESM(require("node:fs/promises"));
var import_node_http = __toESM(require("node:http"));
var import_node_path = require("node:path");
var import_node_zlib = require("node:zlib");
var { canonicalDrive, authorizeLocalPush, localRemoteSection, localPushArgs, collectorProbeArgs } = require_local_push_admission_02();
var GIT = "C:\\Program Files\\Git\\cmd\\git.exe";
var SH = "C:\\Program Files\\Git\\usr\\bin\\sh.exe";
var GIT_SHA256 = "da240fe9bc24895b3e04150a4990b8a6ff329ecabcd8f19684c2cc310da5ef3f";
var SH_SHA256 = "fc362aae1f217d34d02237d99527839dd6cf85b37c7a0277109400bfa0faa594";
var PREFIX = "SOTERAI_LITE_F26B_HOOK_";
var FLAG = "lite.historyHooks.prePush";
var MARKER = ".synthetic-lite-f26b-prepush-host";
var SOURCE = ".env.prepush-worktree-unused";
var RENAMED = "unused-renamed.txt";
var PRIVATE = "sk-proj-" + "SYNTHETIC_F26B_NATIVE_PROVIDER_ONLY_VALUE".repeat(2);
var SECRET = "API_KEY=" + PRIVATE + "\n";
var ORIGINAL_ENV = "TEST_ONLY_F26B_ORIGINAL_ENV_70e1c9a4";
var RUNTIME_FILES = ["extension.js", "local-ai-broker.js", "soterai-mcp-server.js", "pre-commit-client.js"];
var ACTIONS = ["Review and install", "Resume reviewed owner", "Review and restore"];
var CHILD_LIMIT = 9e4;
var STREAM_LIMIT = 1048576 + 128 * 96 + 8192;
var ZERO = "0".repeat(40);
var nativeSpawn = import_node_child_process.default.spawn;
var nativeRead = import_promises.default.readFile;
var nativeReadSync = import_node_fs.default.readFileSync;
var nativeCreateServer = import_node_http.default.createServer;
var restorers = [];
var listeners = [];
var originalBodies = /* @__PURE__ */ new Map();
var children = [];
var pendingChildren = [];
var wires = [];
var reviews = [];
var stores = { signing: 0, backupKey: 0, record: 0, recovery: 0, unrelated: 0 };
var ownerListeners = [];
var root = "";
var profile = "";
var parent = "";
var output = "";
var caseId = "SETUP";
var setupStage = "initial";
var phase;
var approve = true;
var halted = false;
var metadataLeak = false;
var sourceDocuments = 0;
var sourceDocumentEvents = 0;
var directWorktreeReads = 0;
var directObjectReads = 0;
var ownerServers = 0;
var contextRef;
var ownerEnvironment = {};
var parentEnvironment = "";
var currentPin;
var codeSha256 = "";
var JOURNAL_LIMIT = 1048576;
var journalHealthy = true;
var journalBytes = 0;
var journalRecords = 0;
var journalCreated = false;
function journal(event, row, childPid) {
  if (!journalHealthy) return;
  let fd;
  try {
    (0, import_strict.default)(["run-enter", "case-start", "case-pass", "case-fail", "child-start", "child-close"].includes(event));
    (0, import_strict.default)(phase === "primary" || phase === "restart");
    const selectedCase = row?.caseId ?? caseId;
    (0, import_strict.default)(/^(?:SETUP|F26B-GP[0-9]{2})$/.test(selectedCase));
    (0, import_strict.default)(childPid === void 0 || Number.isSafeInteger(childPid) && childPid > 0);
    if (row) {
      (0, import_strict.default)(["projection", "scan", "client", "hook-component", "configured-push", "collector-read"].includes(row.kind));
      (0, import_strict.default)(["version", "config", "commits", "tree", "batch", "DIRECT_EXACT_FOURTH_RUNTIME_PRE_PUSH", "DIRECT_INSTALLED_HOOK_NOT_GIT_PUSH", "ACTUAL_GIT_PUSH_LOCAL_PUBLIC", "ACTUAL_GIT_PUSH_LOCAL_BLOCKED_SECRET", "LOCAL_COLLECTOR_OBJECT_PROBE"].includes(row.operation));
    }
    const child = row ? children.indexOf(row) + 1 : null;
    (0, import_strict.default)(child === null || child > 0 && child <= 8192);
    if (event === "child-close") (0, import_strict.default)(row && row.closed && row.stdoutEOF && row.stderrEOF && !row.busy);
    const payload = {
      schemaVersion: 1,
      record: journalRecords + 1,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      event,
      phase,
      caseId: selectedCase,
      hostPid: process.pid,
      child,
      pid: childPid ?? null,
      kind: row?.kind ?? null,
      operation: row?.operation ?? null,
      closed: row?.closed ?? null,
      stdoutEOF: row?.stdoutEOF ?? null,
      stderrEOF: row?.stderrEOF ?? null,
      busy: row?.busy ?? null,
      code: row?.code ?? null,
      signalPresent: row ? row.signal !== null : null,
      timedOut: row?.timedOut ?? null,
      signalsRequested: row?.signalsRequested ?? 0
    };
    const raw = Buffer.from(JSON.stringify(payload) + "\n");
    (0, import_strict.default)(raw.length <= 2048 && journalBytes + raw.length <= JOURNAL_LIMIT && journalRecords < 8192);
    const file = output + ".progress.jsonl";
    (0, import_strict.default)(output && within(parent, file) && !within(root, file));
    if (journalCreated) {
      ordinary(file);
      const stat = import_node_fs.default.lstatSync(file);
      (0, import_strict.default)(stat.isFile() && stat.nlink === 1 && stat.size === journalBytes);
    }
    fd = import_node_fs.default.openSync(file, journalCreated ? "a" : "wx", 384);
    let offset = 0;
    while (offset < raw.length) {
      const count = import_node_fs.default.writeSync(fd, raw, offset, raw.length - offset);
      (0, import_strict.default)(count > 0);
      offset += count;
    }
    import_node_fs.default.closeSync(fd);
    fd = void 0;
    journalCreated = true;
    journalBytes += raw.length;
    journalRecords++;
  } catch {
    journalHealthy = false;
  } finally {
    if (fd !== void 0) {
      try {
        import_node_fs.default.closeSync(fd);
      } catch {
        journalHealthy = false;
      }
    }
  }
}
var sha = (bytes) => (0, import_node_crypto.createHash)("sha256").update(bytes).digest("hex");
var environmentDigest = () => sha(JSON.stringify(Object.entries(process.env).sort(([a], [b]) => a.localeCompare(b))));
var within = (base, file) => {
  const part = (0, import_node_path.relative)((0, import_node_path.resolve)(base), (0, import_node_path.resolve)(file));
  return part === "" || !part.startsWith("..") && !(0, import_node_path.isAbsolute)(part);
};
var samePath = (a, b) => (0, import_node_path.resolve)(a).toLowerCase() === (0, import_node_path.resolve)(b).toLowerCase();
var recordKey = () => "soterai.prePush.record.v1." + sha(root.toLowerCase());
var markerFile = () => (0, import_node_path.join)(root, ".git", "f26b-original-marker");
var tipsFile = () => (0, import_node_path.join)(parent, "prepush-synthetic-tips.json");
var configFile = () => (0, import_node_path.join)(root, ".git", "config");
var BASE_CONFIG = "[core]\n repositoryformatversion = 0\n bare = false\n autocrlf = false\n";
var tips;
function safeMetadata(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value) ?? "";
  if (text.includes(PRIVATE) || text.includes(SECRET) || text.includes(ORIGINAL_ENV)) {
    metadataLeak = true;
    throw Error("Synthetic private content entered public metadata.");
  }
}
function patch(target, name, value) {
  const previous = Object.getOwnPropertyDescriptor(target, name);
  Object.defineProperty(target, name, { configurable: true, writable: true, value });
  restorers.push(() => previous ? Object.defineProperty(target, name, previous) : Reflect.deleteProperty(target, name));
}
async function until(predicate, label, ms = 1e4) {
  const end = performance.now() + ms;
  while (performance.now() < end) {
    if (await predicate()) return;
    await new Promise((done) => setTimeout(done, 20));
  }
  throw Error(label);
}
function ordinary(file) {
  (0, import_strict.default)(within(parent, file) || within(profile, file), "Fixture filesystem access escaped its retained synthetic container.");
  (0, import_strict.default)(!import_node_fs.default.lstatSync(file).isSymbolicLink());
  (0, import_strict.default)(samePath(import_node_fs.default.realpathSync(file), file));
}
async function fact(file) {
  try {
    ordinary(file);
    const stat = await import_promises.default.lstat(file);
    (0, import_strict.default)(stat.isFile() && stat.nlink === 1 && stat.size <= 536870912);
    const bytes = await nativeRead(file);
    return { present: true, bytes: bytes.length, sha256: sha(bytes), mode: stat.mode & 511 };
  } catch (error) {
    if (error.code === "ENOENT") return { present: false, bytes: 0, sha256: null, mode: null };
    throw error;
  }
}
function hashCode() {
  const digest = (0, import_node_crypto.createHash)("sha256"), chunk = Buffer.alloc(65536), fd = import_node_fs.default.openSync(process.execPath, "r");
  try {
    let offset = 0;
    for (; ; ) {
      const count = import_node_fs.default.readSync(fd, chunk, 0, chunk.length, offset);
      if (count === 0) break;
      offset += count;
      (0, import_strict.default)(offset <= 536870912);
      digest.update(chunk.subarray(0, count));
    }
    return digest.digest("hex");
  } finally {
    import_node_fs.default.closeSync(fd);
    chunk.fill(0);
  }
}
function closed(row) {
  (0, import_strict.default)(row.closed && row.stdoutEOF && row.stderrEOF && !row.busy && !row.spawnFailed && !row.streamError && !row.overflow && !row.timedOut);
  import_strict.default.equal(row.signal, null);
  import_strict.default.equal(row.signalsRequested, 0);
  (0, import_strict.default)(row.argumentsValid && row.environmentValid && row.parentEnvironmentUnchanged && !row.invalidInput);
}
function observe(child, kind, operation, argumentsValid = true, environmentValid = true) {
  const row = {
    caseId,
    kind,
    operation,
    closed: false,
    code: null,
    signal: null,
    stdoutEOF: false,
    stderrEOF: false,
    stdoutBytes: 0,
    stderrBytes: 0,
    stdoutSha256: "",
    stderrSha256: "",
    signalsRequested: 0,
    spawnFailed: false,
    streamError: false,
    overflow: false,
    timedOut: false,
    busy: true,
    argumentsValid,
    environmentValid,
    parentEnvironmentUnchanged: false,
    stdinObjects: 0,
    invalidInput: false
  };
  children.push(row);
  let finish, completed = false;
  const actual = new Promise((done) => finish = done);
  pendingChildren.push(actual);
  const out = [], err = [], outHash = (0, import_node_crypto.createHash)("sha256"), errHash = (0, import_node_crypto.createHash)("sha256");
  const timer = setTimeout(() => {
    row.timedOut = true;
    halted = true;
  }, CHILD_LIMIT);
  child.kill = (() => {
    row.signalsRequested++;
    halted = true;
    throw Error("Native pre-push fixture forbids signals.");
  });
  if (kind === "scan" && child.stdin) {
    const end = child.stdin.end;
    child.stdin.end = function(...values) {
      const input = typeof values[0] === "string" || Buffer.isBuffer(values[0]) ? Buffer.from(values[0]).toString("ascii") : "";
      if (!["commits", "batch"].includes(operation) || !/^(?:[a-f0-9]{40}\n){1,128}$/.test(input)) row.invalidInput = true;
      else row.stdinObjects = input.trimEnd().split("\n").length;
      return Reflect.apply(end, this, values);
    };
  }
  const joinClose = () => {
    if (completed || !row.closed || !row.stdoutEOF || !row.stderrEOF) return;
    completed = true;
    clearTimeout(timer);
    row.busy = false;
    row.stdoutSha256 = outHash.digest("hex");
    row.stderrSha256 = errHash.digest("hex");
    row.parentEnvironmentUnchanged = environmentDigest() === parentEnvironment;
    journal("child-close", row, child.pid);
    finish({ receipt: row, stdout: Buffer.concat(out), stderr: Buffer.concat(err) });
  };
  child.once("error", () => {
    row.spawnFailed = child.pid === void 0;
    row.streamError = child.pid !== void 0;
    halted = true;
  });
  child.once("close", (code, signal) => {
    row.closed = true;
    row.code = code;
    row.signal = signal;
    joinClose();
  });
  for (const channel of ["stdout", "stderr"]) {
    const stream = child[channel];
    if (!stream) {
      row.streamError = true;
      halted = true;
      continue;
    }
    stream.on("data", (bytes) => {
      if (channel === "stdout") {
        row.stdoutBytes += bytes.length;
        outHash.update(bytes);
      } else {
        row.stderrBytes += bytes.length;
        errHash.update(bytes);
      }
      if (row.stdoutBytes + row.stderrBytes > STREAM_LIMIT) {
        row.overflow = true;
        halted = true;
      }
      if (kind !== "scan" && !row.overflow) (channel === "stdout" ? out : err).push(Buffer.from(bytes));
    });
    stream.once("end", () => {
      if (channel === "stdout") row.stdoutEOF = true;
      else row.stderrEOF = true;
      joinClose();
    });
    stream.once("error", () => {
      row.streamError = true;
      halted = true;
    });
  }
  journal("child-start", row, child.pid);
  return Promise.race([actual, new Promise((_done, reject) => {
    const watch = setInterval(() => {
      if (completed) clearInterval(watch);
      else if (row.timedOut) {
        clearInterval(watch);
        reject(Error("STOP_UNCONFIRMED"));
      }
    }, 25);
  })]);
}
function minimalEnvironment() {
  const env2 = {};
  for (const key of ["HOME", "USERPROFILE", "XDG_CONFIG_HOME", "GIT_CONFIG_GLOBAL", "GIT_CONFIG_SYSTEM", "GIT_CONFIG_NOSYSTEM", "SystemRoot", "WINDIR", "COMSPEC"])
    if (process.env[key] !== void 0) env2[key] = process.env[key];
  return {
    ...env2,
    GIT_TERMINAL_PROMPT: "0",
    GCM_INTERACTIVE: "never",
    GIT_OPTIONAL_LOCKS: "0",
    GIT_PAGER: "",
    PAGER: "",
    GIT_NO_LAZY_FETCH: "1",
    GIT_NO_REPLACE_OBJECTS: "1",
    GIT_PROTOCOL_FROM_USER: "0",
    LC_ALL: "C",
    LANG: "C"
  };
}
function assertDiscovery(env2) {
  (0, import_strict.default)(env2);
  for (const key of ["HOME", "USERPROFILE", "XDG_CONFIG_HOME", "GIT_CONFIG_GLOBAL", "GIT_CONFIG_SYSTEM", "GIT_CONFIG_NOSYSTEM"])
    import_strict.default.equal(env2[key], ownerEnvironment[key]);
  for (const key of ["PATH", "NODE_OPTIONS", "NODE_PATH", "GIT_CONFIG_COUNT", "GIT_CONFIG_PARAMETERS", "GIT_CONFIG", "GIT_DIR", "GIT_WORK_TREE"])
    import_strict.default.equal(env2[key], void 0);
}
async function runtimeFacts() {
  const result = [];
  for (const file of RUNTIME_FILES) {
    const bytes = await nativeRead((0, import_node_path.join)(contextRef.extensionUri.fsPath, "dist", file));
    result.push({ file, bytes: bytes.length, sha256: sha(bytes) });
  }
  import_strict.default.equal(result[0].sha256, process.env[PREFIX + "BUNDLE_SHA256"]);
  import_strict.default.equal(result[3].sha256, process.env[PREFIX + "WORKER_SHA256"]);
  return result;
}
async function backupFacts() {
  const directory = (0, import_node_path.join)(contextRef.globalStorageUri.fsPath, "config-backups");
  try {
    const names = (await import_promises.default.readdir(directory)).sort();
    (0, import_strict.default)(names.length <= 32);
    const result = [];
    for (const name of names) {
      import_strict.default.match(name, /^[a-f0-9]{32}[.]enc$/);
      const bytes = await nativeRead((0, import_node_path.join)(directory, name));
      for (const forbidden of [PRIVATE, SECRET, ...[...originalBodies.values()].map((body) => body.toString()), ...[...originalBodies.values()].map((body) => body.toString("base64"))])
        (0, import_strict.default)(!bytes.includes(Buffer.from(forbidden)), "Recovery must not retain a plaintext original in its encrypted file.");
      result.push({ name, fact: await fact((0, import_node_path.join)(directory, name)) });
    }
    return result;
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}
function envelope(raw, domain) {
  (0, import_strict.default)(currentPin);
  (0, import_strict.default)(raw.length <= 8192);
  const text = raw.toString("utf8"), value = JSON.parse(text);
  import_strict.default.equal(JSON.stringify(value), text);
  import_strict.default.deepEqual(Object.keys(value).sort(), ["domain", "payload", "signature"]);
  import_strict.default.equal(value.domain, domain);
  import_strict.default.match(value.signature, /^[A-Za-z0-9_-]{86}$/);
  const signature = Buffer.from(value.signature, "base64url");
  import_strict.default.equal(signature.toString("base64url"), value.signature);
  (0, import_strict.default)((0, import_node_crypto.verify)(null, Buffer.from(domain + "\0" + JSON.stringify(value.payload)), (0, import_node_crypto.createPublicKey)({ key: Buffer.from(currentPin.publicKey, "base64"), format: "der", type: "spki" }), signature));
  import_strict.default.equal(value.payload.root, root);
  import_strict.default.equal(value.payload.generation, currentPin.generation);
  return value.payload;
}
async function saved() {
  const raw = await contextRef.secrets.get(recordKey());
  (0, import_strict.default)(raw);
  const value = JSON.parse(raw);
  import_strict.default.equal(value.version, 1);
  import_strict.default.match(value.receipt.generation, /^[a-f0-9-]{36}$/);
  const pinBytes = Buffer.from(value.pin, "base64");
  import_strict.default.equal(pinBytes.toString("base64"), value.pin);
  const pin = JSON.parse(pinBytes.toString("utf8"));
  import_strict.default.equal(pin.root, root);
  import_strict.default.equal(pin.generation, value.receipt.generation);
  import_strict.default.equal(pin.worker, (0, import_node_path.join)(contextRef.extensionUri.fsPath, "dist", "pre-commit-client.js"));
  import_strict.default.equal(pin.runtime, process.execPath);
  import_strict.default.equal(pin.workerSha256, process.env[PREFIX + "WORKER_SHA256"]);
  (0, import_strict.default)(within(contextRef.globalStorageUri.fsPath, pin.descriptor));
  currentPin = pin;
  const descriptor = envelope(await nativeRead(pin.descriptor), "SoterAI-PrePush-Descriptor-v1");
  import_strict.default.equal(descriptor.workerSha256, pin.workerSha256);
  import_strict.default.equal(pin.runtimeSha256, codeSha256);
  import_strict.default.equal(descriptor.runtimeSha256, codeSha256);
  const url = new URL(descriptor.endpoint);
  import_strict.default.equal(url.hostname, "127.0.0.1");
  import_strict.default.equal(url.pathname, "/pre-push");
  (0, import_strict.default)(!url.username && !url.password && !url.search && !url.hash && Number(url.port) > 0);
  return { raw, value, pin, descriptor };
}
async function ownerClosed() {
  await until(() => ownerListeners.every((row) => row.closed), "Actual owner listeners did not close after withdrawal.");
}
async function policyFacts() {
  const result = [];
  for (const name of [".aiignore", ".soterai/policy.json", ".soterai/team-policy.json", ".soterai-policy.json"]) result.push({ relative: name, fact: await fact((0, import_node_path.join)(root, ...name.split("/"))) });
  return result;
}
function fileHash(file, expected) {
  (0, import_strict.default)(/^[a-f0-9]{64}$/.test(expected));
  const stat = import_node_fs.default.lstatSync(file, { bigint: true });
  (0, import_strict.default)(stat.isFile() && !stat.isSymbolicLink() && samePath(import_node_fs.default.realpathSync(file), file));
  if (file === GIT) (0, import_strict.default)(stat.nlink === 1n || stat.nlink === 2n);
  else import_strict.default.equal(stat.nlink, 1n);
  const digest = (0, import_node_crypto.createHash)("sha256"), chunk = Buffer.alloc(65536), fd = import_node_fs.default.openSync(file, "r");
  try {
    let total = 0;
    for (; ; ) {
      const bytes = import_node_fs.default.readSync(fd, chunk, 0, chunk.length, total);
      if (!bytes) break;
      total += bytes;
      (0, import_strict.default)(total <= 536870912);
      digest.update(chunk.subarray(0, bytes));
    }
    import_strict.default.equal(digest.digest("hex"), expected);
  } finally {
    import_node_fs.default.closeSync(fd);
    chunk.fill(0);
  }
  const after = import_node_fs.default.lstatSync(file, { bigint: true });
  for (const name of ["dev", "ino", "size", "mtimeNs", "ctimeNs", "birthtimeNs", "nlink"]) import_strict.default.equal(after[name], stat[name]);
}
function rootIdentity() {
  const rows = [];
  for (let directory = root; ; ) {
    const stat = import_node_fs.default.lstatSync(directory, { bigint: true });
    (0, import_strict.default)(stat.isDirectory() && !stat.isSymbolicLink());
    rows.push([directory.toLowerCase(), [stat.dev, stat.ino, stat.birthtimeNs].map((v) => v.toString()).join(":")]);
    const up = (0, import_node_path.dirname)(directory);
    if (up === directory) break;
    directory = up;
  }
  return sha(JSON.stringify(rows));
}
async function manualHistory() {
  await import_strict.default.rejects(import_promises.default.lstat((0, import_node_path.join)(root, ".git")), { code: "ENOENT" });
  for (const directory of ["objects/info", "objects/pack", "refs/heads", "hooks", "info"]) await import_promises.default.mkdir((0, import_node_path.join)(root, ".git", ...directory.split("/")), { recursive: true });
  await import_promises.default.writeFile(configFile(), BASE_CONFIG, { flag: "wx" });
  await import_promises.default.writeFile((0, import_node_path.join)(root, ".git", "HEAD"), "ref: refs/heads/main\n", { flag: "wx" });
  await import_promises.default.writeFile((0, import_node_path.join)(root, ".git", "info", "exclude"), "", { flag: "wx" });
  const created = /* @__PURE__ */ new Set();
  let sequence = 0;
  async function object(type, body) {
    const bytes = Buffer.from(body), raw = Buffer.concat([Buffer.from(type + " " + bytes.length + "\0"), bytes]), oid = (0, import_node_crypto.createHash)("sha1").update(raw).digest("hex");
    if (!created.has(oid)) {
      await import_promises.default.mkdir((0, import_node_path.join)(root, ".git", "objects", oid.slice(0, 2)), { recursive: true });
      await import_promises.default.writeFile((0, import_node_path.join)(root, ".git", "objects", oid.slice(0, 2), oid.slice(2)), (0, import_node_zlib.deflateSync)(raw), { flag: "wx" });
      created.add(oid);
    }
    return oid;
  }
  async function commit(name, blob, parents = []) {
    const tree = await object("tree", Buffer.concat([Buffer.from("100644 " + name + "\0"), Buffer.from(blob, "hex")])), when = 17e8 + ++sequence;
    return object("commit", "tree " + tree + "\n" + parents.map((p) => "parent " + p + "\n").join("") + "author Synthetic F26b <f26b@example.invalid> " + when + " +0000\ncommitter Synthetic F26b <f26b@example.invalid> " + when + " +0000\n\nSynthetic native " + sequence + "\n");
  }
  const pub = await object("blob", "Useful public example.\n"), secret = await object("blob", SECRET), unknown = await object("blob", "Public unknown format.\n");
  const publicTip = await commit("public.txt", pub), secretTip = await commit("secret.txt", secret), removed = await commit("public.txt", pub, [secretTip]);
  const renamed = await commit("renamed.txt", pub, [await commit("renamed.txt", secret, [secretTip])]);
  const left = await commit("left.txt", pub, [publicTip]), side = await commit("side.txt", secret, [publicTip]), merge = await commit("merged.txt", pub, [left, side]);
  let capped = publicTip;
  for (let index = 0; index < 32; index++) capped = await commit("public.txt", pub, [capped]);
  tips = { public: publicTip, secret: secretTip, removed, renamed, merge, capped, unknown: await commit("unknown.xyz", unknown) };
  await import_promises.default.writeFile((0, import_node_path.join)(root, ".git", "refs", "heads", "main"), publicTip + "\n", { flag: "wx" });
  await import_promises.default.writeFile((0, import_node_path.join)(root, SOURCE), SECRET, { flag: "wx" });
  await import_promises.default.writeFile(tipsFile(), JSON.stringify(tips), { flag: "wx" });
}
async function call(name) {
  (0, import_strict.default)(!halted);
  const value = await vscode.commands.executeCommand("soterai." + name);
  safeMetadata(value);
  (0, import_strict.default)(value);
  return value;
}
async function idle() {
  await until(async () => !(await call("prePushGuardStatus")).busy, "Owner remained busy.");
}
async function status(expected) {
  const value = await call("prePushGuardStatus");
  import_strict.default.equal(value.status, expected);
  import_strict.default.equal(value.busy, false);
}
var hook = (hooks = ".git/hooks") => (0, import_node_path.join)(root, hooks, "pre-push");
async function markerCount() {
  try {
    return (await nativeRead(markerFile(), "utf8")).split("\n").filter(Boolean).length;
  } catch (error) {
    if (error.code === "ENOENT") return 0;
    throw error;
  }
}
async function install(hooksRelative = ".git/hooks") {
  const count = reviews.length;
  import_strict.default.equal((await call("installPrePushGuard")).status, "APPLIED");
  import_strict.default.equal(reviews.length, count + 1);
  import_strict.default.equal(reviews.at(-1)?.action, ACTIONS[0]);
  await status("LIVE");
  const current = await saved();
  import_strict.default.equal(current.value.receipt.hooksRelative, hooksRelative);
  import_strict.default.equal(current.value.state, "APPLIED");
  const body = await nativeRead(hook(hooksRelative), "utf8");
  (0, import_strict.default)(body.startsWith("#!/bin/sh\n# SoterAI Lite pre-push v1 " + current.pin.generation + "\n"));
  (0, import_strict.default)(body.includes("--pre-push --pin") && body.includes("--replay") && body.includes("'C:/Program Files/Git/usr/bin/env.exe' -i "));
  (0, import_strict.default)((await backupFacts()).some((row) => row.name === current.value.receipt.backup + ".enc"));
  import_strict.default.deepEqual(await import_promises.default.readdir((0, import_node_path.join)(root, hooksRelative)), ["pre-push"], "No plaintext sibling recovery or generated stage remains.");
}
function observeRequest(req, res) {
  if (req.method !== "POST" || req.url !== "/pre-push") return;
  const row = { caseId, requestEnded: false, requestClosed: false, responseFinished: false, responseClosed: false, requestValid: false, signatureValid: false, transcriptMatched: false, overflow: false };
  wires.push(row);
  const chunks = [];
  let count = 0, request;
  req.on("data", (chunk) => {
    count += chunk.length;
    if (count > 49152) row.overflow = true;
    else chunks.push(Buffer.from(chunk));
  });
  req.once("end", () => {
    row.requestEnded = true;
    try {
      const body = Buffer.concat(chunks).toString("utf8");
      request = JSON.parse(body);
      safeMetadata(body);
      import_strict.default.equal(JSON.stringify(request), body);
      import_strict.default.deepEqual(Object.keys(request).sort(), ["generation", "nonce", "session", "transcript", "version"]);
      import_strict.default.equal(req.socket.remoteAddress, "127.0.0.1");
      import_strict.default.match(req.headers.host ?? "", /^127[.]0[.]0[.]1:[0-9]+$/);
      import_strict.default.equal(req.headers.origin, void 0);
      import_strict.default.equal(request.version, 1);
      import_strict.default.equal(request.generation, currentPin?.generation);
      import_strict.default.match(request.session, /^[a-f0-9-]{36}$/);
      import_strict.default.match(request.nonce, /^[a-f0-9-]{36}$/);
      const raw = Buffer.from(request.transcript, "base64url");
      import_strict.default.equal(raw.toString("base64url"), request.transcript);
      (0, import_strict.default)(raw.length <= 32768);
      row.transcriptSha256 = sha(raw);
      raw.fill(0);
      row.generation = request.generation;
      row.session = request.session;
      row.nonce = request.nonce;
      row.requestValid = true;
    } catch {
      row.requestValid = false;
    }
    chunks.forEach((chunk) => chunk.fill(0));
  });
  req.once("close", () => row.requestClosed = true);
  const writeHead = res.writeHead;
  res.writeHead = function(...values) {
    try {
      const supplied = typeof values[1] === "string" ? values[2] : values[1];
      (0, import_strict.default)(supplied && typeof supplied === "object" && !Array.isArray(supplied));
      const pairs = Object.entries(supplied), headers = new Map(pairs.map(([name, value]) => [name.toLowerCase(), value]));
      import_strict.default.equal(headers.size, pairs.length);
      row.httpStatus = values[0];
      (0, import_strict.default)(Number.isInteger(row.httpStatus));
      row.responseContentType = String(headers.get("content-type"));
      row.responseContentLength = String(headers.get("content-length"));
      row.responseConnection = String(headers.get("connection"));
      row.responseCacheControl = String(headers.get("cache-control"));
    } catch {
      row.httpStatus = void 0;
      row.responseContentType = void 0;
      row.responseContentLength = void 0;
      row.responseConnection = void 0;
      row.responseCacheControl = void 0;
    }
    return Reflect.apply(writeHead, this, values);
  };
  const end = res.end;
  res.end = function(...values) {
    try {
      const bytes = values[0];
      import_strict.default.equal(row.httpStatus, this.statusCode);
      if (this.statusCode === 503) {
        (0, import_strict.default)(Buffer.isBuffer(bytes) || typeof bytes === "string");
        const refusal = Buffer.from(bytes);
        import_strict.default.equal(refusal.length, 11);
        import_strict.default.equal(refusal.toString("utf8"), "UNAVAILABLE");
        refusal.fill(0);
        import_strict.default.equal(row.responseContentType, "text/plain");
        import_strict.default.equal(row.responseContentLength, "11");
        import_strict.default.equal(row.responseConnection, "close");
        import_strict.default.equal(row.responseCacheControl, "no-store");
        (0, import_strict.default)(request && row.requestValid);
        row.transportRefused = true;
        row.status = "UNAVAILABLE";
        return Reflect.apply(end, this, values);
      }
      import_strict.default.equal(this.statusCode, 200);
      import_strict.default.equal(row.responseContentType, "application/json");
      if (Buffer.isBuffer(bytes) || typeof bytes === "string") {
        const decision = envelope(Buffer.from(bytes), "SoterAI-PrePush-Decision-v1");
        safeMetadata(decision);
        (0, import_strict.default)(request && row.requestValid);
        import_strict.default.equal(decision.session, request.session);
        import_strict.default.equal(decision.nonce, request.nonce);
        import_strict.default.deepEqual(Object.keys(decision).sort(), ["generation", "nonce", "root", "rootIdentity", "session", "status", "transcriptSha256", "version"]);
        import_strict.default.match(decision.rootIdentity, /^[a-f0-9]{64}$/);
        import_strict.default.equal(decision.rootIdentity, rootIdentity());
        (0, import_strict.default)(["ALLOW", "BLOCK", "UNAVAILABLE", "BUSY"].includes(decision.status));
        row.signatureValid = true;
        row.transcriptMatched = decision.transcriptSha256 === row.transcriptSha256;
        row.rootIdentity = decision.rootIdentity;
        row.status = decision.status;
      }
    } catch {
      row.signatureValid = false;
    }
    return Reflect.apply(end, this, values);
  };
  res.once("finish", () => row.responseFinished = true);
  res.once("close", () => row.responseClosed = true);
}
function productOperation(args, options) {
  const config = ["--no-pager", "--no-optional-locks", "-c", "protocol.allow=never", "-c", "credential.helper=", "-c", "credential.interactive=false", "config", "--null", "--show-origin", "--show-scope", "--no-includes", "--get-regexp", "^(core[.]hookspath|include[.]path|includeif[.].*[.]path|extensions[.]worktreeconfig)$"];
  if (args.length === 1 && args[0] === "--version") {
    assertDiscovery(options.env);
    return { kind: "projection", operation: "version" };
  }
  if (args[0] === "--no-pager" && args.includes("--show-origin")) {
    import_strict.default.deepEqual(args, config);
    import_strict.default.equal(options.cwd, root);
    assertDiscovery(options.env);
    return { kind: "projection", operation: "config" };
  }
  const job = options.env?.HOME;
  (0, import_strict.default)(job && within(profile, job));
  const prefix = ["--no-pager", "--literal-pathspecs", "-c", "core.hooksPath=" + (0, import_node_path.join)(job, "empty-hooks"), "-c", "core.fsmonitor=false", "-c", "credential.helper=", "-c", "commit.gpgSign=false", "--no-lazy-fetch", "--no-replace-objects", "--no-optional-locks", "-c", "protocol.allow=never", "-c", "core.pager=", "-c", "color.ui=false", "-c", "core.attributesFile=" + (0, import_node_path.join)(job, "empty.gitconfig"), "-c", "gc.auto=0", "-c", "maintenance.auto=false"];
  import_strict.default.deepEqual(args.slice(0, prefix.length), prefix);
  const suffix = args.slice(prefix.length);
  for (const key of ["PATH", "NODE_OPTIONS", "NODE_PATH", "GIT_INDEX_FILE", "GIT_CONFIG_COUNT", "GIT_CONFIG_PARAMETERS", "GIT_OBJECT_DIRECTORY"]) import_strict.default.equal(options.env?.[key], void 0);
  if (suffix.length === 1 && suffix[0] === "--version") {
    import_strict.default.equal(options.cwd, job);
    return { kind: "scan", operation: "version" };
  }
  import_strict.default.equal(options.cwd, root);
  if (suffix[0] === "rev-list") {
    import_strict.default.deepEqual(suffix, ["rev-list", "--max-count=33", "--stdin", "--"]);
    return { kind: "scan", operation: "commits" };
  }
  if (suffix[0] === "ls-tree") {
    import_strict.default.equal(suffix.length, 7);
    import_strict.default.match(suffix[5], /^[a-f0-9]{40}$/);
    import_strict.default.deepEqual(suffix, ["ls-tree", "-r", "-z", "--full-tree", "--long", suffix[5], "--"]);
    return { kind: "scan", operation: "tree" };
  }
  import_strict.default.deepEqual(suffix, ["cat-file", "--batch"]);
  return { kind: "scan", operation: "batch" };
}
function setupDiagnostic() {
  return {
    preparedSourceOnly: true,
    syntheticOnly: true,
    stage: setupStage,
    phase,
    caseId,
    halted,
    busyChildren: children.filter((row) => row.busy).length,
    timedOutChildren: children.filter((row) => row.timedOut).length,
    journalHealthy,
    journalBytes,
    journalRecords,
    scope: "F26B_CONFIGURED_LOCAL_FILE_PUSH_TWO_INVOCATIONS_ONLY"
  };
}
async function beforeActivate(context) {
  contextRef = context;
  import_strict.default.equal(process.platform, "win32");
  import_strict.default.equal(vscode.workspace.workspaceFolders?.length, 1);
  (0, import_strict.default)(vscode.workspace.isTrusted && !vscode.env.remoteName);
  root = vscode.workspace.workspaceFolders[0].uri.fsPath;
  parent = (0, import_node_path.dirname)(root);
  profile = process.env[PREFIX + "PROFILE"] ?? "";
  output = process.env[PREFIX + "EVIDENCE"] ?? "";
  const selected = process.env[PREFIX + "PHASE"];
  (0, import_strict.default)(selected === "primary" || selected === "restart");
  phase = selected;
  import_strict.default.equal(process.env[PREFIX + "DRIVER_KIND"], "native-bootstrap");
  import_strict.default.match((0, import_node_path.resolve)(root), /^D:\\SoterAI-Lite-test-profiles\\/i);
  import_strict.default.match((0, import_node_path.resolve)(profile), /^D:\\SoterAI-Lite-test-profiles\\/i);
  (0, import_strict.default)(within(parent, profile) && within(parent, output) && !within(root, output) && !within(root, context.globalStorageUri.fsPath));
  ordinary(root);
  ordinary(profile);
  ordinary(parent);
  import_strict.default.equal((await nativeRead((0, import_node_path.join)(root, MARKER), "utf8")).trim(), "synthetic-only-v1");
  for (const key of ["HOME", "USERPROFILE", "XDG_CONFIG_HOME"]) import_strict.default.equal(process.env[key], profile);
  for (const key of ["GIT_CONFIG_GLOBAL", "GIT_CONFIG_SYSTEM"]) {
    const file2 = process.env[key];
    (0, import_strict.default)(file2 && within(profile, file2));
    import_strict.default.equal((await nativeRead(file2)).length, 0);
  }
  import_strict.default.equal(process.env.GIT_CONFIG_NOSYSTEM, "1");
  for (const key of Object.keys(process.env)) if (/^GIT_/i.test(key)) (0, import_strict.default)(["GIT_CONFIG_GLOBAL", "GIT_CONFIG_SYSTEM", "GIT_CONFIG_NOSYSTEM"].includes(key.toUpperCase()));
  for (const key of ["HOMEDRIVE", "HOMEPATH"]) import_strict.default.equal(process.env[key], void 0, "Unknown inherited owner search locations must be removed by isolated launcher.");
  (0, import_strict.default)(process.env.TEMP && within(profile, process.env.TEMP));
  (0, import_strict.default)(process.env.TMP && within(profile, process.env.TMP));
  await admitConfiguredPush();
  ownerEnvironment = minimalEnvironment();
  parentEnvironment = environmentDigest();
  codeSha256 = hashCode();
  fileHash(GIT, GIT_SHA256);
  fileHash(SH, SH_SHA256);
  setupStage = "manual-synthetic-loose-history";
  import_strict.default.equal(phase, "primary");
  await manualHistory();
  await prepareLocalCollector();
  setupStage = "delegated-real-observers";
  patch(import_node_child_process.default, "spawn", (...values) => {
    (0, import_strict.default)(!halted);
    const executable = values[0], args = values[1], options = values[2];
    import_strict.default.equal(executable, GIT);
    (0, import_strict.default)(Array.isArray(args));
    import_strict.default.equal(options.shell, false);
    import_strict.default.equal(options.windowsHide, true);
    import_strict.default.equal(options.timeout, void 0);
    import_strict.default.equal(options.signal, void 0);
    import_strict.default.equal(options.killSignal, void 0);
    const selected2 = productOperation(args, options), child = Reflect.apply(nativeSpawn, import_node_child_process.default, values);
    void observe(child, selected2.kind, selected2.operation).catch(() => {
      halted = true;
    });
    return child;
  });
  patch(import_node_http.default, "createServer", (...values) => {
    const listener = values.at(-1);
    if (typeof listener !== "function") return Reflect.apply(nativeCreateServer, import_node_http.default, values);
    const args = values.slice();
    args[args.length - 1] = function(req, res) {
      observeRequest(req, res);
      return Reflect.apply(listener, this, [req, res]);
    };
    const server = Reflect.apply(nativeCreateServer, import_node_http.default, args);
    if (values[0]?.maxHeaderSize === 4096) {
      ownerServers++;
      const row = { listened: false, loopback: false, closed: false };
      ownerListeners.push(row);
      server.once("listening", () => {
        row.listened = true;
        const address = server.address();
        row.loopback = !!address && typeof address === "object" && address.address === "127.0.0.1" && address.port > 0;
        if (!row.loopback) halted = true;
      });
      server.once("close", () => row.closed = true);
    }
    return server;
  });
  const store = context.secrets.store;
  patch(context.secrets, "store", async (key, value) => {
    if (key.startsWith("soterai.prePush.signing.v1.")) stores.signing++;
    else if (key.startsWith("soterai.configBackupKey.v1.")) stores.backupKey++;
    else if (key.startsWith("soterai.prePush.record.v1.")) {
      stores.record++;
      safeMetadata(value);
    } else if (/^soterai[.]prePush[.](?:recovery|receipt)[.]v1[.]/.test(key)) {
      stores.recovery++;
      safeMetadata(value);
    } else stores.unrelated++;
    return store.call(context.secrets, key, value);
  });
  const file = (value) => typeof value === "string" ? value : value instanceof vscode.Uri && value.scheme === "file" ? value.fsPath : void 0;
  const readObserved = (value) => {
    const selected2 = file(value);
    if (!selected2) return;
    if ([SOURCE, RENAMED].some((name) => samePath(selected2, (0, import_node_path.join)(root, name)))) directWorktreeReads++;
    if (within((0, import_node_path.join)(root, ".git", "objects"), selected2)) directObjectReads++;
  };
  patch(import_node_fs.default, "readFileSync", (...values) => {
    readObserved(values[0]);
    return Reflect.apply(nativeReadSync, import_node_fs.default, values);
  });
  patch(import_promises.default, "readFile", (...values) => {
    readObserved(values[0]);
    return Reflect.apply(nativeRead, import_promises.default, values);
  });
  const open = vscode.workspace.openTextDocument;
  patch(vscode.workspace, "openTextDocument", async (...values) => {
    const selected2 = file(values[0]);
    if (selected2 && within(root, selected2)) sourceDocuments++;
    const content = values[0]?.content;
    if (typeof content === "string") safeMetadata(content);
    return Reflect.apply(open, vscode.workspace, values);
  });
  listeners.push(vscode.workspace.onDidOpenTextDocument((document) => {
    if (document.uri.scheme === "file" && within(root, document.uri.fsPath)) sourceDocumentEvents++;
  }));
  patch(vscode.window, "showWarningMessage", async (message, options, ...items) => {
    safeMetadata([message, options, items]);
    const action = items.find((item) => ACTIONS.includes(item));
    if (!action) return void 0;
    import_strict.default.equal(options.modal, true);
    reviews.push({ caseId, action, modal: true, approved: approve });
    return approve ? action : void 0;
  });
  for (const name of ["showInformationMessage", "showErrorMessage"]) patch(vscode.window, name, async (...values) => {
    safeMetadata(values);
    return void 0;
  });
  setupStage = "before-real-extension-activation";
}
var collector = "";
var pushInvocations = 0;
var expectedLocalConfig = Buffer.alloc(0);
var authorityFile = "";
var authoritySha256 = "";
async function admitConfiguredPush() {
  collector = (0, import_node_path.join)(parent, "collector.git");
  authorityFile = process.env[PREFIX + "PUSH_AUTHORIZATION"] ?? "";
  authoritySha256 = process.env[PREFIX + "PUSH_AUTHORIZATION_SHA256"] ?? "";
  import_strict.default.equal(canonicalDrive(authorityFile), canonicalDrive((0, import_node_path.join)(parent, "local-push-authorization.json")));
  import_strict.default.match(authoritySha256, /^[a-f0-9]{64}$/);
  ordinary(authorityFile);
  const raw = await nativeRead(authorityFile);
  (0, import_strict.default)(raw.length <= 16384);
  import_strict.default.equal(sha(raw), authoritySha256);
  authorizeLocalPush(JSON.parse(raw.toString("utf8")), root, collector, process.env[PREFIX + "PUSH_BINDING_SHA256"]);
}
async function prepareLocalCollector() {
  await import_strict.default.rejects(import_promises.default.lstat(collector), { code: "ENOENT" });
  for (const part of ["objects/info", "objects/pack", "refs/heads", "hooks", "info"]) await import_promises.default.mkdir((0, import_node_path.join)(collector, ...part.split("/")), { recursive: true });
  await import_promises.default.writeFile((0, import_node_path.join)(collector, "HEAD"), "ref: refs/heads/public\n", { flag: "wx" });
  await import_promises.default.writeFile((0, import_node_path.join)(collector, "config"), "[core]\n repositoryformatversion = 0\n bare = true\n", { flag: "wx" });
  import_strict.default.equal(await nativeRead(configFile(), "utf8"), BASE_CONFIG);
  expectedLocalConfig = Buffer.from(BASE_CONFIG + localRemoteSection(root, collector));
  await import_promises.default.writeFile(configFile(), expectedLocalConfig);
}
async function fixtureGit(args, kind, operation) {
  (0, import_strict.default)(!halted);
  await admitConfiguredPush();
  ordinary(collector);
  (0, import_strict.default)((await nativeRead(configFile())).equals(expectedLocalConfig));
  fileHash(GIT, GIT_SHA256);
  const child = nativeSpawn(GIT, args, { cwd: root, env: { ...ownerEnvironment, GIT_ALLOW_PROTOCOL: "file" }, shell: false, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
  const pending = observe(child, kind, operation);
  (0, import_strict.default)(child.stdin);
  child.stdin.once("error", () => {
  });
  child.stdin.end();
  const done = await pending;
  closed(done.receipt);
  for (const bytes of [done.stdout, done.stderr]) {
    (0, import_strict.default)(!bytes.includes(Buffer.from(PRIVATE)) && !bytes.includes(Buffer.from(SECRET)));
  }
  (0, import_strict.default)((await nativeRead(configFile())).equals(expectedLocalConfig));
  return done;
}
async function actualLocalPush(tip, target, decision) {
  const index = pushInvocations;
  const args = localPushArgs(root, collector, tip, target, index);
  import_strict.default.equal(index, decision === "ALLOW" ? 0 : 1);
  const beforeWires = wires.length, beforeMarker = await markerCount(), beforeHook = await fact(hook());
  pushInvocations++;
  const done = await fixtureGit(args, "configured-push", index === 0 ? "ACTUAL_GIT_PUSH_LOCAL_PUBLIC" : "ACTUAL_GIT_PUSH_LOCAL_BLOCKED_SECRET");
  import_strict.default.equal(done.receipt.code, decision === "ALLOW" ? 0 : 1);
  import_strict.default.equal(wires.length, beforeWires + 1);
  const wire = wires.at(-1);
  await until(() => wire.requestClosed && wire.responseFinished && wire.responseClosed, "Actual configured push owner exchange did not close.");
  (0, import_strict.default)(wire.requestValid && wire.signatureValid && wire.transcriptMatched);
  import_strict.default.equal(wire.status, decision);
  import_strict.default.equal(await markerCount(), beforeMarker + (decision === "ALLOW" ? 1 : 0));
  import_strict.default.deepEqual(await fact(hook()), beforeHook);
  done.stdout.fill(0);
  done.stderr.fill(0);
}
async function collectorProbe(oid, exists) {
  const done = await fixtureGit(collectorProbeArgs(root, collector, oid), "collector-read", "LOCAL_COLLECTOR_OBJECT_PROBE");
  if (exists) import_strict.default.equal(done.receipt.code, 0);
  else import_strict.default.notEqual(done.receipt.code, 0);
  import_strict.default.equal(done.stdout.length, 0);
  done.stdout.fill(0);
  done.stderr.fill(0);
}
async function run(context) {
  journal("run-enter");
  (0, import_strict.default)(journalHealthy);
  import_strict.default.equal(context, contextRef);
  await admitConfiguredPush();
  const configuration = vscode.workspace.getConfiguration("soterai"), initialFlag = configuration.inspect(FLAG)?.globalValue;
  const runtimes = await runtimeFacts(), initialPolicy = await policyFacts(), executionManifest = await fact((0, import_node_path.join)(context.extensionUri.fsPath, "package.json"));
  const observations = [], checks = [];
  let driverFailure = null, originalBody, originalFact;
  const add = (scope, work) => checks.push({ scope, work });
  const setFlag = async (value) => {
    await configuration.update(FLAG, value, vscode.ConfigurationTarget.Global);
    await idle();
  };
  add("Exact accepted runtimes and default-false machine route; fresh local collector and explicit two-push authority", async () => {
    (0, import_strict.default)(initialFlag === void 0 || initialFlag === false);
    import_strict.default.equal(configuration.inspect(FLAG)?.defaultValue, false);
    import_strict.default.equal(pushInvocations, 0);
    (0, import_strict.default)(!(await fact(hook())).present);
    import_strict.default.deepEqual(await import_promises.default.readdir((0, import_node_path.join)(collector, "refs", "heads")), []);
    import_strict.default.equal(await nativeRead((0, import_node_path.join)(collector, "config"), "utf8"), "[core]\n repositoryformatversion = 0\n bare = true\n");
    await status("UNAVAILABLE");
  });
  add("Supported synthetic original is preserved while disabled and cancelled install has no owner or recovery effects", async () => {
    const quoted = markerFile().replace(/\\/g, "/").split("'").join(`'"'"'`);
    originalBody = Buffer.from("#!/bin/sh\ncommand printf '%s\\n' once >> '" + quoted + "'\nexit 0\n");
    originalBodies.set(0, originalBody);
    await import_promises.default.writeFile(hook(), originalBody, { flag: "wx", mode: 448 });
    await import_promises.default.chmod(hook(), 448);
    originalFact = await fact(hook());
    const before = JSON.stringify({ stores, ownerServers });
    import_strict.default.equal((await call("installPrePushGuard")).status, "UNAVAILABLE");
    await setFlag(true);
    approve = false;
    try {
      import_strict.default.equal((await call("installPrePushGuard")).status, "CANCELLED");
    } finally {
      approve = true;
    }
    import_strict.default.equal(JSON.stringify({ stores, ownerServers }), before);
    import_strict.default.deepEqual(await fact(hook()), originalFact);
    await status("OWNER_REVIEW_REQUIRED");
  });
  add("Reviewed configured-hook installation creates signed live owner and encrypted original recovery", async () => {
    await install();
    const current = await saved();
    import_strict.default.equal(current.value.receipt.originalPresent, true);
    import_strict.default.equal(stores.signing, 1);
    import_strict.default.equal(stores.backupKey, 1);
    import_strict.default.equal(await markerCount(), 0);
  });
  add("Actual configured Git push transfers only the public tip to the local bare collector and runs original once", async () => {
    await actualLocalPush(tips.public, "refs/heads/public", "ALLOW");
    import_strict.default.equal(await nativeRead((0, import_node_path.join)(collector, "refs", "heads", "public"), "utf8"), tips.public + "\n");
    await collectorProbe(tips.public, true);
  });
  add("Actual configured Git push with removed historical synthetic secret is withheld before collector ref or object transfer", async () => {
    await actualLocalPush(tips.removed, "refs/heads/blocked-secret", "BLOCK");
    (0, import_strict.default)(!(await fact((0, import_node_path.join)(collector, "refs", "heads", "blocked-secret"))).present);
    import_strict.default.deepEqual(await import_promises.default.readdir((0, import_node_path.join)(collector, "refs", "heads")), ["public"]);
    const secretOid = (0, import_node_crypto.createHash)("sha1").update(Buffer.from("blob " + Buffer.byteLength(SECRET) + "\0" + SECRET)).digest("hex");
    await collectorProbe(secretOid, false);
    await collectorProbe(tips.public, true);
    import_strict.default.equal(await markerCount(), 1);
  });
  add("Cancelled configured-hook restore preserves exact hook encrypted recovery and live owner", async () => {
    const before = await fact(hook()), recovery = await backupFacts(), current = await saved();
    approve = false;
    try {
      import_strict.default.equal((await call("restorePrePushGuard")).status, "CANCELLED");
    } finally {
      approve = true;
    }
    import_strict.default.deepEqual(await fact(hook()), before);
    import_strict.default.deepEqual(await backupFacts(), recovery);
    import_strict.default.equal((await saved()).raw, current.raw);
    await status("LIVE");
  });
  add("Reviewed restore returns exact synthetic original bytes/mode and original flag and observes owner withdrawal", async () => {
    import_strict.default.equal((await call("restorePrePushGuard")).status, "RESTORED");
    (0, import_strict.default)(originalBody && originalFact);
    (0, import_strict.default)((await nativeRead(hook())).equals(originalBody));
    import_strict.default.deepEqual(await fact(hook()), originalFact);
    await setFlag(initialFlag);
    await ownerClosed();
    import_strict.default.deepEqual(await policyFacts(), initialPolicy);
    import_strict.default.equal(configuration.inspect(FLAG)?.globalValue, initialFlag);
  });
  add("Both approved local push invocations and all declared direct Git owners close EOF with unchanged runtime and no raw metadata leak", async () => {
    import_strict.default.equal(pushInvocations, 2);
    await Promise.all(pendingChildren);
    children.forEach(closed);
    import_strict.default.equal(children.filter((row) => row.kind === "configured-push").length, 2);
    import_strict.default.equal(sourceDocuments, 0);
    import_strict.default.equal(sourceDocumentEvents, 0);
    import_strict.default.equal(directWorktreeReads, 0);
    import_strict.default.equal(directObjectReads, 0);
    (0, import_strict.default)(!metadataLeak);
    import_strict.default.equal(environmentDigest(), parentEnvironment);
    import_strict.default.deepEqual(await runtimeFacts(), runtimes);
    import_strict.default.deepEqual(await policyFacts(), initialPolicy);
    import_strict.default.equal(await markerCount(), 1);
    await ownerClosed();
  });
  import_strict.default.equal(checks.length, 8);
  checks.forEach((row, index) => observations.push({ id: "F26B-GP" + String(index + 1).padStart(2, "0"), scope: row.scope, status: "NOT_RUN" }));
  try {
    for (let index = 0; index < checks.length; index++) {
      caseId = observations[index].id;
      setupStage = caseId;
      try {
        journal("case-start");
        (0, import_strict.default)(journalHealthy && !halted);
        await checks[index].work();
        observations[index].status = "PASS";
        journal("case-pass");
        (0, import_strict.default)(journalHealthy);
      } catch (error) {
        journal("case-fail");
        observations[index].status = "FAIL";
        observations[index].errorName = error instanceof Error ? error.name : "UnknownFailure";
        driverFailure = halted ? "STOP_UNCONFIRMED" : "ConfiguredLocalPushFixtureFailure";
        break;
      }
    }
  } finally {
    const busy = children.some((row) => row.busy);
    if (!busy) {
      listeners.forEach((listener) => listener.dispose());
      for (const restore of restorers.reverse()) restore();
    }
    const summary = {
      schemaVersion: 1,
      phase,
      syntheticOnly: true,
      scope: "F26B_CONFIGURED_LOCAL_FILE_PUSH_TWO_INVOCATIONS_ONLY",
      hostVersion: vscode.version,
      extensionBundleSha256: runtimes[0].sha256,
      workerSha256: runtimes[3].sha256,
      runtimeBindings: runtimes,
      currentRuntimeBindings: await runtimeFacts(),
      executionManifest,
      currentExecutionManifest: await fact((0, import_node_path.join)(context.extensionUri.fsPath, "package.json")),
      hostProbeSha256: sha(await nativeRead(__filename)),
      codeSha256,
      observations,
      expectedChecks: 8,
      passed: observations.filter((row) => row.status === "PASS").length,
      failed: observations.filter((row) => row.status === "FAIL").length,
      notRun: observations.filter((row) => row.status === "NOT_RUN").length,
      driverFailure,
      pushInvocations,
      children,
      requests: wires,
      reviews,
      secretStores: stores,
      ownerServers,
      ownerListeners,
      sourceDocuments,
      sourceDocumentEvents,
      directWorktreeReads,
      directObjectReads,
      metadataLeak,
      parentEnvironmentUnchanged: environmentDigest() === parentEnvironment,
      busyChildren: children.filter((row) => row.busy).length,
      timedOutChildren: children.filter((row) => row.timedOut).length,
      diagnosticJournal: { healthy: journalHealthy, bytes: journalBytes, records: journalRecords, limit: JOURNAL_LIMIT },
      safeWithdrawal: !driverFailure && !busy ? "EXACT_ORIGINAL_HOOK_MODE_AND_FLAG_RESTORED_OWNER_CLOSED" : "NOT_RUN_OR_INCOMPLETE",
      localOnlyAuthoritySha256: authoritySha256,
      signalsRequested: children.reduce((sum, row) => sum + row.signalsRequested, 0),
      independence: "LOW",
      review: "SCRIPTED_NATIVE_API_DECISIONS_NOT_HUMAN_REVIEW",
      nestedGitTransportAndHookClientEOF: "NOT_INFERRED_FROM_OUTER_GIT_CLOSE",
      externalNetwork: "NOT_AUTHORIZED_NOT_RUN",
      notTested: ["Real secrets or external remotes", "Hostile same-user process boundary", "Human agent smoke or usability", "Other platforms/remote workspaces"]
    };
    safeMetadata(summary);
    await import_promises.default.writeFile(output, JSON.stringify(summary, null, 2) + "\n", { flag: "wx" });
    if (busy) throw Error("STOP_UNCONFIRMED");
  }
  if (driverFailure || observations.some((row) => row.status !== "PASS")) throw Error("Configured local push fixture incomplete.");
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  beforeActivate,
  run,
  setupDiagnostic
});
