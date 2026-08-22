/**
 * v0.2.0 — MAIN-world WebSocket hook.
 *
 * Declared in manifest.json with `"world": "MAIN"` so it runs in the page's JS
 * context (where `WebSocket` lives) without inline-script injection — this is
 * CSP-safe even on pages with `script-src 'self'`.
 *
 * It forwards incoming WebSocket text frames to the isolated-world content
 * script via a CustomEvent. It never modifies, blocks, or drops frames.
 */

(function () {
  const BRIDGE = "soter-ws-frame";
  const MAX = 100_000;

  function forward(data: unknown) {
    if (typeof data !== "string") return;
    const text = data.length > MAX ? data.slice(0, MAX) : data;
    try {
      window.dispatchEvent(new CustomEvent(BRIDGE, { detail: { text } }));
    } catch {
      /* page may have removed CustomEvent; nothing to do */
    }
  }

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