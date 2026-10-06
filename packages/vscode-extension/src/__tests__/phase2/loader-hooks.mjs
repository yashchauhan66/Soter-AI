/** PHASE 2 — ESM half of the `vscode` interception. See register.mjs. */
const target = new URL("./vscode-stub.ts", import.meta.url).href;

export async function resolve(specifier, context, next) {
    if (specifier === "vscode") return { url: target, format: "module", shortCircuit: true };
    return next(specifier, context);
}
