"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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

// packages/vscode-extension/src/__tests__/host/litePreCommitGuard.host.ts
var litePreCommitGuard_host_exports = {};
__export(litePreCommitGuard_host_exports, {
  beforeActivate: () => beforeActivate,
  run: () => run,
  setupDiagnostic: () => setupDiagnostic
});
module.exports = __toCommonJS(litePreCommitGuard_host_exports);
var vscode = __toESM(require("vscode"));
var import_strict = __toESM(require("node:assert/strict"));
var import_node_crypto = require("node:crypto");
var import_node_child_process = __toESM(require("node:child_process"));
var import_node_fs = __toESM(require("node:fs"));
var import_promises = __toESM(require("node:fs/promises"));
var import_node_http = __toESM(require("node:http"));
var import_node_path = require("node:path");
var GIT = "C:\\Program Files\\Git\\cmd\\git.exe";
var VERSION = "git version 2.53.0.windows.1";
var PREFIX = "SOTERAI_LITE_F26A_HOOK_";
var FLAG = "lite.historyHooks.preCommit";
var MARKER = ".synthetic-lite-f26a-precommit-host";
var SOURCE = ".env.precommit-native";
var RENAMED = ".env.precommit-renamed";
var CUSTOM = ".synthetic hooks";
var ALT = ".git/f26a-alternate-index";
var PRIVATE = "sk-proj-" + "SYNTHETIC_F26A_NATIVE_PROVIDER_ONLY_VALUE".repeat(2);
var SECRET = "API_KEY=" + PRIVATE + "\nPORT=3000\n";
var ORIGINAL_ENV = "TEST_ONLY_F26A_ORIGINAL_ENV_37b912ab";
var RUNTIME_FILES = ["extension.js", "local-ai-broker.js", "soterai-mcp-server.js", "pre-commit-client.js"];
var COMMANDS = ["installPreCommitGuard", "resumePreCommitGuard", "restorePreCommitGuard", "preCommitGuardStatus"];
var ACTIONS = ["Review and install", "Resume reviewed owner", "Review and restore"];
var CHILD_LIMIT = 9e4;
var STREAM_LIMIT = 1048576 + 128 * 96 + 8192;
var nativeSpawn = import_node_child_process.default.spawn;
var nativeRead = import_promises.default.readFile;
var nativeReadSync = import_node_fs.default.readFileSync;
var nativeCreateServer = import_node_http.default.createServer;
var restorers = [];
var listeners = [];
var children = [];
var pendingChildren = [];
var wires = [];
var reviews = [];
var stores = { signing: 0, backupKey: 0, record: 0, unrelated: 0 };
var root = "";
var profile = "";
var parent = "";
var setupDirectory = "";
var caseId = "SETUP";
var setupStage = "initial";
var phase;
var output = "";
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
var originalBodies = /* @__PURE__ */ new Map();
var sha = (bytes) => (0, import_node_crypto.createHash)("sha256").update(bytes).digest("hex");
var within = (base, file) => {
  const part = (0, import_node_path.relative)((0, import_node_path.resolve)(base), (0, import_node_path.resolve)(file));
  return part === "" || !part.startsWith("..") && !(0, import_node_path.isAbsolute)(part);
};
var samePath = (a, b) => (0, import_node_path.resolve)(a).toLowerCase() === (0, import_node_path.resolve)(b).toLowerCase();
var selectedFile = (value) => value === void 0 ? (0, import_node_path.join)(root, ".git", "index") : (0, import_node_path.resolve)(root, value);
var recordKey = () => "soterai.preCommit.record.v1." + sha(root.toLowerCase());
var markerFile = () => (0, import_node_path.join)(root, ".git", "f26a-original-marker");
var stateFile = () => (0, import_node_path.join)(parent, "precommit-restart-state.json");
var absentFile = () => (0, import_node_path.join)(parent, "precommit-owner-absent.json");
var publicText = (label) => "PORT=3000\nMODE=development\n# public " + label + "\n";
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
function success(row) {
  closed(row);
  import_strict.default.equal(row.code, 0);
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
    throw Error("Native pre-commit fixture forbids signals.");
  });
  if (kind === "scan" && child.stdin) {
    const end = child.stdin.end;
    child.stdin.end = function(...values) {
      const input = typeof values[0] === "string" || Buffer.isBuffer(values[0]) ? Buffer.from(values[0]).toString("ascii") : "";
      if (!["sizes", "batch"].includes(operation) || !/^(?:[a-f0-9]{40}\n){1,128}$/.test(input)) row.invalidInput = true;
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
    row.parentEnvironmentUnchanged = JSON.stringify(process.env) === parentEnvironment;
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
function ownerEnv(index) {
  return { ...ownerEnvironment, SOTERAI_F26A_ORIGINAL_ENV: ORIGINAL_ENV, ...index === void 0 ? {} : { GIT_INDEX_FILE: selectedFile(index) } };
}
function assertDiscovery(env2) {
  (0, import_strict.default)(env2);
  for (const key of ["HOME", "USERPROFILE", "XDG_CONFIG_HOME", "GIT_CONFIG_GLOBAL", "GIT_CONFIG_SYSTEM", "GIT_CONFIG_NOSYSTEM"])
    import_strict.default.equal(env2[key], ownerEnvironment[key]);
  for (const key of ["PATH", "NODE_OPTIONS", "NODE_PATH", "GIT_CONFIG_COUNT", "GIT_CONFIG_PARAMETERS", "GIT_CONFIG", "GIT_DIR", "GIT_WORK_TREE"])
    import_strict.default.equal(env2[key], void 0);
}
async function setupGit(operation, args, index) {
  (0, import_strict.default)(!halted, "STOP_UNCONFIRMED forbids advancing fixture setup.");
  const prefix = [
    "--no-pager",
    "--literal-pathspecs",
    "--no-lazy-fetch",
    "--no-replace-objects",
    "--no-optional-locks",
    "-c",
    "core.hooksPath=" + (0, import_node_path.join)(setupDirectory, "empty-hooks"),
    "-c",
    "core.fsmonitor=false",
    "-c",
    "credential.helper=",
    "-c",
    "protocol.allow=never"
  ];
  const env2 = { ...ownerEnvironment, ...index === void 0 ? {} : { GIT_INDEX_FILE: selectedFile(index) } };
  const value = await observe(nativeSpawn(GIT, [...prefix, ...args], { cwd: root, env: env2, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }), "setup", operation);
  success(value.receipt);
  (0, import_strict.default)(!halted);
  return value.stdout.toString("utf8");
}
function ownerArguments(label) {
  (0, import_strict.default)(/^[A-Za-z0-9 -]{1,90}$/.test(label));
  return ["--no-pager", "commit", "--quiet", "-m", "F26a synthetic " + label];
}
async function ownerCommit(label, expected, scan, index) {
  (0, import_strict.default)(!halted);
  const args = ownerArguments(label), env2 = ownerEnv(index);
  (0, import_strict.default)(!args.some((arg) => /core[.]hooksPath|no-verify|^-c$/i.test(arg)));
  assertDiscovery(env2);
  const beforeHead = head(), beforeSource = await fact((0, import_node_path.join)(root, SOURCE));
  const beforeIndex = await fact(selectedFile(index));
  const beforeDefault = await fact(selectedFile());
  const listing = await setupGit("before-owner-listing", ["ls-files", "--stage", "-z"], index);
  const firstWire = wires.length, firstChild = children.length;
  const value = await observe(nativeSpawn(GIT, args, { cwd: root, env: env2, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }), "owner", label);
  closed(value.receipt);
  (0, import_strict.default)(!halted);
  const afterHead = head(), afterSource = await fact((0, import_node_path.join)(root, SOURCE)), afterIndex = await fact(selectedFile(index));
  import_strict.default.deepEqual(afterSource, beforeSource, "Owner hook must never rewrite the worktree source.");
  if (expected === "allow") {
    import_strict.default.equal(value.receipt.code, 0);
    import_strict.default.notEqual(afterHead, beforeHead);
  } else {
    import_strict.default.notEqual(value.receipt.code, 0);
    import_strict.default.equal(afterHead, beforeHead);
  }
  const afterListing = await setupGit("after-owner-listing", ["ls-files", "--stage", "-z"], index);
  import_strict.default.equal(afterListing, listing, "Hook must not rewrite staged paths/object ids; Git may refresh its own index stat cache.");
  if (index !== void 0) import_strict.default.deepEqual(await fact(selectedFile()), beforeDefault, "Alternate-index owner must leave the default index byte exact.");
  const observed = wires.slice(firstWire);
  if (scan === "none") import_strict.default.equal(observed.length, 0);
  else {
    import_strict.default.equal(observed.length, 1);
    const wire = observed[0];
    await until(() => wire.requestClosed && wire.responseFinished && wire.responseClosed, "Actual hook HTTP exchange did not close.");
    (0, import_strict.default)(wire.requestEnded && wire.requestClosed && wire.responseFinished && wire.responseClosed && wire.requestValid && wire.signatureValid && wire.indexMatched && !wire.overflow);
    import_strict.default.equal(wire.status, scan);
    import_strict.default.equal(wire.selected, index === void 0 ? "default" : "alternate");
    const scans = children.slice(firstChild).filter((row) => row.kind === "scan");
    for (const operation of ["version", "entries", ...listing.length ? ["sizes", "batch"] : []]) (0, import_strict.default)(scans.some((row) => row.operation === operation), "Commit needs the actual complete staged-tree child witnesses.");
    if (!listing.length) (0, import_strict.default)(!scans.some((row) => row.operation === "sizes" || row.operation === "batch"), "An empty staged tree must not read deleted objects.");
    scans.forEach(success);
  }
  commitProofs.push({
    caseId,
    expected,
    observedExitCode: value.receipt.code,
    headAdvanced: afterHead !== beforeHead,
    selectedIndexBefore: beforeIndex,
    selectedIndexAfter: afterIndex,
    worktreeUnchanged: true,
    stagedListingUnchanged: true,
    defaultIndexUnchanged: index === void 0 ? void 0 : true,
    scan,
    ownerArgumentsHaveNoHooksOverride: true,
    requestCount: observed.length
  });
}
var commitProofs = [];
function head() {
  const value = nativeReadSync((0, import_node_path.join)(root, ".git", "HEAD"), "utf8").trim();
  import_strict.default.equal(value, "ref: refs/heads/main");
  try {
    const oid = nativeReadSync((0, import_node_path.join)(root, ".git", "refs", "heads", "main"), "utf8").trim();
    import_strict.default.match(oid, /^[a-f0-9]{40}$/);
    return oid;
  } catch (error) {
    if (error.code === "ENOENT") return "UNBORN";
    throw error;
  }
}
async function stage(text, index) {
  (0, import_strict.default)(!halted);
  await import_promises.default.writeFile((0, import_node_path.join)(root, SOURCE), text);
  await setupGit("stage-owned-source", ["add", "--force", "--", SOURCE], index);
}
function original(exit) {
  const value = Buffer.from("#!/bin/sh\n# TEST_ONLY_F26A_ORIGINAL_BODY_" + exit + `
printf '%s\\n' "$#" "$SOTERAI_F26A_ORIGINAL_ENV" "\${GIT_INDEX_FILE-unset}" >> '.git/f26a-original-marker'
exit ` + exit + "\n");
  originalBodies.set(exit, value);
  return value;
}
async function markerCount() {
  try {
    const lines = (await nativeRead(markerFile(), "utf8")).trimEnd().split("\n");
    import_strict.default.equal(lines.length % 3, 0);
    for (let i = 0; i < lines.length; i += 3) {
      import_strict.default.equal(lines[i], "0");
      import_strict.default.equal(lines[i + 1], ORIGINAL_ENV);
      (0, import_strict.default)(samePath((0, import_node_path.resolve)(root, lines[i + 2]), selectedFile()), "Original hook must retain Git's default index environment.");
    }
    return lines.length / 3;
  } catch (error) {
    if (error.code === "ENOENT") return 0;
    throw error;
  }
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
  const descriptor = envelope(await nativeRead(pin.descriptor), "SoterAI-PreCommit-Descriptor-v1");
  import_strict.default.equal(descriptor.workerSha256, pin.workerSha256);
  import_strict.default.equal(pin.runtimeSha256, codeSha256);
  import_strict.default.equal(descriptor.runtimeSha256, codeSha256);
  const url = new URL(descriptor.endpoint);
  import_strict.default.equal(url.hostname, "127.0.0.1");
  import_strict.default.equal(url.pathname, "/pre-commit");
  (0, import_strict.default)(!url.username && !url.password && !url.search && !url.hash && Number(url.port) > 0);
  return { raw, value, pin, descriptor };
}
async function call(name) {
  (0, import_strict.default)(!halted);
  const value = await vscode.commands.executeCommand("soterai." + name);
  safeMetadata(value);
  (0, import_strict.default)(value);
  return value;
}
async function idle() {
  await until(async () => !(await call("preCommitGuardStatus")).busy, "Owner remained busy.");
}
async function status(expected) {
  const value = await call("preCommitGuardStatus");
  import_strict.default.equal(value.status, expected);
  import_strict.default.equal(value.busy, false);
}
async function install(hooks) {
  const beforeReview = reviews.length;
  import_strict.default.equal((await call("installPreCommitGuard")).status, "APPLIED");
  import_strict.default.equal(reviews.length, beforeReview + 1);
  import_strict.default.equal(reviews.at(-1)?.action, ACTIONS[0]);
  await status("LIVE");
  const record = await saved();
  import_strict.default.equal(record.value.state, "APPLIED");
  import_strict.default.equal(record.value.receipt.hooksRelative, hooks);
  const hook = await nativeRead((0, import_node_path.join)(root, hooks, "pre-commit"), "utf8");
  (0, import_strict.default)(hook.startsWith("#!/bin/sh\n# SoterAI Lite pre-commit v1 " + record.pin.generation + "\n"));
  (0, import_strict.default)(hook.includes("'C:/Program Files/Git/usr/bin/env.exe' -i ") && hook.includes('"${GIT_INDEX_FILE-.git/index}"'));
  (0, import_strict.default)(hook.includes(Buffer.from(record.value.pin, "base64").toString("base64url")));
  (0, import_strict.default)((await backupFacts()).some((row) => row.name === record.value.receipt.backup + ".enc"));
  const names = await import_promises.default.readdir((0, import_node_path.join)(root, hooks));
  import_strict.default.deepEqual(names, ["pre-commit"], "No plaintext sibling backup or leftover generated stage may remain.");
}
async function directClient(index, expected, scan) {
  (0, import_strict.default)(currentPin && !halted);
  const raw = Buffer.from(JSON.stringify(currentPin));
  const firstWire = wires.length, beforeHead = head(), beforeSource = await fact((0, import_node_path.join)(root, SOURCE));
  const env2 = { SystemRoot: currentPin.systemRoot, WINDIR: currentPin.systemRoot, ELECTRON_RUN_AS_NODE: "1" };
  import_strict.default.equal(env2.NODE_OPTIONS, void 0);
  import_strict.default.equal(env2.NODE_PATH, void 0);
  import_strict.default.equal(env2.PATH, void 0);
  const result = await observe(nativeSpawn(process.execPath, [currentPin.worker, "--pin", raw.toString("base64url"), "--index", index], {
    cwd: root,
    env: env2,
    shell: false,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"]
  }), "client", expected === 0 ? "actual-worker-positive" : "actual-worker-invalid-index");
  closed(result.receipt);
  import_strict.default.equal(result.receipt.code, expected);
  import_strict.default.equal(head(), beforeHead);
  import_strict.default.deepEqual(await fact((0, import_node_path.join)(root, SOURCE)), beforeSource);
  import_strict.default.equal(wires.length - firstWire, scan ? 1 : 0);
  if (scan) {
    const row = wires.at(-1);
    await until(() => row.requestClosed && row.responseFinished && row.responseClosed, "Direct client HTTP exchange did not close.");
    import_strict.default.equal(row.status, "ALLOW");
    (0, import_strict.default)(row.requestValid && row.signatureValid && row.indexMatched);
  }
}
function observeRequest(req, res) {
  if (req.method !== "POST" || req.url !== "/pre-commit") return;
  const row = {
    caseId,
    requestEnded: false,
    requestClosed: false,
    responseFinished: false,
    responseClosed: false,
    requestValid: false,
    signatureValid: false,
    indexMatched: false,
    overflow: false
  };
  wires.push(row);
  const chunks = [];
  let bytes = 0, request;
  req.on("data", (chunk) => {
    bytes += chunk.length;
    if (bytes > 4096) row.overflow = true;
    else chunks.push(Buffer.from(chunk));
  });
  req.once("end", () => {
    row.requestEnded = true;
    try {
      const body = Buffer.concat(chunks).toString("utf8");
      request = JSON.parse(body);
      safeMetadata(body);
      import_strict.default.equal(JSON.stringify(request), body);
      import_strict.default.deepEqual(Object.keys(request).sort(), ["generation", "indexFile", "nonce", "session", "version"]);
      import_strict.default.equal(req.socket.remoteAddress, "127.0.0.1");
      import_strict.default.match(req.headers.host ?? "", /^127[.]0[.]0[.]1:[0-9]+$/);
      import_strict.default.equal(req.headers.origin, void 0);
      import_strict.default.equal(request.version, 1);
      import_strict.default.equal(request.generation, currentPin?.generation);
      import_strict.default.match(request.session, /^[a-f0-9-]{36}$/);
      import_strict.default.match(request.nonce, /^[a-f0-9-]{36}$/);
      const file = selectedFile(request.indexFile);
      (0, import_strict.default)(within((0, import_node_path.join)(root, ".git"), file));
      ordinary(file);
      const index = nativeReadSync(file);
      (0, import_strict.default)(index.length <= 4 * 1024 * 1024);
      row.indexSha256 = sha(index);
      row.generation = request.generation;
      row.session = request.session;
      row.nonce = request.nonce;
      row.selected = samePath(file, selectedFile()) ? "default" : samePath(file, selectedFile(ALT)) ? "alternate" : "other";
      row.requestValid = true;
    } catch {
      row.requestValid = false;
    }
    chunks.forEach((chunk) => chunk.fill(0));
  });
  req.once("close", () => {
    row.requestClosed = true;
  });
  const end = res.end;
  res.end = function(...values) {
    try {
      const value = values[0];
      if (Buffer.isBuffer(value) || typeof value === "string") {
        const decision = envelope(Buffer.from(value), "SoterAI-PreCommit-Decision-v1");
        safeMetadata(decision);
        (0, import_strict.default)(request && row.requestValid);
        import_strict.default.equal(decision.session, request.session);
        import_strict.default.equal(decision.nonce, request.nonce);
        import_strict.default.deepEqual(Object.keys(decision).sort(), ["generation", "indexIdentity", "indexSha256", "nonce", "root", "session", "status", "version"]);
        import_strict.default.match(decision.indexIdentity, /^[a-f0-9]{64}$/);
        (0, import_strict.default)(["ALLOW", "BLOCK", "UNAVAILABLE", "BUSY"].includes(decision.status));
        row.signatureValid = true;
        row.indexMatched = decision.indexSha256 === row.indexSha256;
        row.indexIdentity = decision.indexIdentity;
        row.status = decision.status;
      }
    } catch {
      row.signatureValid = false;
    }
    return Reflect.apply(end, this, values);
  };
  res.once("finish", () => {
    row.responseFinished = true;
  });
  res.once("close", () => {
    row.responseClosed = true;
  });
}
function productOperation(args, options) {
  const config = [
    "--no-pager",
    "--no-optional-locks",
    "-c",
    "protocol.allow=never",
    "-c",
    "credential.helper=",
    "-c",
    "credential.interactive=false",
    "config",
    "--null",
    "--show-origin",
    "--show-scope",
    "--no-includes",
    "--get-regexp",
    "^(core[.]hookspath|include[.]path|includeif[.].*[.]path|extensions[.]worktreeconfig)$"
  ];
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
  const prefix = [
    "--no-pager",
    "--literal-pathspecs",
    "-c",
    "core.hooksPath=" + (0, import_node_path.join)(job, "empty-hooks"),
    "-c",
    "core.fsmonitor=false",
    "-c",
    "credential.helper=",
    "-c",
    "commit.gpgSign=false",
    "--no-lazy-fetch",
    "--no-replace-objects",
    "--no-optional-locks",
    "-c",
    "protocol.allow=never",
    "-c",
    "core.pager=",
    "-c",
    "color.ui=false",
    "-c",
    "core.attributesFile=" + (0, import_node_path.join)(job, "empty.gitconfig"),
    "-c",
    "gc.auto=0",
    "-c",
    "maintenance.auto=false"
  ];
  import_strict.default.deepEqual(args.slice(0, prefix.length), prefix);
  const suffix = args.slice(prefix.length);
  (0, import_strict.default)(options.env?.GIT_INDEX_FILE && within((0, import_node_path.join)(root, ".git"), options.env.GIT_INDEX_FILE));
  for (const key of ["PATH", "NODE_OPTIONS", "NODE_PATH", "GIT_CONFIG_COUNT", "GIT_CONFIG_PARAMETERS"]) import_strict.default.equal(options.env?.[key], void 0);
  if (suffix.length === 1 && suffix[0] === "--version") {
    import_strict.default.equal(options.cwd, job);
    return { kind: "scan", operation: "version" };
  }
  import_strict.default.equal(options.cwd, root);
  if (suffix[0] === "ls-files") {
    import_strict.default.deepEqual(suffix, ["ls-files", "--stage", "-z"]);
    return { kind: "scan", operation: "entries" };
  }
  if (suffix[1] === "--batch-check=%(objectname) %(objecttype) %(objectsize)") {
    import_strict.default.deepEqual(suffix, ["cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"]);
    return { kind: "scan", operation: "sizes" };
  }
  import_strict.default.deepEqual(suffix, ["cat-file", "--batch"]);
  return { kind: "scan", operation: "batch" };
}
function setupDiagnostic() {
  return {
    preparedNotExecutedAuthoring: true,
    syntheticOnly: true,
    stage: setupStage,
    phase,
    caseId,
    halted,
    busyChildren: children.filter((row) => row.busy).length,
    timedOutChildren: children.filter((row) => row.timedOut).length,
    sourceDocuments,
    sourceDocumentEvents,
    directWorktreeReads,
    directObjectReads,
    ownerServers
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
  const selectedPhase = process.env[PREFIX + "PHASE"];
  (0, import_strict.default)(selectedPhase === "primary" || selectedPhase === "restart");
  phase = selectedPhase;
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
    const file = process.env[key];
    (0, import_strict.default)(file && within(profile, file));
    import_strict.default.equal((await nativeRead(file)).length, 0);
  }
  import_strict.default.equal(process.env.GIT_CONFIG_NOSYSTEM, "1");
  for (const key of Object.keys(process.env)) if (/^GIT_/i.test(key)) (0, import_strict.default)(["GIT_CONFIG_GLOBAL", "GIT_CONFIG_SYSTEM", "GIT_CONFIG_NOSYSTEM"].includes(key.toUpperCase()), "Code ambient Git selectors must match the supported synthetic owner-discovery context.");
  (0, import_strict.default)(process.env.TEMP && within(profile, process.env.TEMP));
  (0, import_strict.default)(process.env.TMP && within(profile, process.env.TMP));
  ownerEnvironment = minimalEnvironment();
  parentEnvironment = JSON.stringify(process.env);
  codeSha256 = hashCode();
  setupDirectory = (0, import_node_path.join)(profile, "f26a-hook-fixture");
  if (phase === "primary") {
    setupStage = "synthetic-repository-preparation";
    await import_strict.default.rejects(import_promises.default.lstat((0, import_node_path.join)(root, ".git")), { code: "ENOENT" });
    await import_promises.default.mkdir(setupDirectory);
    await import_promises.default.mkdir((0, import_node_path.join)(setupDirectory, "empty-hooks"));
    import_strict.default.equal((await setupGit("version", ["--version"])).trim(), VERSION);
    await setupGit("init", ["init", "--quiet", "--initial-branch=main", "--object-format=sha1", "--template=" + (0, import_node_path.join)(setupDirectory, "empty-hooks")]);
    for (const [key, value] of [["user.name", "F26a Synthetic Owner"], ["user.email", "synthetic-f26a@example.invalid"], ["core.autocrlf", "false"]])
      await setupGit("local-owner-config", ["config", "--local", key, value]);
  } else {
    ordinary(setupDirectory);
    ordinary((0, import_node_path.join)(root, ".git"));
  }
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
    const selected = productOperation(args, options);
    const child = Reflect.apply(nativeSpawn, import_node_child_process.default, values);
    void observe(child, selected.kind, selected.operation).catch(() => {
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
    const options = values[0];
    if (options?.maxHeaderSize === 4096) ownerServers++;
    return Reflect.apply(nativeCreateServer, import_node_http.default, args);
  });
  const store = context.secrets.store;
  patch(context.secrets, "store", async (key, value) => {
    if (key.startsWith("soterai.preCommit.signing.v1.")) stores.signing++;
    else if (key.startsWith("soterai.configBackupKey.v1.")) stores.backupKey++;
    else if (key.startsWith("soterai.preCommit.record.v1.")) {
      stores.record++;
      safeMetadata(value);
    } else stores.unrelated++;
    return store.call(context.secrets, key, value);
  });
  const originalFile = (value) => typeof value === "string" ? value : value instanceof vscode.Uri && value.scheme === "file" ? value.fsPath : void 0;
  const readObserved = (value) => {
    const file = originalFile(value);
    if (!file) return;
    if ([SOURCE, RENAMED].some((name) => samePath(file, (0, import_node_path.join)(root, name)))) directWorktreeReads++;
    if (within((0, import_node_path.join)(root, ".git", "objects"), file)) directObjectReads++;
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
    const file = originalFile(values[0]);
    if (file && within(root, file)) sourceDocuments++;
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
  setupStage = "instrumented-before-real-extension-activation";
}
async function run(context) {
  import_strict.default.equal(context, contextRef);
  const configuration = vscode.workspace.getConfiguration("soterai");
  const initialFlag = configuration.inspect(FLAG)?.globalValue;
  const runtimes = await runtimeFacts(), executionManifest = await fact((0, import_node_path.join)(context.extensionUri.fsPath, "package.json"));
  let driverFailure, restartState;
  const observations = [], checks = [];
  const add = (scope, work) => checks.push({ scope, work });
  const hook = (hooks = ".git/hooks") => (0, import_node_path.join)(root, hooks, "pre-commit");
  let beforeCustom, customBody, prior;
  const privateClean = () => {
    import_strict.default.equal(sourceDocuments, 0);
    import_strict.default.equal(sourceDocumentEvents, 0);
    import_strict.default.equal(directWorktreeReads, 0);
    import_strict.default.equal(directObjectReads, 0);
    (0, import_strict.default)(!metadataLeak);
    import_strict.default.equal(JSON.stringify(process.env), parentEnvironment);
  };
  const noEffects = () => ({ stores: { ...stores }, servers: ownerServers, wires: wires.length });
  const setFlag = async (value) => {
    await configuration.update(FLAG, value, vscode.ConfigurationTarget.Global);
    await idle();
  };
  if (phase === "primary") {
    add("Fresh marked profile exposes the four exact runtimes, commands and default-false restricted machine setting", async () => {
      import_strict.default.equal(configuration.inspect(FLAG)?.defaultValue, false);
      (0, import_strict.default)(initialFlag === void 0 || initialFlag === false);
      const commands2 = await vscode.commands.getCommands(true);
      for (const name of COMMANDS) (0, import_strict.default)(commands2.includes("soterai." + name));
      const manifest = JSON.parse(await nativeRead((0, import_node_path.join)(context.extensionUri.fsPath, "package.json"), "utf8"));
      for (const name of COMMANDS) (0, import_strict.default)(manifest.contributes.commands.some((item) => item.command === "soterai." + name));
      const property = manifest.contributes.configuration.properties["soterai." + FLAG];
      import_strict.default.equal(property.scope, "machine");
      import_strict.default.equal(property.default, false);
      (0, import_strict.default)(manifest.capabilities.untrustedWorkspaces.restrictedConfigurations.includes("soterai." + FLAG));
      import_strict.default.equal((await fact(hook())).present, false);
      import_strict.default.equal(head(), "UNBORN");
      await status("UNAVAILABLE");
      privateClean();
    });
    add("Disabled install has no key backup hook listener or caller-approval authority", async () => {
      const before = noEffects();
      import_strict.default.equal((await call("installPreCommitGuard")).status, "UNAVAILABLE");
      import_strict.default.deepEqual(noEffects(), before);
      import_strict.default.equal((await fact(hook())).present, false);
      import_strict.default.equal(reviews.length, 0);
    });
    add("Repository setting cannot enable the strict machine owner route", async () => {
      let refused = false;
      try {
        await configuration.update(FLAG, true, vscode.ConfigurationTarget.Workspace);
      } catch (error) {
        (0, import_strict.default)(error instanceof Error && error.name === "CodeExpectedError");
        refused = true;
      }
      try {
        import_strict.default.equal((await call("installPreCommitGuard")).status, "UNAVAILABLE");
        (0, import_strict.default)(refused || configuration.inspect(FLAG)?.globalValue !== true);
      } finally {
        if (!refused) await configuration.update(FLAG, void 0, vscode.ConfigurationTarget.Workspace);
      }
    });
    add("Enable plus cancelled native review creates no signing key encrypted backup or service", async () => {
      await setFlag(true);
      const before = noEffects();
      approve = false;
      try {
        import_strict.default.equal((await call("installPreCommitGuard")).status, "CANCELLED");
      } finally {
        approve = true;
      }
      import_strict.default.deepEqual(noEffects(), before);
      import_strict.default.equal((await fact(hook())).present, false);
      import_strict.default.equal((await backupFacts()).length, 0);
      import_strict.default.equal(reviews.at(-1)?.action, ACTIONS[0]);
    });
    add("Reviewed default installation owns exact hook bytes and encrypted absence recovery", async () => {
      await install(".git/hooks");
      const record = await saved();
      import_strict.default.equal(record.value.receipt.originalPresent, false);
      import_strict.default.equal(stores.signing, 1);
      import_strict.default.equal(stores.backupKey, 1);
    });
    add("Actual default owner public commit succeeds with signed request and complete object-scan witnesses", async () => {
      await stage(publicText("default positive"));
      await ownerCommit("default positive", "allow", "ALLOW");
    });
    add("Actual staged secret with public worktree is blocked by the signed full object scan", async () => {
      await stage(SECRET);
      await import_promises.default.writeFile((0, import_node_path.join)(root, SOURCE), publicText("sanitized worktree"));
      await ownerCommit("staged private public worktree", "block", "BLOCK");
    });
    add("Actual staged public with unstaged secret succeeds without worktree fallback", async () => {
      await stage(publicText("staged public control"));
      await import_promises.default.writeFile((0, import_node_path.join)(root, SOURCE), SECRET);
      await ownerCommit("public stage private worktree", "allow", "ALLOW");
    });
    add("Actual staged rename retains secret blob analysis despite a public renamed worktree", async () => {
      await stage(SECRET);
      await setupGit("rename-staged-source", ["mv", "--", SOURCE, RENAMED]);
      await import_promises.default.writeFile((0, import_node_path.join)(root, RENAMED), publicText("renamed worktree public"));
      const renamed = await fact((0, import_node_path.join)(root, RENAMED));
      await ownerCommit("renamed staged private", "block", "BLOCK");
      import_strict.default.deepEqual(await fact((0, import_node_path.join)(root, RENAMED)), renamed);
      await setupGit("restore-synthetic-source-name", ["mv", "--", RENAMED, SOURCE]);
    });
    add("Actual staged deletion permits the empty tree without reading removed secret objects", async () => {
      await stage(SECRET);
      await setupGit("remove-staged-source", ["rm", "--force", "--", SOURCE]);
      import_strict.default.equal((await setupGit("empty-stage-listing", ["ls-files", "--stage", "-z"])).length, 0);
      await ownerCommit("staged deletion empty tree", "allow", "ALLOW");
      await stage(publicText("restored public after deletion"));
      await ownerCommit("public after deletion", "allow", "ALLOW");
    });
    add("Alternate secret index blocks while the default public index remains byte exact", async () => {
      await stage(publicText("default public alternate private"));
      await import_promises.default.copyFile(selectedFile(), selectedFile(ALT), import_node_fs.default.constants.COPYFILE_EXCL);
      await stage(SECRET, ALT);
      await import_promises.default.writeFile((0, import_node_path.join)(root, SOURCE), publicText("alternate worktree public"));
      await ownerCommit("alternate private", "block", "BLOCK", ALT);
    });
    add("Alternate public index succeeds while the default secret index remains byte exact", async () => {
      await stage(SECRET);
      await stage(publicText("alternate public"), ALT);
      await import_promises.default.writeFile((0, import_node_path.join)(root, SOURCE), SECRET);
      await ownerCommit("alternate public", "allow", "ALLOW", ALT);
    });
    add("Exact fourth runtime is an actual directly observed finite Code Node child with close and both EOFs", async () => {
      await stage(publicText("direct worker control"));
      await directClient(".git/index", 0, true);
    });
    add("Explicit empty missing and directory client indexes refuse without HTTP or default-index fallback", async () => {
      for (const index of ["", ".git/f26a-missing-index", ".git"]) await directClient(index, 1, false);
    });
    add("Cancelled native restore preserves exact default hook and live reviewed owner", async () => {
      const before = await fact(hook()), effects = noEffects();
      approve = false;
      try {
        import_strict.default.equal((await call("restorePreCommitGuard")).status, "CANCELLED");
      } finally {
        approve = true;
      }
      import_strict.default.deepEqual(await fact(hook()), before);
      import_strict.default.deepEqual(noEffects(), effects);
      await status("LIVE");
    });
    add("Reviewed default undo restores absence and a later actual public commit needs no owned request", async () => {
      import_strict.default.equal((await call("restorePreCommitGuard")).status, "RESTORED");
      await idle();
      import_strict.default.equal((await fact(hook())).present, false);
      await stage(publicText("after default restore"));
      await ownerCommit("after default restore", "allow", "none");
    });
    add("Supported actual local custom hooksPath selects one preserved existing shell body and mode", async () => {
      await setupGit("set-local-custom-hooks", ["config", "--local", "core.hooksPath", CUSTOM]);
      await import_promises.default.mkdir((0, import_node_path.join)(root, CUSTOM));
      customBody = original(0);
      await import_promises.default.writeFile(hook(CUSTOM), customBody, { flag: "wx", mode: 493 });
      beforeCustom = await fact(hook(CUSTOM));
      import_strict.default.equal((await fact(hook())).present, false);
    });
    add("Custom review cancellation is inert and accepted install preserves the original body once", async () => {
      const effects = noEffects();
      approve = false;
      try {
        import_strict.default.equal((await call("installPreCommitGuard")).status, "CANCELLED");
      } finally {
        approve = true;
      }
      import_strict.default.deepEqual(noEffects(), effects);
      import_strict.default.deepEqual(await fact(hook(CUSTOM)), beforeCustom);
      await install(CUSTOM);
      const bytes = await nativeRead(hook(CUSTOM));
      (0, import_strict.default)(bytes.subarray(-customBody.length + 10).equals(customBody.subarray(10)));
      import_strict.default.equal((await fact(hook(CUSTOM))).mode, beforeCustom.mode);
      import_strict.default.equal((await fact(hook())).present, false);
    });
    add("Actual custom owner public commit invokes original exactly once with unmodified Git args and environment", async () => {
      const count = await markerCount();
      await stage(publicText("custom public"));
      await ownerCommit("custom public", "allow", "ALLOW");
      import_strict.default.equal(await markerCount(), count + 1);
    });
    add("Custom secret block never reaches original body and preserves its prior marker", async () => {
      const count = await markerCount();
      await stage(SECRET);
      await import_promises.default.writeFile((0, import_node_path.join)(root, SOURCE), publicText("custom sanitized worktree"));
      await ownerCommit("custom staged private", "block", "BLOCK");
      import_strict.default.equal(await markerCount(), count);
    });
    add("Reviewed custom undo restores exact original bytes and mode with subsequent original-only successful commit", async () => {
      import_strict.default.equal((await call("restorePreCommitGuard")).status, "RESTORED");
      await idle();
      import_strict.default.deepEqual(await fact(hook(CUSTOM)), beforeCustom);
      const count = await markerCount();
      await stage(publicText("custom original only"));
      await ownerCommit("custom original only", "allow", "none");
      import_strict.default.equal(await markerCount(), count + 1);
    });
    add("New reviewed custom round retains a supported literal exit-seven original", async () => {
      customBody = original(7);
      await import_promises.default.writeFile(hook(CUSTOM), customBody);
      beforeCustom = await fact(hook(CUSTOM));
      await install(CUSTOM);
    });
    add("Actual scanner ALLOW falls through once to original exit seven while Git aborts with its observed outer code", async () => {
      const count = await markerCount();
      await stage(publicText("custom exit seven"));
      await ownerCommit("custom exit seven", "block", "ALLOW");
      import_strict.default.equal(await markerCount(), count + 1);
    });
    add("Exact custom exit-seven undo preserves its bytes mode arguments environment and independent abort behavior", async () => {
      import_strict.default.equal((await call("restorePreCommitGuard")).status, "RESTORED");
      await idle();
      import_strict.default.deepEqual(await fact(hook(CUSTOM)), beforeCustom);
      const count = await markerCount();
      await stage(publicText("restored original exit seven"));
      await ownerCommit("restored exit seven", "block", "none");
      import_strict.default.equal(await markerCount(), count + 1);
    });
    add("Return to the actual default effective hooksPath without any owner-command override", async () => {
      await setupGit("unset-local-custom-hooks", ["config", "--local", "--unset", "core.hooksPath"]);
      import_strict.default.equal((await fact(hook())).present, false);
      await install(".git/hooks");
    });
    add("Actual machine disable withdraws service and blocks installed owner commit without original execution", async () => {
      await setFlag(false);
      await status("UNAVAILABLE");
      const count = await markerCount();
      await stage(publicText("disabled owner"));
      await ownerCommit("disabled owner", "block", "none");
      import_strict.default.equal(await markerCount(), count);
    });
    add("Explicit reviewed restore stays available while machine flag is false and restores absence", async () => {
      const keys = { signing: stores.signing, backupKey: stores.backupKey };
      import_strict.default.equal((await call("restorePreCommitGuard")).status, "RESTORED");
      await idle();
      import_strict.default.equal((await fact(hook())).present, false);
      import_strict.default.deepEqual({ signing: stores.signing, backupKey: stores.backupKey }, keys);
      await stage(publicText("flag off restored"));
      await ownerCommit("flag off restored", "allow", "none");
    });
    add("Fresh reviewed default installation establishes the exact retained restart owner basis", async () => {
      await setFlag(true);
      await install(".git/hooks");
      await stage(publicText("restart pending public"));
      await setupGit("prepare-offline-cache-tree", ["write-tree"]);
      const record = await saved();
      import_strict.default.equal(record.value.receipt.originalPresent, false);
      import_strict.default.equal(record.value.state, "APPLIED");
    });
    add("All actual direct children close with both EOFs zero signals and unchanged parent environment", async () => {
      (0, import_strict.default)(!halted);
      await Promise.all(pendingChildren);
      children.forEach(closed);
      privateClean();
      for (const row of children.filter((row2) => row2.kind === "projection" || row2.kind === "scan")) {
        if (row.kind === "projection" && row.operation === "config") (0, import_strict.default)(row.code === 0 || row.code === 1 && row.stdoutBytes === 0);
        else success(row);
        import_strict.default.equal(row.stderrBytes, 0);
      }
      import_strict.default.deepEqual(await runtimeFacts(), runtimes);
      import_strict.default.deepEqual(await fact((0, import_node_path.join)(context.extensionUri.fsPath, "package.json")), executionManifest);
      import_strict.default.equal(hashCode(), codeSha256);
      import_strict.default.equal(JSON.stringify(process.env), parentEnvironment);
    });
    add("Retain exact before-close source index hooks manifest/runtime and encrypted recovery facts for launcher offline proof", async () => {
      const record = await saved();
      restartState = {
        schemaVersion: 1,
        syntheticOnly: true,
        root,
        phase: "primary",
        ready: true,
        oldFlag: initialFlag,
        runtimeBindings: runtimes,
        executionManifest,
        hook: await fact(hook()),
        customHook: await fact(hook(CUSTOM)),
        index: await fact(selectedFile()),
        source: await fact((0, import_node_path.join)(root, SOURCE)),
        config: await fact((0, import_node_path.join)(root, ".git", "config")),
        head: head(),
        generation: record.pin.generation,
        publicPinSha256: sha(Buffer.from(record.value.pin, "base64")),
        recordSha256: sha(record.raw),
        descriptor: await fact(record.pin.descriptor),
        session: record.descriptor.session,
        backupFacts: await backupFacts(),
        ownerEnvironmentSha256: sha(JSON.stringify(ownerEnvironment)),
        offlineArguments: ownerArguments("offline owner absent"),
        offlineEnvironmentSha256: sha(JSON.stringify(ownerEnv())),
        driverSha256: sha(await nativeRead(__filename))
      };
      safeMetadata(restartState);
      await import_promises.default.writeFile(stateFile(), JSON.stringify(restartState, null, 2) + "\n", { flag: "wx" });
    });
  } else {
    add("Restart does not auto-resume query create key or mutate exact retained installation bytes", async () => {
      prior = JSON.parse(await nativeRead(stateFile(), "utf8"));
      (0, import_strict.default)(prior.schemaVersion === 1 && prior.ready && prior.syntheticOnly && prior.phase === "primary" && prior.root === root);
      import_strict.default.equal(children.length, 0);
      import_strict.default.equal(wires.length, 0);
      import_strict.default.equal(ownerServers, 0);
      import_strict.default.equal(reviews.length, 0);
      import_strict.default.deepEqual(stores, { signing: 0, backupKey: 0, record: 0, unrelated: 0 });
      await status("OWNER_REVIEW_REQUIRED");
      import_strict.default.deepEqual(await runtimeFacts(), prior.runtimeBindings);
      import_strict.default.equal(sha(await nativeRead(__filename)), prior.driverSha256);
      import_strict.default.deepEqual(executionManifest, prior.executionManifest);
      for (const [file, expected] of [[hook(), prior.hook], [hook(CUSTOM), prior.customHook], [selectedFile(), prior.index], [(0, import_node_path.join)(root, SOURCE), prior.source], [(0, import_node_path.join)(root, ".git", "config"), prior.config]])
        import_strict.default.deepEqual(await fact(file), expected);
      import_strict.default.equal(head(), prior.head);
      const record = await saved();
      import_strict.default.equal(sha(record.raw), prior.recordSha256);
      import_strict.default.equal(record.pin.generation, prior.generation);
      import_strict.default.equal(record.descriptor.session, prior.session);
      import_strict.default.equal(sha(Buffer.from(record.value.pin, "base64")), prior.publicPinSha256);
      import_strict.default.deepEqual(await fact(record.pin.descriptor), prior.descriptor);
      import_strict.default.deepEqual(await backupFacts(), prior.backupFacts);
      import_strict.default.equal(sha(JSON.stringify(ownerEnvironment)), prior.ownerEnvironmentSha256);
      privateClean();
    });
    add("Launcher actual closed-editor and offline owner commit receipt proves unavailable owner without stale ALLOW", async () => {
      (0, import_strict.default)(prior);
      const offline = JSON.parse(await nativeRead(absentFile(), "utf8"));
      import_strict.default.equal(offline.schemaVersion, 1);
      import_strict.default.equal(offline.status, "ACTUAL_OWNER_ABSENT_BLOCKED");
      import_strict.default.equal(offline.syntheticOnly, true);
      import_strict.default.equal(offline.primaryStateSha256, sha(await nativeRead(stateFile())));
      import_strict.default.equal(offline.generation, prior.generation);
      import_strict.default.equal(offline.code.observedExit, true);
      import_strict.default.equal(offline.code.exitCode, 0);
      import_strict.default.equal(offline.code.stdoutEOF, true);
      import_strict.default.equal(offline.code.stderrEOF, true);
      import_strict.default.equal(offline.code.signalsRequested, 0);
      import_strict.default.equal(offline.code.pidAbsentTwice, true);
      import_strict.default.equal(offline.code.streamsStable, true);
      import_strict.default.equal(offline.code.ownedWindowClose, "workbench.action.closeWindow");
      import_strict.default.equal(offline.code.executable, process.execPath);
      import_strict.default.equal(offline.owner.executable, GIT);
      import_strict.default.deepEqual(offline.owner.args, prior.offlineArguments);
      import_strict.default.equal(offline.owner.cwd, root);
      import_strict.default.equal(offline.owner.environmentSha256, prior.offlineEnvironmentSha256);
      import_strict.default.equal(offline.owner.closed, true);
      import_strict.default.equal(offline.owner.stdoutEOF, true);
      import_strict.default.equal(offline.owner.stderrEOF, true);
      import_strict.default.equal(offline.owner.signalsRequested, 0);
      import_strict.default.equal(offline.owner.signal, null);
      (0, import_strict.default)(Number.isInteger(offline.owner.exitCode) && offline.owner.exitCode !== 0);
      import_strict.default.equal(offline.owner.timedOut, false);
      import_strict.default.equal(offline.owner.ownerArgumentsHaveNoHooksOverride, true);
      import_strict.default.equal(offline.headBefore, prior.head);
      import_strict.default.equal(offline.headAfter, prior.head);
      import_strict.default.deepEqual(offline.sourceBefore, prior.source);
      import_strict.default.deepEqual(offline.sourceAfter, prior.source);
      import_strict.default.deepEqual(offline.indexBefore, prior.index);
      import_strict.default.deepEqual(offline.indexAfter, prior.index);
      import_strict.default.deepEqual(offline.hookBefore, prior.hook);
      import_strict.default.deepEqual(offline.hookAfter, prior.hook);
      for (const stream of [offline.owner.stdout, offline.owner.stderr]) {
        (0, import_strict.default)(typeof stream.path === "string" && within(parent, stream.path));
        const bytes = await nativeRead(stream.path);
        import_strict.default.equal(bytes.length, stream.bytes);
        import_strict.default.equal(sha(bytes), stream.sha256);
      }
      await ownerCommit("before explicit restart resume", "block", "none");
      await status("OWNER_REVIEW_REQUIRED");
    });
    add("Cancelled explicit resume leaves the retained key backup hook and old signed endpoint unchanged", async () => {
      (0, import_strict.default)(prior);
      const before = noEffects();
      approve = false;
      try {
        import_strict.default.equal((await call("resumePreCommitGuard")).status, "CANCELLED");
      } finally {
        approve = true;
      }
      import_strict.default.deepEqual(noEffects(), before);
      import_strict.default.equal(reviews.at(-1)?.action, ACTIONS[1]);
      const record = await saved();
      import_strict.default.equal(record.descriptor.session, prior.session);
      import_strict.default.equal(sha(record.raw), prior.recordSha256);
      import_strict.default.deepEqual(await fact(hook()), prior.hook);
      await status("OWNER_REVIEW_REQUIRED");
    });
    add("Reviewed resume signs a fresh session and commits public staged data; unknown hook owner edit is preserved INCOMPLETE", async () => {
      (0, import_strict.default)(prior);
      import_strict.default.equal((await call("resumePreCommitGuard")).status, "RESUMED");
      await status("LIVE");
      import_strict.default.equal(reviews.at(-1)?.action, ACTIONS[1]);
      const record = await saved();
      import_strict.default.notEqual(record.descriptor.session, prior.session);
      import_strict.default.equal(record.pin.generation, prior.generation);
      import_strict.default.equal(sha(Buffer.from(record.value.pin, "base64")), prior.publicPinSha256);
      import_strict.default.equal(stores.signing, 0);
      import_strict.default.equal(stores.backupKey, 0);
      import_strict.default.deepEqual(await backupFacts(), prior.backupFacts);
      await ownerCommit("reviewed restart public", "allow", "ALLOW");
      const edit = Buffer.from("#!/bin/sh\n# TEST_ONLY_F26A_OWNER_EDIT_RETAIN_EXACT\nexit 9\n");
      await import_promises.default.writeFile((0, import_node_path.join)(parent, "precommit-owner-edit-retained.sh"), edit, { flag: "wx" });
      await import_promises.default.writeFile(hook(), edit);
      const ownerEdit = await fact(hook()), beforeReview = reviews.length;
      import_strict.default.equal((await call("restorePreCommitGuard")).status, "INCOMPLETE");
      import_strict.default.equal(reviews.length, beforeReview);
      import_strict.default.deepEqual(await fact(hook()), ownerEdit);
      (0, import_strict.default)((await nativeRead(hook())).equals(await nativeRead((0, import_node_path.join)(parent, "precommit-owner-edit-retained.sh"))));
      const raw = await contextRef.secrets.get(recordKey());
      (0, import_strict.default)(raw && JSON.parse(raw).state === "INCOMPLETE");
      import_strict.default.deepEqual(await backupFacts(), prior.backupFacts);
      await until(async () => (await call("preCommitGuardStatus")).status !== "LIVE", "Edited hook must withdraw owner.");
      await setFlag(prior.oldFlag);
      (0, import_strict.default)(!halted);
      await Promise.all(pendingChildren);
      children.forEach(closed);
      privateClean();
      import_strict.default.deepEqual(await runtimeFacts(), runtimes);
    });
  }
  import_strict.default.equal(checks.length, phase === "primary" ? 30 : 4);
  for (let index = 0; index < checks.length; index++) observations.push({ id: "F26A-H" + (phase === "primary" ? "P" : "R") + String(index + 1).padStart(2, "0"), scope: checks[index].scope, status: "NOT_RUN" });
  try {
    for (let index = 0; index < checks.length; index++) {
      caseId = observations[index].id;
      setupStage = caseId;
      try {
        (0, import_strict.default)(!halted);
        await checks[index].work();
        observations[index].status = "PASS";
      } catch (error) {
        observations[index].status = "FAIL";
        observations[index].errorName = error instanceof Error ? error.name : "UnknownFailure";
        driverFailure = halted ? "STOP_UNCONFIRMED" : "NativePreCommitGuardFailure";
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
      fixtureStatus: "PREPARED_NATIVE_FIXTURE_ACTUAL_RESULTS_ONLY",
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
      expectedChecks: phase === "primary" ? 30 : 4,
      passed: observations.filter((row) => row.status === "PASS").length,
      failed: observations.filter((row) => row.status === "FAIL").length,
      notRun: observations.filter((row) => row.status === "NOT_RUN").length,
      children,
      requests: wires,
      commitProofs,
      reviews,
      secretStores: stores,
      ownerServers,
      sourceDocuments,
      sourceDocumentEvents,
      directWorktreeReads,
      directObjectReads,
      metadataLeak,
      parentEnvironmentUnchanged: JSON.stringify(process.env) === parentEnvironment,
      driverFailure,
      busyChildren: children.filter((row) => row.busy).length,
      timedOutChildren: children.filter((row) => row.timedOut).length,
      readyForInterphase: phase === "primary" && !!restartState && !driverFailure && !busy,
      interphaseEvidence: phase === "restart" && observations[1].status === "PASS" ? "ACTUAL_LAUNCHER_RECEIPT_VALIDATED" : "NOT_RUN",
      nestedClientClosure: "NOT_INFERRED_FROM_OWNER_GIT;ADDITIONAL_DIRECT_PACKAGED_CLIENT_CLOSE_EOF_CONTROLS",
      limits: { stagedEntries: 128, blobBytes: 65536, admittedBytes: 1048576, operationMilliseconds: 6e4, fixtureChildMilliseconds: CHILD_LIMIT },
      independence: "LOW",
      ownerPresence: "SCRIPTED_NATIVE_API_DECISIONS_NOT_HUMAN_REVIEW",
      notTested: [
        "Same-user bypass or atomic OS confinement",
        "Human review accessibility/usability",
        "Registered-value guarantee or credential validity",
        "Other platforms/remote workspaces",
        "Held-result withdrawal is UNIT_ONLY unless separately witnessed in actual native receipt"
      ]
    };
    safeMetadata(summary);
    await import_promises.default.writeFile(output, JSON.stringify(summary, null, 2) + "\n", { flag: "wx" });
    if (busy) throw Error("STOP_UNCONFIRMED: retain editor ownership; do not close or advance phases.");
  }
  if (driverFailure || observations.some((row) => row.status !== "PASS")) throw Error("Native pre-commit guard incomplete.");
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  beforeActivate,
  run,
  setupDiagnostic
});
