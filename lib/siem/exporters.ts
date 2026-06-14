import { db } from "../db";
import { decryptSecret, type EncryptedSecret } from "../secrets/secretStore";
import { sanitizeMetadata } from "../guard/logSafety";
import { assertPublicOutboundUrl } from "../network/outboundUrl";

export interface ExportableSecurityEvent { id: string; organizationId: string; projectId: string | null; eventType: string; severity: string; riskTypes: string[]; action: string; source: string; createdAt: Date; metadata: unknown }
export interface SiemExporter { export(event: ExportableSecurityEvent): Promise<{ status: number }> }

function safeEvent(event: ExportableSecurityEvent) { return { id: event.id, organizationId: event.organizationId, projectId: event.projectId, eventType: event.eventType, severity: event.severity, riskTypes: event.riskTypes, action: event.action, source: event.source, timestamp: event.createdAt.toISOString(), metadata: sanitizeMetadata((event.metadata && typeof event.metadata === "object" ? event.metadata : {}) as Record<string, unknown>) }; }

class HttpExporter implements SiemExporter {
  constructor(private readonly endpoint: string, private readonly headers: Record<string, string>, private readonly wrap: (event: ExportableSecurityEvent) => unknown = safeEvent) {}
  async export(event: ExportableSecurityEvent) { const endpoint = await assertPublicOutboundUrl(this.endpoint); const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json", ...this.headers }, body: JSON.stringify(this.wrap(event)), signal: AbortSignal.timeout(10_000) }); if (!response.ok) throw new Error(`SIEM endpoint returned HTTP ${response.status}.`); return { status: response.status }; }
}

export function createSiemExporter(provider: string, endpoint: string, token?: string): SiemExporter {
  if (provider === "splunk") return new HttpExporter(endpoint, token ? { authorization: `Splunk ${token}` } : {}, (event) => ({ event: safeEvent(event), sourcetype: "cyberrakshak:security", source: "cyberrakshak-guard" }));
  if (provider === "elastic") return new HttpExporter(endpoint, token ? { authorization: `ApiKey ${token}` } : {}, (event) => safeEvent(event));
  if (provider === "datadog") return new HttpExporter(endpoint, token ? { "DD-API-KEY": token } : {}, (event) => ({ ...safeEvent(event), ddsource: "cyberrakshak-guard", service: "ai-security-gateway" }));
  return new HttpExporter(endpoint, token ? { authorization: `Bearer ${token}` } : {});
}

export async function processSiemDelivery(deliveryId: string) {
  const delivery = await db.siemDelivery.findUnique({ where: { id: deliveryId }, include: { event: true, integration: true } });
  if (!delivery || delivery.status === "DELIVERED") return delivery;
  let token: string | undefined;
  if (delivery.integration.encryptedToken && delivery.integration.tokenKeyVersion) {
    const [provider, ...versionParts] = delivery.integration.tokenKeyVersion.split(":");
    token = await decryptSecret({ provider: provider as EncryptedSecret["provider"], ciphertext: delivery.integration.encryptedToken, version: versionParts.join(":"), keyVersion: versionParts.join(":"), createdAt: delivery.integration.createdAt.toISOString() });
  }
  try {
    const result = await createSiemExporter(delivery.integration.provider, delivery.integration.endpointUrl, token).export(delivery.event);
    return await db.siemDelivery.update({ where: { id: delivery.id }, data: { status: "DELIVERED", attempts: { increment: 1 }, responseCode: result.status, deliveredAt: new Date(), errorMessage: null } });
  } catch (error) {
    const attempts = delivery.attempts + 1;
    const terminal = attempts >= delivery.integration.maxAttempts;
    return db.siemDelivery.update({ where: { id: delivery.id }, data: { status: terminal ? "FAILED" : "RETRYING", attempts, errorMessage: error instanceof Error ? error.message.slice(0, 500) : "SIEM export failed.", nextAttemptAt: terminal ? null : new Date(Date.now() + Math.min(60 * 60_000, 2 ** attempts * 5_000)) } });
  }
}

export async function processDueSiemDeliveries(limit = 50) {
  const deliveries = await db.siemDelivery.findMany({ where: { status: { in: ["PENDING", "RETRYING"] }, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }] }, orderBy: { createdAt: "asc" }, take: limit, select: { id: true } });
  return Promise.all(deliveries.map((delivery) => processSiemDelivery(delivery.id)));
}
