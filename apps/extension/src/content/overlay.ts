import type { ScanResult } from "../lib/types";

interface OverlayOptions {
  result: ScanResult;
  onReplace?: () => void;
  onCopy?: () => void;
  onApproval?: () => void;
}

export function showSoterOverlay(options: OverlayOptions) {
  document.querySelector("[data-soter-overlay]")?.remove();
  const host = document.createElement("div");
  host.setAttribute("data-soter-overlay", "true");
  host.style.position = "fixed";
  host.style.inset = "0";
  host.style.zIndex = "2147483647";
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });
  const result = options.result;
  const detected = result.detectedDataTypes.length ? result.detectedDataTypes.join(", ") : "None";
  shadow.innerHTML = `
    <style>
      :host { all: initial; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #14213d; }
      .backdrop { position: fixed; inset: 0; background: rgba(7, 13, 24, 0.42); display: grid; place-items: center; padding: 24px; }
      .panel { width: min(560px, 100%); background: #ffffff; border: 1px solid #d9e2ec; border-radius: 8px; box-shadow: 0 24px 80px rgba(7,13,24,0.28); overflow: hidden; }
      .header { padding: 18px 20px; background: #f6f8fb; border-bottom: 1px solid #e6edf5; }
      .title { margin: 0; font-size: 18px; line-height: 1.3; font-weight: 750; }
      .body { padding: 18px 20px; display: grid; gap: 12px; }
      .metric { display: flex; justify-content: space-between; gap: 16px; font-size: 13px; }
      .value { font-weight: 700; text-transform: uppercase; }
      .message { margin: 0; color: #344256; line-height: 1.45; }
      textarea { width: 100%; min-height: 110px; box-sizing: border-box; resize: vertical; border: 1px solid #c7d2df; border-radius: 6px; padding: 10px; font: 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: #1f2937; }
      .actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; padding: 14px 20px 18px; }
      button { border: 1px solid #bbc8d8; background: #ffffff; color: #182234; border-radius: 6px; padding: 8px 12px; font-weight: 650; cursor: pointer; }
      button.primary { background: #1463ff; border-color: #1463ff; color: white; }
      button.danger { background: #b42318; border-color: #b42318; color: white; }
    </style>
    <div class="backdrop">
      <section class="panel" role="dialog" aria-modal="true" aria-label="Soter warning">
        <div class="header"><h2 class="title">Soter detected sensitive data</h2></div>
        <div class="body">
          <p class="message">${escapeHtml(result.policy.userMessage)}</p>
          <div class="metric"><span>Action</span><span class="value">${escapeHtml(result.action)}</span></div>
          <div class="metric"><span>Risk score</span><span class="value">${result.riskScore}</span></div>
          <div class="metric"><span>Detected</span><span>${escapeHtml(detected)}</span></div>
          <textarea readonly>${escapeHtml(result.rewrittenSafeText || result.redactedText)}</textarea>
        </div>
        <div class="actions">
          <button data-action="dismiss">Dismiss</button>
          <button data-action="copy">Copy safe prompt</button>
          <button data-action="replace" class="primary">Use safe prompt</button>
          ${result.action === "require_approval" ? '<button data-action="approval" class="danger">Request approval</button>' : ""}
        </div>
      </section>
    </div>
  `;

  shadow.querySelector("[data-action='dismiss']")?.addEventListener("click", () => host.remove());
  shadow.querySelector("[data-action='copy']")?.addEventListener("click", () => options.onCopy?.());
  shadow.querySelector("[data-action='replace']")?.addEventListener("click", () => {
    options.onReplace?.();
    host.remove();
  });
  shadow.querySelector("[data-action='approval']")?.addEventListener("click", () => options.onApproval?.());
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char] ?? char));
}
