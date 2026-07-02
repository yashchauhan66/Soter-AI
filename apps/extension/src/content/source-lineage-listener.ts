import { createLineageContext, saveLineageContext } from "../lib/lineage-context";
import type { SourceAppConfig } from "../lib/source-apps";

export function installSourceLineageListener(sourceApp: SourceAppConfig) {
  const capture = async () => {
    const selected = window.getSelection()?.toString() ?? "";
    if (!selected.trim()) return;
    const context = await createLineageContext(sourceApp, selected, location.href, document.title);
    await saveLineageContext(context);
  };

  document.addEventListener("copy", () => void capture(), true);
  document.addEventListener("selectionchange", debounce(() => void capture(), 800), true);
}

function debounce(callback: () => void, waitMs: number) {
  let handle: number | undefined;
  return () => {
    if (handle) window.clearTimeout(handle);
    handle = window.setTimeout(callback, waitMs);
  };
}
