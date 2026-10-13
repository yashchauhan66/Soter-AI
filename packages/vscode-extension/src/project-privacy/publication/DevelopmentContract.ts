/** Finite synthetic presets. No value from the source environment is accepted. */
export const SYNTHETIC_PRESETS = {
    text: "SOTERAI_SYNTHETIC_VALUE",
    integer: "3000",
    boolean: "false",
    "loopback-url": "http://127.0.0.1:3000/synthetic-only",
    "loopback-database": "postgresql://soterai_fixture:soterai_fixture@127.0.0.1:5432/soterai_fixture",
    empty: "",
} as const;
export type SyntheticPreset = keyof typeof SYNTHETIC_PRESETS;
export interface SyntheticField { readonly name: string; readonly preset: SyntheticPreset }
export interface DevelopmentContract { readonly format: "soterai-development-contract-v1";
    readonly syntheticOnly: true; readonly automaticExecution: false; readonly fields: readonly SyntheticField[];
    readonly limitations: readonly string[] }

export function developmentContract(fields: readonly SyntheticField[]): DevelopmentContract {
    if (fields.length > 256) throw new Error("Too many synthetic fields.");
    const names = new Set<string>();
    const validated = fields.map(field => {
        if (typeof field.name !== "string" || !/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(field.name)
            || !Object.prototype.hasOwnProperty.call(SYNTHETIC_PRESETS, field.preset)
            || names.has(field.name)) throw new Error("Invalid synthetic field contract.");
        names.add(field.name);
        return Object.freeze({ name: field.name, preset: field.preset });
    });
    return Object.freeze({ format: "soterai-development-contract-v1", syntheticOnly: true,
        automaticExecution: false, fields: Object.freeze(validated), limitations: Object.freeze([
            "Examples only: no application, database, container, secret injection or network connection is started.",
            "Loopback services are not created. An application-specific adapter and synthetic runtime are still needed.",
            "No filesystem, process, IDE or network isolation is provided.",
        ]) });
}

export function syntheticEnvironment(contract: DevelopmentContract): string {
    const validated = developmentContract(contract.fields);
    return "# Synthetic development examples only; no original values.\n"
        + validated.fields.map(field => `${field.name}=${SYNTHETIC_PRESETS[field.preset]}`).join("\n") + "\n";
}

/** Fixed heuristic examples from approved names only; no original values, services or credentials. */
export function localDevelopmentFields(approvedNames: readonly string[]): SyntheticField[] {
    const fields = approvedNames.map(name => ({ name, preset: (name === "PORT" ? "integer"
        : name === "DATABASE_URL" ? "loopback-database" : /_URL$/.test(name) ? "loopback-url" : "text") as SyntheticPreset }));
    developmentContract(fields);
    return fields;
}

export function syntheticFixture(): string {
    return JSON.stringify({ syntheticOnly: true, users: [{ id: "fixture-user-1",
        displayName: "Synthetic Developer", email: "fixture@example.invalid" }] }, null, 2) + "\n";
}
