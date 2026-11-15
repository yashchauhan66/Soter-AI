import { VAULT_APP_ARTIFACT_BUILTINS } from "../../../core/src/VaultAppArtifact";

/** Trusted bootstrap source. All app modules come from the approved IPC
 * snapshot; local require has no filesystem, package or global fallback.
 * This loader is not an OS sandbox for owner-approved JavaScript. */
export const VAULT_ARTIFACT_LOADER = "const artifactBuiltins = Object.freeze(" + JSON.stringify(VAULT_APP_ARTIFACT_BUILTINS) + ");\n" + String.raw`
function loadArtifact(artifact, expectedDigest) {
  if (!artifact || artifact.schemaVersion !== 1 || artifact.format !== "commonjs-snapshot-v1"
      || !Array.isArray(artifact.modules) || artifact.modules.length < 1 || artifact.modules.length > 64
      || typeof expectedDigest !== "string" || artifact.digest !== expectedDigest) throw Error();
  const payload = {schemaVersion:1, format:"commonjs-snapshot-v1", entry:artifact.entry, modules:artifact.modules};
  if (require("node:crypto").createHash("sha256").update(JSON.stringify(payload)).digest("hex") !== expectedDigest) throw Error();
  const rows = new Map(), cache = new Map();
  for (const row of artifact.modules) {
    if (!row || typeof row.path !== "string" || rows.has(row.path) || typeof row.source !== "string"
        || !Array.isArray(row.imports) || !["commonjs", "json"].includes(row.kind)) throw Error();
    const links = new Map();
    for (const link of row.imports) {
      if (!link || typeof link.specifier !== "string" || typeof link.target !== "string" || links.has(link.specifier)) throw Error();
      links.set(link.specifier, link.target);
    }
    rows.set(row.path, {kind:row.kind, source:row.source, links});
  }
  function load(id) {
    if (cache.has(id)) return cache.get(id).exports;
    const row = rows.get(id); if (!row) throw Error();
    const owned = {exports:{}}; cache.set(id, owned);
    if (row.kind === "json") { owned.exports = JSON.parse(row.source); return owned.exports; }
    const localRequire = Object.freeze(specifier => {
      if (typeof specifier !== "string" || !row.links.has(specifier)) throw Error();
      const target = row.links.get(specifier);
      if (target.startsWith("node:")) {
        if (target !== specifier || !artifactBuiltins.includes(target)) throw Error();
        return require(target);
      }
      return load(target);
    });
    const filename = "/soterai-approved-artifact/" + id;
    const dirname = filename.slice(0, filename.lastIndexOf("/"));
    const source = row.source.replace(/^#![^\r\n]*(?:\r?\n|$)/, "\n");
    const execute = new Function("exports", "require", "module", "__filename", "__dirname", source);
    try { execute.call(owned.exports, owned.exports, localRequire, owned, filename, dirname); }
    catch (error) { cache.delete(id); throw error; }
    return owned.exports;
  }
  return load(artifact.entry);
}
`;
