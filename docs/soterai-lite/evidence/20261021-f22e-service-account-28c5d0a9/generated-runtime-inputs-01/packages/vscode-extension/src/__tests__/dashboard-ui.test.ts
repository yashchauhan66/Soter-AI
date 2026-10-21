import "./phase2/register.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { DashboardPanel } from "../webview/DashboardPanel";

const snapshot = {
    cloudEnabled: false,
    policyMode: "local",
    liveScanEnabled: true,
    trusted: true,
    firewall: { available: true, policyExists: false, protectedCount: 0, ledgerCount: 0, lastContext: "No recorded context" },
    broker: { available: true, running: false, url: "http://127.0.0.1:47321", safeMode: "Off", memory: "Idle", recentEvents: 0 },
};

function render(overrides: Record<string, unknown> = {}): string {
    const renderer = Object.create(DashboardPanel.prototype) as {
        _getHtmlForWebview(webview: { cspSource: string }, data: unknown): string;
    };
    return renderer._getHtmlForWebview({ cspSource: "vscode-webview://synthetic-ui-test" }, { ...snapshot, ...overrides });
}

test("dashboard distinguishes an unscanned workspace from a clean scan and shows its coverage boundary", () => {
    const unscanned = render();
    assert.match(unscanned, /No scan means no risk assessment/);
    assert.match(unscanned, /Run a scan to establish a result/);
    assert.doesNotMatch(unscanned, /Workspace Risk Score|Raw secrets sent to AI|No by default/);
    assert.match(unscanned, /independent network traffic can bypass/);
    const clean = render({ latestDecision: { riskScore: 0, decision: "allow", findings: [] } });
    assert.match(clean, /No findings in this scan/);
    assert.match(clean, /Unscanned files, unmarked private text/);
});

test("dashboard escapes finding and status metadata and rejects malformed numeric scores", () => {
    const payload = '<img src=x onerror="syntheticProbe()">';
    const html = render({
        policyMode: payload,
        latestDecision: { riskScore: payload, decision: payload, findings: [{ title: payload, reason: payload, severity: payload, category: payload, redactedEvidence: payload }] },
        broker: { ...snapshot.broker, url: payload },
        firewall: { ...snapshot.firewall, lastContext: payload },
    });
    assert.doesNotMatch(html, /<img src=x|class="pill <img/);
    assert.match(html, /&lt;img/);
    assert.match(html, />UNKNOWN<\/span>/);
    assert.match(html, /metric-value neutral">—/);
    assert.match(html, /default-src 'none'/);
    const nonce = html.match(/script-src 'nonce-([^']+)'/)?.[1];
    assert.ok(nonce);
    assert.ok(html.includes(`<script nonce="${nonce}">`));
    const script = html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)?.[1];
    assert.ok(script);
    assert.doesNotThrow(() => new Function(script), "rendered webview JavaScript must parse");
});

test("dashboard represents failed status reads as unavailable rather than missing protection", () => {
    const html = render({
        broker: { ...snapshot.broker, available: false },
        firewall: { ...snapshot.firewall, available: false },
    });
    assert.match(html, /Broker status could not be verified/);
    assert.match(html, /Policy status could not be loaded/);
    assert.match(html, /Availability is not proof of protection/);
    assert.doesNotMatch(html, /Managed AI route is stopped/);
});
