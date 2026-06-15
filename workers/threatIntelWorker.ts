import http from "http";
import { validateThreatRulePack } from "@/lib/threat-intel";

const intervalMs = Math.max(60_000, Number(process.env.THREAT_INTEL_WORKER_INTERVAL_MS ?? 300_000));
const port = Number(process.env.THREAT_INTEL_WORKER_HEALTH_PORT ?? 3097);

async function tick() {
  // Deliberately no remote auto-import. Production rule updates must be
  // uploaded, validated, approved, shadow-tested, then promoted.
  validateThreatRulePack({ name: "internal-health-check", source: "INTERNAL", rules: [] });
}

setInterval(() => void tick().catch((error) => console.error("Threat intel worker failed", error)), intervalMs);
void tick().catch((error) => console.error("Threat intel worker failed", error));

http.createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true, worker: "threat-intel" }));
}).listen(port);

