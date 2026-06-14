import { processDueSiemDeliveries } from "../lib/siem/exporters";
const interval = Number(process.env.SIEM_WORKER_INTERVAL_MS ?? 5000);
async function tick() { await processDueSiemDeliveries().catch((error) => console.error("SIEM worker failed", error)); }
void tick();
setInterval(() => void tick(), interval);
