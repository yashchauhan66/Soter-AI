/**
 * v0.2.0 — MAIN-world WebSocket hook.
 *
 * Declared in manifest.json with `"world": "MAIN"` so it runs in the page's JS
 * context (where `WebSocket` lives) without inline-script injection — this is
 * CSP-safe even on pages with `script-src 'self'`.
 *
 * It forwards incoming WebSocket text frames to the isolated-world content
 * script via a CustomEvent. It never modifies, blocks, or drops frames.
 *
 * v0.2.2 — frames that arrive before the content script exists are no longer lost.
 *
 * This hook runs at `document_start`; the isolated-world observer that listens for the bridge
 * event is part of the content script, which runs at `document_idle`. Everything in between went
 * nowhere. That is not a narrow window: a chat page opens its socket during load and the first
 * streamed answer can start arriving immediately, so the response tier was blind to exactly the
 * frames it most needed to see. Runtime-proved in Edge — a socket opened during load produced no
 * finding, while the same frame on a socket opened after load produced a critical one.
 *
 * Frames are now buffered until the observer announces itself, then replayed once. The buffer is
 * bounded (frames and total characters) and dropped after the replay, so a page that streams
 * megabytes before `document_idle` cannot grow it without limit.
 */

(function () {
  const BRIDGE = "soter-ws-frame";
  const READY = "soter-ws-ready";
  const MAX = 100_000;
  const MAX_BUFFERED_FRAMES = 40;
  const MAX_BUFFERED_CHARS = 200_000;

  let ready = false;
  let buffered: string[] = [];
  let bufferedChars = 0;

  function emit(text: string) {
    try {
      window.dispatchEvent(new CustomEvent(BRIDGE, { detail: { text } }));
    } catch {
      /* page may have removed CustomEvent; nothing to do */
    }
  }

  function forward(data: unknown) {
    if (typeof data !== "string") return;
    const text = data.length > MAX ? data.slice(0, MAX) : data;
    if (ready) {
      emit(text);
      return;
    }
    // Still dispatch: if the listener is somehow already attached, this is the live path and the
    // replay below is a no-op for it (the observer de-duplicates findings by content).
    emit(text);
    if (buffered.length >= MAX_BUFFERED_FRAMES || bufferedChars >= MAX_BUFFERED_CHARS) return;
    buffered.push(text);
    bufferedChars += text.length;
  }

  window.addEventListener(READY, () => {
    if (ready) return;
    ready = true;
    const pending = buffered;
    buffered = [];
    bufferedChars = 0;
    for (const text of pending) emit(text);
  });

  // Hook addEventListener("message", ...)
  const origAdd = WebSocket.prototype.addEventListener;
  WebSocket.prototype.addEventListener = function (
    this: WebSocket,
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ) {
    if (type === "message" && typeof listener === "function") {
      const fn = listener as (event: Event) => unknown;
      const wrapped = function (this: WebSocket, event: Event) {
        try { forward((event as MessageEvent).data); } catch { /* never break the page */ }
        return fn.call(this, event);
      };
      return origAdd.call(this, type, wrapped as EventListener, options);
    }
    if (listener === null) return;
    return origAdd.call(this, type, listener, options);
  };

  // Hook the onmessage property setter
  const desc = Object.getOwnPropertyDescriptor(WebSocket.prototype, "onmessage");
  if (desc && desc.set) {
    Object.defineProperty(WebSocket.prototype, "onmessage", {
      get: desc.get,
      set(this: WebSocket, handler: ((ev: MessageEvent) => unknown) | null) {
        if (typeof handler !== "function") return desc.set!.call(this, handler);
        const wrapped = function (this: WebSocket, event: MessageEvent) {
          try { forward(event.data); } catch { /* never break the page */ }
          return handler.call(this, event);
        };
        desc.set!.call(this, wrapped);
      },
      configurable: true,
    });
  }
})();