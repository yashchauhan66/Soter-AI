import { installSourceLineageListener } from "./source-lineage-listener";
import { matchSourceApp, type SourceAppConfig } from "../lib/source-apps";

void getSourceApps().then((sourceApps) => {
  const sourceApp = matchSourceApp(location.href, sourceApps);
  if (!sourceApp) return;
  installSourceLineageListener(sourceApp);
  document.documentElement.setAttribute("data-soter-source-lineage", "true");
});

function getSourceApps() {
  return new Promise<SourceAppConfig[]>((resolve) => chrome.runtime.sendMessage(
    { type: "SOTER_GET_SOURCE_APPS" },
    (response) => resolve((response as { ok?: boolean; sourceApps?: SourceAppConfig[] })?.sourceApps ?? []),
  ));
}
