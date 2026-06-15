import { createServer } from "http";
import { db } from "../lib/db";
import { processDueSiemDeliveries } from "../lib/siem/exporters";

const intervalMs = Math.min(60_000, Math.max(1_000, Number(process.env.SIEM_WORKER_INTERVAL_MS ?? 5_000)));
const port = Number(process.env.SIEM_WORKER_HEALTH_PORT ?? 3097);
let stopping = false;
let running = false;
let lastHeartbeat = new Date();

async function tick() {
  if (running || stopping) return;
  running = true;
  try {
    const results = await processDueSiemDeliveries(50);
    lastHeartbeat = new Date();
    console.info(
      JSON.stringify({
        level: "info",
        event: "siem.worker.tick",
        processed: results.length,
        at: lastHeartbeat.toISOString(),
      }),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "siem.worker.error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    );
  } finally {
    running = false;
  }
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
  console.info(JSON.stringify({ level: "info", event: "siem.worker.shutdown", signal }));
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await db.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
void tick();
