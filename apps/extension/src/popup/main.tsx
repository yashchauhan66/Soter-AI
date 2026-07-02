import { renderPopup } from "./PopupApp";
import type { ExtensionState } from "../lib/types";

const root = document.getElementById("root");
if (root) {
  chrome.runtime.sendMessage({ type: "SOTER_GET_STATE" }, (response) => {
    const state = (response as { state?: ExtensionState } | undefined)?.state;
    if (state) renderPopup(root, state);
  });
}
