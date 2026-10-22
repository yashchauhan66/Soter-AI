# F22g native startup diagnostics01

Observed 2026-10-21T16:37:39.017Z. Run f22g-editor-native-20261021T162958Z-e5be0083; Code1.143.0; exact VSIX98994f9cfa2b0fab026bfc7944282f2841b8cf99673ba8a3a1a17d59704db21d. Status: **activation module-load failure; native driver untested; owned closure unconfirmed**.

The owned extension-host log identifies the failure at22:00:11.443 local/16:30:11.443UTC: `Cannot find module './impl/format'`. Its require stack points to the frozen product extension.js and native-bootstrap.cjs:3:16. Renderer/exthost logs show the explicit development extension was selected and onStartupFinished activation was attempted. This replaces the earlier insufficient empty-log observation.

The emitted product bundle contains dynamic parser UMD imports for ./impl/format, ./impl/edit, ./impl/scanner and ./impl/parser at UTF16 offset692416. The top-level actual-runtime require fails before the bootstrap assigns exports.activate, so neither the driver, its error receipt nor its closeWindow handler runs. This establishes a packaged module-loading failure. The exact build correction remains a separate reviewed/tested change; it is not evidence of an editor API incompatibility.

The180second deadline expired with observedExit false, exitCode null and both output streams incomplete; signals0. Captured stdout/stderr contain drain placeholders rather than completed process output. No primary/restart result or driver-error exists in the owned root at observation. Do not promote any native check from this run.

Only the explicit synthetic profile log tree was inspected. The JSON receipt binds20log files and embeds exact UTF8 snapshots of main, renderer and extension-host diagnostic logs. Initial file metadata reported all20at0bytes; a later guarded writer refused before writing because this state changed. Actual content reads then exposed the module failure.

The existing workbench.action.closeWindow calls were inside bootstrap activation/driver handling, after the failed top-level require. No separate cooperative close receiver exists, and no safe externally reachable recovery was demonstrated. The worker remains unconfirmed in the retained closure receipt. No host launch, IPC command, process enumeration/signal, debugger, update/OS change, normal-profile read or credential-database read was performed. Only this note and its JSON receipt were created.
