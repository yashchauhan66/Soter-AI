import { createServer } from "http";
import { db } from "../lib/db";
import { processOneBackgroundJob } from "../lib/backgroundJobProcessors";

const intervalMs = Math.max(1_000, Number(process.env.BACKGROUND_WORKER_INTERVAL_MS ?? 5_000));
const port = Number(process.env.BACKGROUND_WORKER_HEALTH_PORT ?? 3098);
let stopping = false;
let running = false;
let lastHeartbeat = new Date();

async function tick() {
  if (running || stopping) return;
  running = true;
  try {
    let processed = 0;
    for (let index = 0; index < 10; index += 1) {
      const result = await processOneBackgroundJob();
      if (!result) break;
      processed += 1;
    }
    lastHeartbeat = new Date();
    console.info(JSON.stringify({ level: "info", event: "background.worker.tick", processed, at: lastHeartbeat.toISOString() }));
  } catch (error) {
    console.error(JSON.stringify({ level: "error", event: "background.worker.error", message: error instanceof Error ? error.message : "Unknown error" }));
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
  console.info(JSON.stringify({ level: "info", event: "background.worker.shutdown", signal }));
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await db.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
void tick();
