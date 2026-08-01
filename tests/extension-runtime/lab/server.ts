/**
 * Bounded local destination + control-plane server for the packaged-extension runtime lab.
 *
 * It plays two roles at once, both on loopback only:
 *
 *  1. The *destination* the user is submitting to. `POST /lab/model-ingest` is what the
 *     synthetic page's own send button calls, so "the block actually prevented submission"
 *     becomes an observable fact: the request is either in `received` or it is not.
 *  2. The *control plane* the extension talks to. The packaged extension ships with
 *     `https://soterai.in` as its API base, so the lab maps that hostname to itself rather
 *     than modifying the artefact — which also means every audit, scan and lineage event the
 *     extension emits lands here where it can be searched for raw prompt content.
 *
 * Everything is synthetic: one documentation-example AWS key, no real credentials, no
 * outbound network. Bodies are capped and the recording ring is bounded, so a runaway
 * extension loop cannot exhaust memory during a test run.
 */
import { createServer, type Server } from "node:https";
import type { IncomingMessage, ServerResponse } from "node:http";
import { labPolicyBundle, type LabPolicyMode } from "./policy-fixtures";

const MAX_BODY_BYTES = 512 * 1024;
const MAX_RECORDED = 500;

export interface LabRequest {
  method: string;
  path: string;
  body: string;
  at: string;
}

export interface LabServer {
  port: number;
  /** Loopback origin. The lab also reaches the same server as https://chatgpt.com/. */
  origin: string;
  received: LabRequest[];
  /** Every recorded body concatenated — what a leak search runs against. */
  allBodies(): string;
  ofPath(path: string): LabRequest[];
  setPolicyMode(mode: LabPolicyMode): void;
  policyServeCount(): number;
  /**
   * Faults in the lab's *own* request handling. Never cleared by `reset()`: a lab that 500s
   * makes the extension see a transport failure, and a transport failure is indistinguishable
   * from a healthy fail-safe. Any entry here invalidates the run.
   */
  faults(): string[];
  reset(): void;
  stop(): Promise<void>;
}

export const LAB_PAGE_MARKER = "soterai-runtime-lab";

export async function startLabServer(tls: { cert: string; key: string }): Promise<LabServer> {
  const received: LabRequest[] = [];
  const faults: string[] = [];
  let policyMode: LabPolicyMode = "block";
  let policyServed = 0;

  const server: Server = createServer({ cert: tls.cert, key: tls.key }, (request, response) => {
    void handle(request, response).catch((error: unknown) => {
      // A silent 500 here would surface inside the extension as an indistinguishable
      // "transport failure", which is exactly the signal the integrity tests must not confuse
      // with a tamper verdict. So the lab reports its own faults loudly and remembers them.
      const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      const fault = `${request.method} ${request.url} → ${detail}`;
      faults.push(fault);
      console.error(`[lab-server] ${fault}`);
      response.writeHead(500, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "lab server failure", detail }));
    });
  });

  async function handle(request: IncomingMessage, response: ServerResponse) {
    const url = new URL(request.url ?? "/", "https://lab.invalid");
    const body = await readBody(request);
    if (received.length < MAX_RECORDED) {
      received.push({ method: request.method ?? "GET", path: url.pathname, body, at: new Date().toISOString() });
    }

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/chat")) {
      return send(response, 200, "text/html; charset=utf-8", pageHtml());
    }
    if (url.pathname === "/api/extension/policy") {
      policyServed += 1;
      return sendJson(response, 200, await labPolicyBundle(policyMode));
    }
    if (url.pathname === "/api/extension/destinations") return sendJson(response, 200, { destinations: [] });
    if (url.pathname === "/api/extension/source-apps") return sendJson(response, 200, { sourceApps: [] });
    if (url.pathname === "/api/extension/fingerprint-bundle") return sendJson(response, 200, { fingerprintBundle: [] });
    if (url.pathname === "/api/extension/approval-request") {
      return sendJson(response, 200, { approvalId: "lab-approval-1", status: "PENDING" });
    }
    if (url.pathname === "/api/extension/approval-status") return sendJson(response, 200, { status: "PENDING" });
    if (url.pathname === "/api/extension/approval-claim") return sendJson(response, 200, { allowed: false });
    if (url.pathname.startsWith("/api/extension/")) return sendJson(response, 200, { ok: true });
    if (url.pathname === "/lab/model-ingest") return sendJson(response, 200, { ok: true });
    if (url.pathname === "/lab/received") return sendJson(response, 200, { received });

    return sendJson(response, 404, { error: "not found" });
  }

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  if (!port) throw new Error("Lab server did not bind a port.");

  return {
    port,
    origin: `https://127.0.0.1:${port}`,
    received,
    allBodies: () => received.map((entry) => entry.body).join("\n"),
    ofPath: (path) => received.filter((entry) => entry.path === path),
    setPolicyMode: (mode) => {
      policyMode = mode;
    },
    policyServeCount: () => policyServed,
    faults: () => [...faults],
    reset: () => {
      received.length = 0;
      policyServed = 0;
    },
    stop: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      }),
  };
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    if (request.method === "GET" || request.method === "HEAD") {
      request.resume();
      resolve("");
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", () => resolve(""));
  });
}

function send(response: ServerResponse, status: number, contentType: string, body: string) {
  response.writeHead(status, { "content-type": contentType, "cache-control": "no-store" });
  response.end(body);
}

function sendJson(response: ServerResponse, status: number, value: unknown) {
  send(response, status, "application/json", JSON.stringify(value));
}

/**
 * Synthetic AI-chat page. The DOM is only as rich as the shipped ChatGPT adapter needs
 * (`#prompt-textarea` and `[data-testid="send-button"]`), and the send handler is an ordinary
 * bubble-phase listener on the button — exactly the position a real site's handler occupies,
 * so the guard's document-level capture interception is what has to stop it.
 */
function pageHtml() {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><title>SoterAI Runtime Lab</title></head>
<body style="margin:0;font-family:system-ui;padding:24px">
  <div id="lab-marker" data-lab="${LAB_PAGE_MARKER}">SoterAI packaged-extension runtime lab</div>
  <textarea id="prompt-textarea" style="width:600px;height:160px;display:block"></textarea>
  <button data-testid="send-button" style="width:120px;height:40px;margin-top:12px">Send</button>
  <div>submitted: <span id="sent-count">0</span></div>
  <div>ingest status: <span id="ingest-status">idle</span></div>
  <script>
    (function () {
      var sent = [];
      window.__labSent = sent;
      document.querySelector("[data-testid='send-button']").addEventListener("click", function () {
        var text = document.getElementById("prompt-textarea").value;
        sent.push(text);
        document.getElementById("sent-count").textContent = String(sent.length);
        fetch("/lab/model-ingest", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ prompt: text }),
        }).then(function () {
          document.getElementById("ingest-status").textContent = "posted";
        }).catch(function () {
          document.getElementById("ingest-status").textContent = "failed";
        });
      });
    })();
  </script>
</body>
</html>`;
}
