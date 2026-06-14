// Phase 6: in-memory replay protection for SAML response IDs. Production
// deployments should swap this to Redis. The interface is stable.

const seen = new Map<string, number>();
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function markAndCheckReplay(responseId: string): Promise<boolean> {
  const now = Date.now();
  for (const [id, expiresAt] of seen) {
    if (expiresAt < now) seen.delete(id);
  }
  if (seen.has(responseId)) return true;
  seen.set(responseId, now + TTL_MS);
  return false;
}

export async function isReplay(responseId: string): Promise<boolean> {
  return seen.has(responseId);
}
