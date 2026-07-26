import { sendMessageWithTimeout } from "../lib/runtime-messaging";
import { installSourceLineageListener } from "./source-lineage-listener";
import { matchSourceApp, type SourceAppConfig } from "../lib/source-apps";

void getSourceApps().then((sourceApps) => {
  const sourceApp = matchSourceApp(location.href, sourceApps);
  if (!sourceApp) return;
  installSourceLineageListener(sourceApp);
  document.documentElement.setAttribute("data-soter-source-lineage", "true");
});

function getSourceApps() {
  return sendMessageWithTimeout<{ ok?: boolean; sourceApps?: SourceAppConfig[] }>(
    { type: "SOTER_GET_SOURCE_APPS" },
  ).then((response) => response?.sourceApps ?? []);
}
