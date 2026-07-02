# Chrome Enterprise Force Install

Soter Enterprise AI Control Plane can be deployed to managed Chrome browsers with standard Chrome Enterprise policies. The extension does not try to make itself persistent; non-removable deployment must be enforced by the browser management layer.

## Force Install

1. Package and publish the extension through the Chrome Web Store private listing flow, or host a signed CRX on an enterprise update URL.
2. In Google Admin Console, open **Devices > Chrome > Apps & extensions > Users & browsers**.
3. Add the Soter extension by Chrome Web Store ID or custom update URL.
4. Set the installation policy to **Force install**.
5. Scope the policy to the required organizational units or groups.
6. Add managed storage values for:
   - `apiBaseUrl`
   - `organizationId`
   - `employeeId` or identity mapping source
   - `department`
   - `role`
   - device or employee token provisioning

## Prevent Removal

On managed Chrome profiles and managed ChromeOS/Windows/macOS devices, **Force install** prevents normal users from removing the extension through the browser UI. Admins should also block developer mode for standard users if the organization requires stricter browser controls.

Soter does not bypass Chrome security controls and does not use malware-like persistence. Users on unmanaged personal browsers can remove extensions they installed themselves.

## Policy Sync

The extension syncs policy from:

```text
GET /api/extension/policy?organizationId=<org-id>
```

The returned policy bundle includes a version and optional signature field. The extension caches the latest valid policy locally and continues to enforce it offline. If policy sync fails, the popup shows an offline/stale status.

## Heartbeat Verification

The extension sends heartbeat events to:

```text
POST /api/extension/heartbeat
```

Each heartbeat includes extension version, browser, domain, policy version, and last active timestamp. In the Soter admin dashboard, filter security events for `EXTENSION_HEARTBEAT` to verify active managed installs.

## Limitations

- Force install works only on managed Chrome users/devices.
- Personal and unmanaged devices cannot be made non-removable by Soter.
- The extension activates only on configured AI domains such as ChatGPT, Claude, Gemini, Perplexity, and Poe.
- Soter does not monitor unrelated personal browsing.
