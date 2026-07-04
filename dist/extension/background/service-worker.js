import { SOTER_EXTENSION_VERSION } from "../packages/shared/src/constants.js";
import { SCAN_CONTEXT_MENU_ID, registerContextMenu } from "./context-menu.js";
import { browserName, sendHeartbeat } from "./heartbeat.js";
import { configurePolicySyncAlarm, syncPolicy } from "./policy-sync.js";
import { SoterExtensionApiClient } from "../lib/api-client.js";
import { domainFromUrl, scanPrompt } from "../lib/scanner.js";
import { getState, setState } from "../lib/storage.js";
import { matchAIDestination } from "../packages/shared/src/ai-destinations.js";
import { enrollFromManagedConfig, enrollWithCode } from "../lib/enrollment.js";
void initializeEnrollment();
chrome.runtime.onInstalled.addListener(() => {
    registerContextMenu();
    configurePolicySyncAlarm(15 * 60);
    chrome.alarms?.create("soter-heartbeat", { periodInMinutes: 5, delayInMinutes: 1 });
    void syncPolicy();
});
chrome.alarms?.onAlarm.addListener((alarm) => {
    if (alarm.name === "soter-policy-sync")
        void syncPolicy();
    if (alarm.name === "soter-heartbeat")
        void sendHeartbeat();
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== SCAN_CONTEXT_MENU_ID || !info.selectionText)
        return;
    void handleScan({ text: info.selectionText, url: info.pageUrl ?? tab?.url ?? "", eventType: "context_menu" }).then(async () => {
        if (tab?.id && chrome.sidePanel)
            await chrome.sidePanel.open({ tabId: tab.id });
    });
});
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isObject(message))
        return;
    if (message.type === "SOTER_SCAN_TEXT") {
        void handleScan(message).then(sendResponse);
        return true;
    }
    if (message.type === "SOTER_GET_STATE") {
        void getState().then((state) => sendResponse({ ok: true, state }));
        return true;
    }
    if (message.type === "SOTER_SET_STATE") {
        void setState(message.state ?? {}).then((state) => sendResponse({ ok: true, state }));
        return true;
    }
    if (message.type === "SOTER_REQUEST_APPROVAL") {
        void handleApproval(message.text ?? "", message.url ?? "", message.justification).then(sendResponse);
        return true;
    }
    if (message.type === "SOTER_HEARTBEAT") {
        void sendHeartbeat().then(() => sendResponse({ ok: true }));
        return true;
    }
    if (message.type === "SOTER_ENROLL") {
        void enrollWithCode(message.apiBaseUrl ?? "http://localhost:3000", message.enrollmentCode ?? "").then(async (result) => {
            if (result.ok) {
                await syncPolicy();
                await sendHeartbeat();
            }
            sendResponse({ ...result, state: await getState() });
        });
        return true;
    }
    if (message.type === "SOTER_SYNC_POLICY") {
        void syncPolicy().then(async () => sendResponse({ ok: true, state: await getState() }));
        return true;
    }
    if (message.type === "SOTER_GET_DESTINATION_CONTEXT") {
        void destinationContext(message.url ?? "").then(sendResponse);
        return true;
    }
    if (message.type === "SOTER_DISCOVER_SHADOW_AI") {
        void handleShadowAIDiscovery(message).then(sendResponse);
        return true;
    }
});
async function handleScan(request) {
    try {
        const state = await getState();
        if (!state.enabled)
            return { ok: false, message: "Soter extension is disabled." };
        const result = scanPrompt(request.text, request.url, state, request.eventType);
        await setState({ latestScan: result });
        const api = new SoterExtensionApiClient(state.config);
        const event = {
            organizationId: state.config.organizationId,
            employeeId: state.config.employeeId,
            extensionVersion: SOTER_EXTENSION_VERSION,
            browser: browserName(),
            domain: domainFromUrl(request.url),
            url: request.url,
            policyVersion: state.policy?.version ?? "unknown",
            action: result.action,
            severity: result.policy.severity,
            riskScore: result.riskScore,
            detectedDataTypes: result.detectedDataTypes,
            matchedRules: result.policy.matchedRules.map((rule) => rule.id),
            redactedPreview: result.redactedText.slice(0, 500),
            eventType: request.eventType,
            occurredAt: new Date().toISOString(),
            metadata: { findings: result.findings.map(({ type, label, severity }) => ({ type, label, severity })) },
        };
        void api.audit(event).catch(() => undefined);
        void api.scan({ text: request.text, url: request.url, result }).catch(() => undefined);
        return { ok: true, result };
    }
    catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "Scan failed." };
    }
}
async function initializeEnrollment() {
    const managed = await enrollFromManagedConfig();
    if (managed.status === "enrolled") {
        await syncPolicy();
        await sendHeartbeat();
    }
}
async function destinationContext(url) {
    const state = await getState();
    const destination = matchAIDestination(url, state.policy?.destinations ?? [], state.config.department, state.config.role);
    if (destination)
        return { active: state.enabled, destination, employeeId: state.config.employeeId, legacyMatch: true };
    const hostname = domainFromUrl(url);
    const legacyMatch = state.policy?.monitoredDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
    return { active: Boolean(state.enabled && legacyMatch), destination: undefined, employeeId: state.config.employeeId, legacyMatch };
}
async function handleShadowAIDiscovery(message) {
    try {
        const state = await getState();
        if (!state.enabled || !state.config.organizationId)
            return { ok: false, message: "Not enrolled." };
        const result = await fetch(`${state.config.apiBaseUrl}/api/extension/shadow-ai-discovered`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "x-soter-extension-token": state.config.deviceToken ?? "",
            },
            body: JSON.stringify({
                organizationId: state.config.organizationId,
                employeeId: String(message.employeeId ?? state.config.employeeId),
                domain: String(message.domain ?? ""),
                destination: String(message.destination ?? ""),
                riskLevel: String(message.riskLevel ?? "medium"),
                url: String(message.url ?? ""),
            }),
        });
        return { ok: result.ok };
    }
    catch {
        return { ok: false, message: "Shadow AI discovery failed." };
    }
}
async function handleApproval(text, url, justification) {
    const state = await getState();
    const result = scanPrompt(text, url, state);
    const response = await new SoterExtensionApiClient(state.config).requestApproval({ text, url, justification, result });
    await setState({ latestScan: result });
    return { ok: true, ...response };
}
function isObject(value) {
    return Boolean(value && typeof value === "object");
}
