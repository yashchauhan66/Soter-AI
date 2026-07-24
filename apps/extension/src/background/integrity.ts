import type { ExtensionIntegrityReport } from "../../../../packages/shared/src/audit-types";
import type { ExtensionState } from "../lib/types";

// Accessed lazily inside functions (never at module load) so importing this
// module in a non-extension context (tests, SSR) does not throw on `chrome`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function chromeApi(): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (globalThis as any).chrome;
}

/**
 * Compute a best-effort runtime self-integrity report for tamper VISIBILITY.
 * Never throws — on any failure it degrades to a "not healthy" report so the
 * server sees a signal rather than a silent gap.
 */
export async function computeIntegrityReport(state: ExtensionState): Promise<ExtensionIntegrityReport> {
  const chromeAny = chromeApi();
  const declaredHosts = declaredHostPermissions();
  let missingHostPermissions = declaredHosts.length;
  let hostPermissionsGranted = false;
  try {
    const results = await Promise.all(
      declaredHosts.map((origin) =>
        new Promise<boolean>((resolve) => {
          try {
            chromeAny.permissions.contains({ origins: [origin] }, (granted: boolean) =>
              resolve(Boolean(granted) && !chromeAny.runtime?.lastError),
            );
          } catch {
            resolve(false);
          }
        }),
      ),
    );
    missingHostPermissions = results.filter((granted) => !granted).length;
    hostPermissionsGranted = missingHostPermissions === 0;
  } catch {
    // Leave defaults: treated as degraded.
  }

  const policySignatureValid = state.policySyncStatus !== "error";
  const policyReachable = state.policySyncStatus !== "offline" && state.policySyncStatus !== "error";
  const healthy = hostPermissionsGranted && policySignatureValid && policyReachable;
  return { hostPermissionsGranted, missingHostPermissions, policySignatureValid, policyReachable, healthy };
}

function declaredHostPermissions(): string[] {
  try {
    const manifest = chromeApi().runtime.getManifest() as { host_permissions?: string[] };
    return Array.isArray(manifest.host_permissions) ? manifest.host_permissions : [];
  } catch {
    return [];
  }
}
