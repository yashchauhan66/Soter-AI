import { createServer } from "http";
import { processDuePending } from "../lib/webhooks/delivery";
import { db } from "../lib/db";

const intervalMs = Math.max(1_000, Number(process.env.WEBHOOK_WORKER_INTERVAL_MS ?? 5_000));
const port = Number(process.env.WEBHOOK_WORKER_HEALTH_PORT ?? 3099);
let stopping = false;
let running = false;
let lastHeartbeat = new Date();

async function tick() {
  if (running || stopping) return;
  running = true;
  try {
    const results = await processDuePending(50);
    lastHeartbeat = new Date();
    console.info(JSON.stringify({ level: "info", event: "webhook.worker.tick", processed: results.length, at: lastHeartbeat.toISOString() }));
  } catch (error) {
    console.error(JSON.stringify({ level: "error", event: "webhook.worker.error", message: error instanceof Error ? error.message : "Unknown error" }));
  } finally { running = false; }
}

const timer = setInterval(() => void tick(), intervalMs);
const server = createServer((_request, response) => {
  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ ok: true, lastHeartbeat: lastHeartbeat.toISOString(), stopping }));
}).listen(port, "127.0.0.1");

async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  clearInterval(timer);
  console.info(JSON.stringify({ level: "info", event: "webhook.worker.shutdown", signal }));
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await db.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
void tick();
