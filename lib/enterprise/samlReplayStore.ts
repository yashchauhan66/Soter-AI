// Phase 6: in-memory replay protection for SAML response IDs. Production
// deployments should swap this to Redis. The interface is stable.
//
// Periodic cleanup runs every 5 minutes to avoid O(n) scans on every call.

const seen = new Map<string, number>();
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let lastCleanup = 0;

function pruneExpired(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [id, expiresAt] of seen) {
    if (expiresAt < now) seen.delete(id);
  }
}

export async function markAndCheckReplay(responseId: string): Promise<boolean> {
  pruneExpired();
  if (seen.has(responseId)) return true;
  seen.set(responseId, Date.now() + TTL_MS);
  return false;
}

export async function isReplay(responseId: string): Promise<boolean> {
  pruneExpired();
  return seen.has(responseId);
}
