import { randomUUID } from "node:crypto";
/** No payload/registry values cross this channel: only owned session challenges. */
export function createGatewayParentGuard(session: string | undefined, channel: Pick<NodeJS.Process, "on" | "send" | "connected"> = process): (generation: string) => Promise<boolean> {
    const pending = new Map<string, (allowed: boolean) => void>();
    channel.on("message", (message: unknown) => {
        if (!message || typeof message !== "object" || Array.isArray(message)) return;
        const row = message as Record<string, unknown>;
        if (Object.keys(row).sort().join(",") !== "allowed,id,session,type,version" || row.type !== "SOTERAI_GATEWAY_GUARD_RESPONSE" || row.version !== 1 || row.session !== session || typeof row.id !== "string" || typeof row.allowed !== "boolean") return;
        pending.get(row.id)?.(row.allowed);
    });
    channel.on("disconnect", () => { for (const complete of [...pending.values()]) complete(false); });
    return generation => new Promise(resolve => {
        if (!session || !channel.connected || !channel.send || pending.size >= 32) { resolve(false);return; }
        const id = randomUUID();
        const complete = (allowed: boolean) => { if (!pending.delete(id)) return;clearTimeout(timer);resolve(allowed); };
        const timer = setTimeout(() => complete(false), 1000);pending.set(id, complete);
        try { channel.send({ type: "SOTERAI_GATEWAY_GUARD_REQUEST", version: 1, session, id, generation }, (error: Error | null) => { if (error) complete(false); }); } catch { complete(false); }
    });
}
