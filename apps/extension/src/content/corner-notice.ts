/**
 * The one place a content script puts a short, non-blocking notice on the page.
 *
 * Before this, the file-upload path used `alert()` for three different outcomes. `alert()` is a
 * *page*-level modal: it renders outside the closed shadow root the verdict deliberately lives
 * in, it blocks the event loop (so an approval poll behind it stalls), its text is unstyled and
 * unattributable — "Approved! Please select the file again to upload." looked to a real user
 * like the website was talking, not Soter — and it cannot be dismissed by anything but a click.
 *
 * Notices stack in a fixed column so two of them never draw on top of each other.
 */

export type NoticeTone = "critical" | "warning" | "info";

export interface CornerNoticeOptions {
  tone: NoticeTone;
  title: string;
  /** Extra lines under the title. Rendered as text, never as markup. */
  lines?: string[];
  /**
   * Replaces any existing notice with the same key instead of stacking another one — streamed
   * responses and repeated file selections would otherwise pile up.
   */
  key?: string;
  /**
   * Only for `info` confirmations of something the user just did, which are noise once read.
   * A warning about data the user has not seen yet must never remove itself: leave this unset
   * and let the × be the only exit.
   */
  autoDismissMs?: number;
}

const STACK_ATTR = "data-soter-notice-stack";
const NOTICE_ATTR = "data-soter-corner-notice";

/**
 * Tell the user an invisible payload was removed, without interrupting them.
 *
 * Shared by the paste and submit paths, which both de-smuggle outgoing text. This is the one
 * alteration the extension makes regardless of the policy action, and it is defensible precisely
 * because it cannot touch anything the user can see: only tag codepoints and variation-selector
 * runs are removed, and those render as nothing. A `warn` that left them in would ship an attack
 * the user never wrote; a block over characters they cannot proofread would interrupt work they
 * did intend. It is a `warning` tone with no auto-dismiss on the submit path's terms — the user
 * should get to read that something was carried in their text — but it never takes a decision.
 */
export function noticeHiddenPayloadRemoved(where: "paste" | "message", removed: number, flagged: string[] = []) {
  showCornerNotice({
    tone: "warning",
    key: "soter-hidden-payload",
    title: `Soter removed ${removed} hidden character${removed === 1 ? "" : "s"} from your ${where}`,
    lines: [
      "Invisible Unicode was carrying instructions to the AI that you could not see.",
      flagged.length ? `Flagged as: ${flagged.join(", ")}` : "",
      "Every visible character of your own text was kept exactly as written.",
    ].filter(Boolean),
  });
}

const TONES: Record<NoticeTone, string> = {
  critical: "background:rgba(254,242,242,0.97);border:1px solid rgba(220,38,38,0.28);color:#7f1d1d",
  warning: "background:rgba(255,251,235,0.97);border:1px solid rgba(217,119,6,0.28);color:#78350f",
  info: "background:rgba(240,249,255,0.97);border:1px solid rgba(2,132,199,0.26);color:#0c4a6e",
};

function getStack(): HTMLElement {
  const existing = document.querySelector(`[${STACK_ATTR}]`) as HTMLElement | null;
  if (existing) return existing;
  const stack = document.createElement("div");
  stack.setAttribute(STACK_ATTR, "true");
  stack.style.cssText = [
    "position:fixed", "right:16px", "bottom:16px", "z-index:2147483647",
    "display:flex", "flex-direction:column", "gap:8px", "align-items:flex-end",
    // The stack itself must not eat clicks meant for the page underneath it.
    "pointer-events:none",
    "max-width:min(360px,calc(100vw - 32px))",
  ].join(";");
  // Mounted inside <body>, not on <html>. The enforcement overlay's SS-6 integrity check asks
  // whether anything is stacked after its host — a direct child of <html> — and a notice
  // appended alongside it would have read as a page trying to paint over the verdict. That check
  // now also ignores elements the extension owns, so this is belt and braces; <body> is where
  // page-level furniture belongs regardless.
  (document.body ?? document.documentElement).appendChild(stack);
  return stack;
}

/** Mounts a notice and returns a function that removes it. */
export function showCornerNotice(options: CornerNoticeOptions): () => void {
  const stack = getStack();
  if (options.key) {
    stack.querySelector(`[${NOTICE_ATTR}="${cssEscapeValue(options.key)}"]`)?.remove();
  }

  const notice = document.createElement("div");
  notice.setAttribute(NOTICE_ATTR, options.key ?? "true");
  notice.setAttribute("role", options.tone === "info" ? "status" : "alert");
  notice.style.cssText = [
    "pointer-events:auto", "box-sizing:border-box", "width:100%",
    "display:flex", "align-items:flex-start", "gap:10px",
    "padding:12px 14px", "border-radius:12px",
    "font:12px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
    TONES[options.tone],
    "box-shadow:0 8px 24px rgba(15,23,42,0.14)",
    "backdrop-filter:blur(8px)",
    "opacity:0", "transform:translateY(6px)",
    "transition:opacity 0.25s ease,transform 0.25s ease",
  ].join(";");

  const icon = document.createElement("span");
  icon.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
  icon.style.cssText = "display:flex;align-items:center;padding-top:1px;opacity:0.85;flex-shrink:0";

  const body = document.createElement("div");
  body.style.cssText = "flex:1;min-width:0";
  const title = document.createElement("div");
  title.textContent = options.title;
  title.style.cssText = "font-weight:600;letter-spacing:-0.01em";
  body.appendChild(title);
  for (const line of options.lines ?? []) {
    if (!line) continue;
    const paragraph = document.createElement("div");
    // textContent, never innerHTML: these lines carry policy rule names and detector labels,
    // and this element is injected into a page the extension does not control.
    paragraph.textContent = line;
    paragraph.style.cssText = "margin-top:4px;opacity:0.85";
    body.appendChild(paragraph);
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const remove = () => {
    clearTimeout(timer);
    notice.style.opacity = "0";
    notice.style.transform = "translateY(6px)";
    setTimeout(() => {
      notice.remove();
      const container = document.querySelector(`[${STACK_ATTR}]`);
      if (container && !container.childElementCount) container.remove();
    }, 250);
  };

  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.innerHTML = "&times;";
  dismiss.title = "Dismiss this notice";
  dismiss.setAttribute("aria-label", "Dismiss notice");
  dismiss.style.cssText =
    "background:none;border:0;cursor:pointer;font-size:17px;line-height:1;opacity:0.55;padding:0 2px;color:inherit;flex-shrink:0";
  dismiss.addEventListener("click", remove);

  notice.appendChild(icon);
  notice.appendChild(body);
  notice.appendChild(dismiss);
  stack.appendChild(notice);
  requestAnimationFrame(() => {
    notice.style.opacity = "1";
    notice.style.transform = "translateY(0)";
  });

  if (options.autoDismissMs && options.tone === "info") {
    timer = setTimeout(remove, options.autoDismissMs);
  }
  return remove;
}

/** Removes every notice this module mounted. Used by content-script teardown. */
export function clearCornerNotices() {
  document.querySelectorAll(`[${STACK_ATTR}]`).forEach((node) => node.remove());
}

/** Attribute selectors are built from keys this codebase controls, but quoting them is free. */
function cssEscapeValue(value: string) {
  return value.replace(/["\\]/g, "\\$&");
}
