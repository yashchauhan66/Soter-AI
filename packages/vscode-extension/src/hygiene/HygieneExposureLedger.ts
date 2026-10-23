import { createHmac, randomBytes } from "node:crypto";
import { analyzeSourceText, analyzeContainerText, analyzeTerraformText, analyzeRegistryText, analyzeServiceAccountText, analyzeCiText, analyzeEditorText, analyzeMcpText } from "./HygieneAnalysis";
import { analyzeHygieneText, hygieneReference, hygieneUnavailable, HYGIENE_KINDS, HYGIENE_PROVIDERS, HYGIENE_EXPOSURE_ACTIONS, HYGIENE_LEDGER_ASSESSMENT, type HygieneInput, type HygieneFinding, type HygieneKind, type HygieneProvider } from "./HygieneAnalysis";
interface Storage { get<T>(key: string): T | undefined; update(key: string, value: unknown): PromiseLike<void> }
interface Secrets { get(key: string): PromiseLike<string | undefined>; store(key: string, value: string): PromiseLike<void> }
export const HYGIENE_LEDGER_STATE = "soterai.lite.hygiene.exposure.v1", HYGIENE_LEDGER_KEY = "soterai.hygiene.hmacKey.v1";
export { HYGIENE_EXPOSURE_ACTIONS } from "./HygieneAnalysis";
export type HygieneExposureAction = typeof HYGIENE_EXPOSURE_ACTIONS[number];
interface Row { id: string; rootRef: string; fileRef: string; valueRef: string; provider: HygieneProvider; kind: HygieneKind; firstSeen: string; lastSeen: string; lastAction: HygieneExposureAction; observations: number }
interface State { version: 1; keyTag: string; rows: Row[] }
const assessment = HYGIENE_LEDGER_ASSESSMENT;
const hash = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v) && [Object.prototype, null].includes(Object.getPrototypeOf(v));
const exact = (v: unknown, keys: string[]): v is Record<string, unknown> => record(v) && Object.keys(v).sort().join(",") === keys.slice().sort().join(",")
    && !Object.values(Object.getOwnPropertyDescriptors(v)).some(p => p.get || p.set);
function rootValid(root: string): void { const u = new URL(root); if (typeof root !== "string" || root.length > 4096 || /[\x00-\x1f\x7f]/.test(root)
    || u.protocol !== "file:" || u.href !== root || u.host || u.search || u.hash || u.username || u.password) return hygieneUnavailable(); }
const date = (v: unknown): v is string => typeof v === "string" && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;
function validRow(value: unknown): value is Row {
    return exact(value, ["id", "rootRef", "fileRef", "valueRef", "provider", "kind", "firstSeen", "lastSeen", "lastAction", "observations"])
        && [value.id, value.rootRef, value.fileRef, value.valueRef].every(hash) && HYGIENE_PROVIDERS.includes(value.provider as HygieneProvider)
        && HYGIENE_KINDS.includes(value.kind as HygieneKind) && HYGIENE_EXPOSURE_ACTIONS.includes(value.lastAction as HygieneExposureAction)
        && date(value.firstSeen) && date(value.lastSeen) && value.firstSeen <= value.lastSeen && Number.isSafeInteger(value.observations) && (value.observations as number) > 0 && (value.observations as number) <= 1000000;
}
function validFinding(value: unknown): value is HygieneFinding {
    return exact(value, ["id", "fileRef", "valueRef", "line", "kind", "provider", "suggestions"]) && [value.id, value.fileRef, value.valueRef].every(hash)
        && HYGIENE_PROVIDERS.includes(value.provider as HygieneProvider) && HYGIENE_KINDS.includes(value.kind as HygieneKind)
        && Number.isSafeInteger(value.line) && (value.line as number) > 0 && (value.line as number) <= 65536
        && Array.isArray(value.suggestions) && value.suggestions.length <= 4 && value.suggestions.every(s => ["review-vault", "move-to-owner-secret-store", "env-example", "rotation-checklist"].includes(s));
}
/** Metadata only. The profile key never enters state/export, and original
 * values are consumed only by bounded private local analysis. */
export class HygieneExposureLedger {
    static #tails = new WeakMap<object, Promise<unknown>>();
    constructor(private readonly storage: Storage, private readonly secrets: Secrets) {}
    async #run<T>(operation: () => Promise<T>): Promise<T> {
        const before = HygieneExposureLedger.#tails.get(this.storage) ?? Promise.resolve(), result = before.then(operation);
        HygieneExposureLedger.#tails.set(this.storage, result.then(() => undefined, () => undefined));
        try { return await result; } catch { return hygieneUnavailable(); }
    }
    async #load(create: boolean): Promise<{ state?: State; key?: Buffer; encodedKey?: string }> {
        const raw = this.storage.get<unknown>(HYGIENE_LEDGER_STATE);
        if (raw !== undefined && (!exact(raw, ["version", "keyTag", "rows"]) || raw.version !== 1 || !hash(raw.keyTag) || !Array.isArray(raw.rows)
            || raw.rows.length > 256 || !raw.rows.every(validRow) || new Set(raw.rows.map(r => r.id)).size !== raw.rows.length || Buffer.byteLength(JSON.stringify(raw)) > 131072)) return hygieneUnavailable();
        let encoded = await this.secrets.get(HYGIENE_LEDGER_KEY);
        if (encoded === undefined && create && raw === undefined) { encoded = randomBytes(32).toString("base64"); await this.secrets.store(HYGIENE_LEDGER_KEY, encoded); }
        if (encoded === undefined) { if (raw !== undefined) return hygieneUnavailable(); return {}; }
        if (!/^[A-Za-z0-9+/]{43}=$/.test(encoded) || Buffer.from(encoded, "base64").length !== 32 || Buffer.from(encoded, "base64").toString("base64") !== encoded
            || await this.secrets.get(HYGIENE_LEDGER_KEY) !== encoded) return hygieneUnavailable();
        const key = Buffer.from(encoded, "base64"), state = raw as unknown as State | undefined;
        if (state && state.keyTag !== hygieneReference(key, "ledger-key-tag", "v1")) return hygieneUnavailable();
        return { state: state && { ...state, rows: state.rows.map(r => ({ ...r })) }, key, encodedKey: encoded };
    }
    analyze(root: string, input: HygieneInput) {
        return this.#run(async () => { rootValid(root); const { key } = await this.#load(true); if (!key) return hygieneUnavailable();
            const scopedKey = createHmac("sha256", key).update("analysis-root\0" + root).digest(); return analyzeHygieneText(input, scopedKey); });
    }
    /** Private controller capability. It keeps analysis synchronous inside the
     * vault's fresh-file callback; no key or original enters a command result. */
    createAnalyzer(root: string, domain?: "history-v1") {
        return this.#run(async () => {
            if (domain !== undefined && domain !== "history-v1") return hygieneUnavailable();
            rootValid(root); const loaded = await this.#load(true); if (!loaded.key || !loaded.encodedKey) return hygieneUnavailable();
            let scopedKey = createHmac("sha256", loaded.key).update("analysis-root\0" + root).digest();
            if (domain === "history-v1") { const current = scopedKey; scopedKey = createHmac("sha256", current).update("analysis-domain\0history-v1").digest(); current.fill(0); }
            let alive = true, encoded: string | undefined = loaded.encodedKey;
            const dispose = () => { alive = false; encoded = undefined; scopedKey.fill(0); };
            return Object.freeze({
                analyze: (input: HygieneInput) => { if (!alive) return hygieneUnavailable(); return analyzeHygieneText(input, scopedKey); },
                analyzeSource: (input: HygieneInput) => { if (!alive) return hygieneUnavailable(); return analyzeSourceText(input, scopedKey); },
                analyzeContainer: (input: HygieneInput) => { if (!alive) return hygieneUnavailable(); return analyzeContainerText(input, scopedKey); },
                analyzeTerraform: (input: HygieneInput) => { if (!alive) return hygieneUnavailable(); return analyzeTerraformText(input, scopedKey); },
                analyzeMcp: (input: HygieneInput) => { if (!alive) return hygieneUnavailable(); return analyzeMcpText(input, scopedKey); },
                analyzeEditor: (input: HygieneInput) => { if (!alive) return hygieneUnavailable(); return analyzeEditorText(input, scopedKey); },
                analyzeCi: (input: HygieneInput) => { if (!alive) return hygieneUnavailable(); return analyzeCiText(input, scopedKey); },
                analyzeServiceAccount: (input: HygieneInput) => { if (!alive) return hygieneUnavailable(); return analyzeServiceAccountText(input, scopedKey); },
                analyzeRegistry: (input: HygieneInput) => { if (!alive) return hygieneUnavailable(); return analyzeRegistryText(input, scopedKey); },
                current: async () => { try { if (!alive || !encoded || await this.secrets.get(HYGIENE_LEDGER_KEY) !== encoded) { dispose(); return false; } return true; } catch { dispose(); return false; } },
                dispose,
            });
        });
    }
    record(root: string, findings: readonly HygieneFinding[], action: HygieneExposureAction) {
        return this.#run(async () => {
            rootValid(root); if (!Array.isArray(findings) || findings.length > 256 || !findings.every(validFinding) || !HYGIENE_EXPOSURE_ACTIONS.includes(action)) return hygieneUnavailable();
            const { key, state, encodedKey } = await this.#load(false); if (!key) { if (findings.length) return hygieneUnavailable(); return this.#view(undefined, undefined); }
            const rootRef = hygieneReference(key, "root", root), now = new Date().toISOString(), rows = state?.rows ?? [];
            for (const f of findings) {
                const id = hygieneReference(key, "ledger-row", JSON.stringify([rootRef, f.fileRef, f.valueRef, f.kind]));
                const current = rows.find(r => r.id === id);
                if (current) { if (current.observations >= 1000000 || current.provider !== f.provider || now < current.lastSeen) return hygieneUnavailable(); current.lastSeen = now; current.lastAction = action; current.observations++; }
                else { if (rows.length >= 256) return hygieneUnavailable(); rows.push({ id, rootRef, fileRef: f.fileRef, valueRef: f.valueRef, provider: f.provider, kind: f.kind, firstSeen: now, lastSeen: now, lastAction: action, observations: 1 }); }
            }
            const next: State = { version: 1, keyTag: hygieneReference(key, "ledger-key-tag", "v1"), rows };
            if (Buffer.byteLength(JSON.stringify(next)) > 131072 || await this.secrets.get(HYGIENE_LEDGER_KEY) !== encodedKey) return hygieneUnavailable();
            if (findings.length) await this.storage.update(HYGIENE_LEDGER_STATE, next);
            if (await this.secrets.get(HYGIENE_LEDGER_KEY) !== encodedKey) return hygieneUnavailable();
            return this.#view(next, rootRef);
        });
    }
    #view(state: State | undefined, rootRef: string | undefined) {
        return Object.freeze({ version: 1 as const, assessment, rows: Object.freeze((state?.rows.filter(r => r.rootRef === rootRef) ?? []).map(r => Object.freeze({ ...r }))) });
    }
    view(root: string) { return this.#run(async () => { rootValid(root); const { key, state } = await this.#load(false); return this.#view(state, key ? hygieneReference(key, "root", root) : undefined); }); }
}
