/**
 * v0.2.2 — the MAIN-world WebSocket bridge must not lose the frames it exists to see.
 *
 * `ws-page-hook.ts` is declared `"world": "MAIN"` at `document_start`; the isolated-world observer
 * that listens for its bridge event ships in the content script, which runs at `document_idle`.
 * Every frame in between was dispatched to nobody. That is not a narrow window — a chat page opens
 * its socket during load and the first streamed answer can begin arriving immediately, so the
 * response tier was blind to precisely the frames it most needed to see. Runtime-proved in Edge by
 * contrast: a socket opened during load produced no finding at all, while the same frame on a
 * socket opened five seconds after load produced a critical one.
 *
 * The hook now buffers until the observer announces itself with `soter-ws-ready`, replays once, and
 * drops the buffer. These tests drive the real module source: the page hook is an IIFE with no
 * exports, so the harness transpiles it in process and evaluates it against a fake `window` /
 * `WebSocket` pair, then plays the race out frame by frame. Evaluation rather than `import` is
 * deliberate — an ESM import is cached, and a cached module hands the second test an already-ready
 * buffer and an unpatched `WebSocket`, which silently passes assertions it never exercised.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const HOOK = resolve(import.meta.dirname, "../../apps/extension/src/content/ws-page-hook.ts");

/** Declared in the hook; asserted against the source so the tests cannot drift from it. */
const hookSource = readFileSync(HOOK, "utf8");
function constant(name: string): number {
  const match = hookSource.match(new RegExp(`const ${name} = ([\\d_]+)`));
  assert.ok(match, `ws-page-hook.ts must declare ${name}`);
  return Number(match[1].replace(/_/g, ""));
}
const MAX = constant("MAX");
const MAX_BUFFERED_FRAMES = constant("MAX_BUFFERED_FRAMES");
const MAX_BUFFERED_CHARS = constant("MAX_BUFFERED_CHARS");

/** The shipped hook, type annotations removed, ready to evaluate in a scope we control. */
const hookJs = ts.transpileModule(hookSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;

/**
 * A page-world stand-in. `window` records only what an attached listener would actually see, so a
 * frame dispatched before the observer exists is genuinely lost unless the replay delivers it.
 */
function setup() {
  const listeners = new Map<string, Array<(event: any) => void>>();
  const fakeWindow = {
    addEventListener(type: string, listener: (event: any) => void) {
      const existing = listeners.get(type) ?? [];
      existing.push(listener);
      listeners.set(type, existing);
    },
    dispatchEvent(event: { type: string; detail?: unknown }) {
      for (const listener of listeners.get(event.type) ?? []) listener(event);
      return true;
    },
  };

  /** `onmessage` is a prototype accessor, which is what the hook re-defines. */
  class FakeWebSocket {
    private handler: ((event: any) => unknown) | null = null;
    private attached: Array<[string, (event: any) => unknown]> = [];
    addEventListener(type: string, listener: (event: any) => unknown) {
      this.attached.push([type, listener]);
    }
    get onmessage() { return this.handler; }
    set onmessage(value: ((event: any) => unknown) | null) { this.handler = value; }
    /** The page receives a frame. */
    receive(data: unknown) {
      for (const [type, listener] of this.attached) if (type === "message") listener.call(this, { data });
      if (this.handler) this.handler.call(this, { data });
    }
  }

  class FakeCustomEvent {
    type: string;
    detail: unknown;
    constructor(type: string, init?: { detail?: unknown }) {
      this.type = type;
      this.detail = init?.detail;
    }
  }

  // The hook's free `window` / `WebSocket` / `CustomEvent` identifiers resolve to these parameters,
  // so nothing leaks between tests and no real global is mutated.
  const customEvent = { current: FakeCustomEvent as unknown as typeof FakeCustomEvent };
  const proxiedCustomEvent = function (this: unknown, type: string, init?: { detail?: unknown }) {
    return new (customEvent.current as any)(type, init);
  } as unknown as typeof FakeCustomEvent;
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function("window", "WebSocket", "CustomEvent", hookJs)(fakeWindow, FakeWebSocket, proxiedCustomEvent);

  /** Frames the isolated-world observer actually receives, once it is listening. */
  const received: string[] = [];
  return {
    socket: () => new FakeWebSocket(),
    /** The content script starts listening (isolated world, `document_idle`). */
    observe() {
      fakeWindow.addEventListener("soter-ws-frame", (event: any) => received.push(event.detail.text));
    },
    /** The content script announces itself, which is what triggers the replay. */
    announceReady() {
      fakeWindow.dispatchEvent({ type: "soter-ws-ready" });
    },
    /** Simulates a page that has broken `CustomEvent`, for the never-break-the-page assertion. */
    breakCustomEvent(broken: boolean) {
      customEvent.current = (broken
        ? function () { throw new Error("page removed CustomEvent"); }
        : FakeCustomEvent) as unknown as typeof FakeCustomEvent;
    },
    received,
  };
}

test("WS-810: a frame that arrives before document_idle is replayed, not lost", async () => {
  const lab = setup();
  const socket = lab.socket();
  socket.addEventListener("message", () => {});

  // document_start .. document_idle: the socket is already streaming.
  socket.receive("here is the AWS key AKIAIOSFODNN7EXAMPLE for the staging bucket");
  lab.observe();
  assert.deepEqual(lab.received, [], "the frame was dispatched before anyone was listening — this is the bug");

  lab.announceReady();
  assert.equal(lab.received.length, 1, "the replay must deliver the frame the observer could not have seen");
  assert.ok(lab.received[0].includes("AKIAIOSFODNN7EXAMPLE"), "and deliver it verbatim, not a summary");
});

test("WS-811: the replay happens exactly once, however many times ready is announced", async () => {
  const lab = setup();
  const socket = lab.socket();
  socket.addEventListener("message", () => {});
  socket.receive("a streamed answer long enough to matter");
  lab.observe();

  lab.announceReady();
  lab.announceReady();
  lab.announceReady();
  assert.equal(lab.received.length, 1, "a re-announced observer must not re-scan the same frames");
});

test("WS-812: after the handshake frames go straight through and nothing accumulates", async () => {
  const lab = setup();
  const socket = lab.socket();
  socket.addEventListener("message", () => {});
  lab.observe();
  lab.announceReady();

  socket.receive("first live frame");
  socket.receive("second live frame");
  assert.deepEqual(lab.received, ["first live frame", "second live frame"]);

  // Nothing was buffered post-handshake, so a further announce cannot resurrect anything.
  lab.announceReady();
  assert.equal(lab.received.length, 2);
});

test("WS-813: the pre-handshake buffer is bounded by frame count and by total characters", async () => {
  const byCount = setup();
  const countSocket = byCount.socket();
  countSocket.addEventListener("message", () => {});
  for (let index = 0; index < MAX_BUFFERED_FRAMES + 12; index += 1) countSocket.receive(`frame ${index}`);
  byCount.observe();
  byCount.announceReady();
  assert.equal(byCount.received.length, MAX_BUFFERED_FRAMES,
    "a page that streams during load must not be able to grow the buffer without limit");
  assert.equal(byCount.received[0], "frame 0", "the earliest frames are the ones worth keeping");

  const byChars = setup();
  const charSocket = byChars.socket();
  charSocket.addEventListener("message", () => {});
  const chunk = "x".repeat(50_000);
  for (let index = 0; index < 8; index += 1) charSocket.receive(chunk);
  byChars.observe();
  byChars.announceReady();
  const replayedChars = byChars.received.reduce((total, text) => total + text.length, 0);
  assert.ok(replayedChars <= MAX_BUFFERED_CHARS + chunk.length,
    `replayed ${replayedChars} chars, which is past the ${MAX_BUFFERED_CHARS} budget`);
  assert.ok(byChars.received.length < 8, "the character budget must bite before the frame budget here");
});

test("WS-814: binary frames are ignored rather than stringified", async () => {
  const lab = setup();
  const socket = lab.socket();
  socket.addEventListener("message", () => {});
  socket.receive(new ArrayBuffer(64));
  socket.receive({ not: "a string" });
  socket.receive(null);
  lab.observe();
  lab.announceReady();
  assert.deepEqual(lab.received, [], "only text frames are in scope; a stringified buffer would be noise");
});

test("WS-815: an oversized frame is truncated before it crosses the bridge", async () => {
  const lab = setup();
  const socket = lab.socket();
  socket.addEventListener("message", () => {});
  socket.receive("y".repeat(MAX + 5_000));
  lab.observe();
  lab.announceReady();
  assert.equal(lab.received.length, 1);
  assert.equal(lab.received[0].length, MAX, "one frame must not be able to hand the scanner unbounded text");
});

test("WS-816: the page's own handler still runs, and still runs when the bridge throws", async () => {
  const lab = setup();
  const socket = lab.socket();
  const seenByPage: unknown[] = [];

  socket.addEventListener("message", (event: any) => { seenByPage.push(event.data); });
  socket.onmessage = (event: any) => { seenByPage.push(`onmessage:${event.data}`); };

  socket.receive("hello");
  assert.deepEqual(seenByPage, ["hello", "onmessage:hello"],
    "the hook wraps both delivery paths and must forward to the page unchanged");

  // A page that removes CustomEvent must not take its own socket down with it.
  lab.breakCustomEvent(true);
  try {
    socket.receive("still delivered");
  } finally {
    lab.breakCustomEvent(false);
  }
  assert.ok(seenByPage.includes("still delivered"), "detection must never break the page it observes");
});

test("WS-817: the isolated-world observer actually announces itself", () => {
  // Without this dispatch the buffer above is dead weight: it fills during load and is never
  // replayed, which is the pre-0.2.2 behaviour with extra memory.
  const observer = readFileSync(
    resolve(import.meta.dirname, "../../apps/extension/src/content/websocket-observer.ts"),
    "utf8",
  );
  assert.ok(/dispatchEvent\(new CustomEvent\("soter-ws-ready"\)\)/.test(observer),
    "installWebSocketObserver must dispatch soter-ws-ready after attaching its bridge listener");
  const listenAt = observer.indexOf("addEventListener(BRIDGE_EVENT");
  const readyAt = observer.indexOf('CustomEvent("soter-ws-ready")');
  assert.ok(listenAt !== -1 && readyAt > listenAt,
    "announce ready only after the listener is attached, or the replay lands on nothing");
});
