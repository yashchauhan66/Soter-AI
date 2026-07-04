import { renderSidePanel } from "./SidePanelApp.js";
const root = document.getElementById("root");
if (root) {
    chrome.runtime.sendMessage({ type: "SOTER_GET_STATE" }, (response) => {
        const state = response?.state;
        if (state)
            renderSidePanel(root, state);
    });
}
