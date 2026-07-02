# Microsoft Edge Enterprise Force Install

Soter Enterprise AI Control Plane can be deployed to Microsoft Edge with Microsoft Intune, Group Policy, or another supported enterprise management system. Non-removable deployment must use official Edge enterprise policies.

## Force Install

1. Publish the extension in Microsoft Edge Add-ons as a private enterprise extension, or host a signed CRX/update manifest.
2. Configure the Edge policy `ExtensionInstallForcelist`.
3. Add the Soter extension ID and update URL in this format:

```text
<extension-id>;<update-url>
```

4. Deploy the policy through Intune, Group Policy, or your device management platform.
5. Configure managed extension settings for:
   - `apiBaseUrl`
   - `organizationId`
   - employee identity mapping
   - department and role claims
   - device or employee token provisioning

## Prevent Removal

When `ExtensionInstallForcelist` is applied to managed Edge, users cannot remove the force-installed extension from the normal browser UI. Soter does not bypass Edge or operating system controls; removal prevention is provided by Microsoft Edge management.

For unmanaged personal devices, users retain control of their browser extensions.

## Policy Sync

The extension periodically calls:

```text
GET /api/extension/policy?organizationId=<org-id>
```

The policy bundle is cached locally so prompt scanning continues during network outages. The popup and side panel display policy sync freshness and policy version.

## Heartbeat Verification

The extension periodically posts:

```text
POST /api/extension/heartbeat
```

The heartbeat records extension version, browser, active AI domain, policy version, and last active timestamp. Admins can verify deployment health by filtering for `EXTENSION_HEARTBEAT` security events in Soter.

## Limitations

- Force install applies only to managed Edge profiles/devices.
- Soter cannot prevent removal on personal unmanaged browsers.
- The extension only activates on configured AI destinations.
- Enterprise lock mode must use Edge/Intune/Group Policy controls, not hidden persistence.
