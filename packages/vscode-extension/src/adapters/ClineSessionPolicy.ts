import { createHash } from "node:crypto";
import { types } from "node:util";

export interface ClineSessionSelection { readonly fingerprint: string; readonly model: string }

/** Bind the pinned vendor's persisted selectors, not a claim about its cached tasks or network. */
export function clineSessionSelection(state: unknown): ClineSessionSelection | undefined {
    try {
        if (!state || typeof state !== "object" || types.isProxy(state) || ![Object.prototype, null].includes(Object.getPrototypeOf(state))) return;
        const fields = Object.getOwnPropertyDescriptors(state);
        const value = (key: string) => {
            const field = fields[key];
            if (field && !("value" in field)) throw Error("Unsupported selection");
            return field?.value;
        };
        if (value("planModeApiProvider") !== "openai" || value("actModeApiProvider") !== "openai") return;
        const model = value("planModeOpenAiModelId");
        if (typeof model !== "string" || !model.trim() || model.length > 256 || /[\x00-\x1f\x7f]/.test(model)
            || value("actModeOpenAiModelId") !== model || !["plan", "act"].includes(value("mode"))) return;
        // These pinned vendor capabilities create additional task/provider contexts.
        // They need independent native coverage before this session can admit them.
        for (const key of ["subagentsEnabled", "cloudSessionsEnabled", "worktreesEnabled"]) {
            if (value(key) !== undefined && value(key) !== false) return;
        }
        if (value("planActSeparateModelsSetting") !== undefined && typeof value("planActSeparateModelsSetting") !== "boolean") return;
        let nodes = 0;
        const copy = (input: unknown, depth: number): unknown => {
            if (++nodes > 4096 || depth > 16) throw Error("Selection limit");
            if (input === null || typeof input === "boolean" || typeof input === "string") return input;
            if (typeof input === "number" && Number.isFinite(input)) return input;
            if (!input || typeof input !== "object" || types.isProxy(input)
                || ![Object.prototype, Array.prototype, null].includes(Object.getPrototypeOf(input)) || Object.getOwnPropertySymbols(input).length) throw Error("Unsupported selection");
            const items = Object.getOwnPropertyDescriptors(input);
            if (Array.isArray(input)) {
                if (input.length > 4096 || Object.keys(items).length !== input.length + 1) throw Error("Unsupported selection");
                return Array.from({ length: input.length }, (_, index) => {
                    const item = items[index]; if (!item || !("value" in item)) throw Error("Unsupported selection");
                    return copy(item.value, depth + 1);
                });
            }
            return Object.fromEntries(Object.keys(items).sort().map(key => {
                if (!("value" in items[key])) throw Error("Unsupported selection");
                return [key, copy(items[key].value, depth + 1)];
            }));
        };
        const selected = Object.fromEntries(Object.keys(fields).sort().filter(key => /^(?:planMode|actMode|openAi)/.test(key)
            || ["mode", "planActSeparateModelsSetting", "subagentsEnabled", "cloudSessionsEnabled", "worktreesEnabled"].includes(key))
            .map(key => [key, copy(value(key), 0)]));
        const canonical = JSON.stringify(selected);
        if (Buffer.byteLength(canonical) > 262144) return;
        return Object.freeze({ fingerprint: createHash("sha256").update(canonical).digest("hex"), model });
    } catch { return; }
}
