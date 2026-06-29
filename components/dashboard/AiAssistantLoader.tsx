"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// The assistant is a large client component (chat state, markdown renderer,
// per-page context map). It is non-critical UI, so we keep it out of the
// initial bundle entirely (ssr: false) and only mount it once the browser is
// idle or the visitor first interacts with the page. This stops it from
// competing with initial render/hydration on marketing & SEO landing pages.
const AiAssistant = dynamic(
  () => import("./AiAssistant").then((m) => m.AiAssistant),
  { ssr: false },
);

export function AiAssistantLoader() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) return;

    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const trigger = () => setReady(true);

    // Whichever comes first: the browser goes idle, a short fallback timer
    // elapses, or the visitor interacts with the page.
    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(trigger, { timeout: 3000 });
    } else {
      timeoutId = setTimeout(trigger, 1500);
    }

    const opts: AddEventListenerOptions = { once: true, passive: true };
    const events = ["pointerdown", "keydown", "touchstart", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, trigger, opts));

    return () => {
      if (idleId !== undefined && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      events.forEach((e) => window.removeEventListener(e, trigger));
    };
  }, [ready]);

  return ready ? <AiAssistant /> : null;
}
