/**
 * Fleet Inventory — Gap-1 closure
 *
 * Aggregates Shadow-AI scan records into an *estate-wide fingerprint view*:
 * which AI providers, models, and MCP-ish surfaces were observed, from where,
 * last-seen, and the policy state applied. This is the "whole-estate table" a
 * security lead uses instead of reading raw scan output.
 *
 * Built on lib/shadow-ai — this layer only *aggregates and fingerprints*; it
 * does not scan. All values are derived from existing scan records.
 *
 * Raw API keys/secrets are NEVER present here (shadow-ai already redacts).
 */

import { getShadowAiSummary, assessProviderRisk } from "../shadow-ai";

export type FleetRisk = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface FleetEntry {
  /** Stable fingerprint — deterministic, so the same asset dedupes across scans */
  fingerprint: string;
  /** What was seen */
  kind: "provider" | "mcp-server" | "sdk" | "tool" | "model";
  /** Human name e.g. "OpenAI" or "gpt-4o" */
  displayName: string;
  /** Risk tier from shadow-ai assessProviderRisk / governance */
  risk: FleetRisk;
  /** Where in the fleet it was seen (scan ids / surface labels) */
  locations: string[];
  /** Latest time any scan observed it */
  lastSeenAt: string | null;
  /** Number of observations aggregated into this row */
  seenCount: number;
  /** Applied governance state at last observation */
  policyState: "ALLOWED" | "BLOCKED" | "REVIEW" | "UNKNOWN";
  /** Provider-type if kind === "provider" (CLOUD/OPEN_SOURCE/…) */
  providerType?: string;
}

export interface FleetInventory {
  organizationId: string;
  generatedAt: string;
  totalAssets: number;
  byRisk: Record<FleetRisk, number>;
  byKind: Record<FleetEntry["kind"], number>;
  entries: FleetEntry[];
}

function normalizeRisk(r: string | null | undefined): FleetRisk {
  const up = (r ?? "MEDIUM").toUpperCase();
  return (["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).includes(up as FleetRisk)
    ? (up as FleetRisk)
    : "MEDIUM";
}

// Deterministic 53-bit fingerprint — stable across scans for the same asset.
function fingerprintOf(parts: Array<string | null | undefined>): string {
  const s = parts.filter(Boolean).join("::");
  let h1 = 0xdeadbeef >>> 0;
  let h2 = 0x41c6ce57 >>> 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761) >>> 0;
    h2 = Math.imul(h2 ^ ch, 1597334677) >>> 0;
  }
  h1 = (Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)) >>> 0;
  h2 = (Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)) >>> 0;
  return (h2 * 0x100000000 + h1).toString(16);
}

/** Is this provider record an MCP-ish surface? Heuristic from name/type. */
function looksLikeMcp(name: string | null | undefined, type: string | null | undefined): boolean {
  const s = `${name ?? ""} ${type ?? ""}`.toLowerCase();
  return /(mcp|model-context-protocol|tool-server|connector)/.test(s);
}

export async function buildFleetInventory(organizationId: string): Promise<FleetInventory> {
  const summary = await getShadowAiSummary(organizationId);
  const entriesMap = new Map<string, FleetEntry>();

  const push = (
    kind: FleetEntry["kind"],
    displayName: string,
    opts: Partial<Pick<FleetEntry, "risk" | "locations" | "lastSeenAt" | "policyState" | "providerType">> = {},
  ) => {
    const locations = opts.locations ?? [];
    const fp = fingerprintOf([kind, displayName, ...locations]);
    const lastSeen = opts.lastSeenAt ?? null;
    const existing = entriesMap.get(fp);
    if (existing) {
      existing.seenCount += 1;
      if (lastSeen && (!existing.lastSeenAt || lastSeen > existing.lastSeenAt)) existing.lastSeenAt = lastSeen;
      existing.risk = opts.risk ? normalizeRisk(opts.risk) : existing.risk;
      existing.policyState = (opts.policyState ?? existing.policyState) as FleetEntry["policyState"];
      for (const l of locations) if (!existing.locations.includes(l)) existing.locations.push(l);
    } else {
      entriesMap.set(fp, {
        fingerprint: fp,
        kind,
        displayName,
        risk: normalizeRisk(opts.risk ?? null),
        locations: [...locations],
        lastSeenAt: lastSeen,
        seenCount: 1,
        policyState: (opts.policyState ?? "UNKNOWN") as FleetEntry["policyState"],
        providerType: opts.providerType,
      });
    }
  };

  // Providers → fleet entries (providers also carry risk/type from shadow-ai)
  for (const p of summary.providers) {
    const riskStr = assessProviderRisk(p.providerType ?? "CLOUD", p.dataRegion ?? "US");
    const isMcp = looksLikeMcp(p.name, p.providerType);
    push(
      isMcp ? "mcp-server" : "provider",
      p.name,
      {
        risk: normalizeRisk(riskStr),
        locations: ["shadow-ai"],
        policyState: "UNKNOWN",
        providerType: p.providerType,
        lastSeenAt: null, // scans hold timing; aggregated here from scan count
      },
    );
  }

  // Models → fleet entries
  for (const m of summary.models) {
    push("model", m.name, {
      risk: "MEDIUM",
      locations: ["shadow-ai"],
      policyState: "UNKNOWN",
      lastSeenAt: null,
    });
  }

  // Scan records → seen-count evidence on providers they touched + location signal
  for (const scan of summary.scans) {
    const location = `scan:${scan.scanType}`;
    // Each scan that found providers increases the "seen" strength of those rows.
    // We attach location to every provider so the row reflects where it surfaced.
    for (const p of summary.providers) {
      const fp = fingerprintOf([looksLikeMcp(p.name, p.providerType) ? "mcp-server" : "provider", p.name, "shadow-ai"]);
      const existing = entriesMap.get(fp);
      if (existing) {
        if (!existing.locations.includes(location)) existing.locations.push(location);
        // Use scan recency as last-seen evidence.
        const sc = scan.createdAt instanceof Date ? scan.createdAt.toISOString() : null;
        if (sc && (!existing.lastSeenAt || sc > existing.lastSeenAt)) existing.lastSeenAt = sc;
      }
    }
  }

  const entries = [...entriesMap.values()].sort((a, b) => {
    const order: Record<FleetRisk, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    if (a.risk !== b.risk) return order[a.risk] - order[b.risk];
    return b.seenCount - a.seenCount;
  });

  const byRisk: Record<FleetRisk, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  const byKind: FleetInventory["byKind"] = { provider: 0, "mcp-server": 0, sdk: 0, tool: 0, model: 0 };
  for (const e of entries) {
    byRisk[e.risk]++;
    byKind[e.kind]++;
  }

  return {
    organizationId,
    generatedAt: new Date().toISOString(),
    totalAssets: entries.length,
    byRisk,
    byKind,
    entries,
  };
}
