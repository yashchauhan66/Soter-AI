"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLACEHOLDER_PREFIX = void 0;
exports.classifySecretType = classifySecretType;
exports.extractEnvSecrets = extractEnvSecrets;
exports.extractVaultCandidates = extractVaultCandidates;
exports.applyPlaceholders = applyPlaceholders;
exports.restorePlaceholders = restorePlaceholders;
exports.buildVaultMetadata = buildVaultMetadata;
exports.generateEnvExample = generateEnvExample;
const HashCache_1 = require("./HashCache");
const Redactor_1 = require("./Redactor");
const SecretDetector_1 = require("./detectors/SecretDetector");
/**
 * Vault (pure logic) — extracts secrets from `.env`-style content, replaces them
 * with SoterAI placeholders, and produces metadata that carries a HASH ONLY,
 * never the raw value. The encrypted store and SecretStorage key live in the
 * extension layer (VaultManager); this module is filesystem-free and unit-tested.
 *
 * Goal (honest): remove raw secrets from normal workspace files so a local AI
 * assistant reading those files sees placeholders, not credentials. This does
 * NOT stop an extension from reading a file you have not migrated.
 */
exports.PLACEHOLDER_PREFIX = "SOTERAI_PROTECTED_";
// Matches `KEY=VALUE`, `KEY = "VALUE"`, `export KEY=VALUE`. Value may be quoted.
const ENV_LINE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/;
/** Heuristic: does this key/value look like a real secret worth vaulting? */
const SECRETY_KEY = /(SECRET|TOKEN|KEY|PASSWORD|PASSWD|PWD|CREDENTIAL|API|AUTH|PRIVATE|DATABASE_URL|DB_URL|CONNECTION_STRING|DSN)/i;
function stripQuotes(v) {
    const m = /^(['"])([\s\S]*)\1$/.exec(v);
    return m ? m[2] : v;
}
/** Best-effort secret-type label from the key and value. */
function classifySecretType(key, value) {
    if (/^-----BEGIN/.test(value))
        return "private_key";
    if (/^(postgres(ql)?|mysql|mongodb(\+srv)?|redis|mssql):\/\//i.test(value))
        return "database_url";
    if (/^sk-ant-/.test(value))
        return "anthropic_key";
    if (/^sk-/.test(value))
        return "api_key";
    if (/^(AKIA|ASIA)[A-Z0-9]{16}$/.test(value))
        return "aws_access_key";
    if (/^(gh[pousr])_/.test(value))
        return "github_token";
    if (/^(sk|pk|rk)_(test|live)_/.test(value))
        return "stripe_key";
    if (/PASSWORD|PASSWD|PWD/i.test(key))
        return "password";
    if (/TOKEN/i.test(key))
        return "token";
    if (/DATABASE|DB_URL|CONNECTION|DSN/i.test(key))
        return "database_url";
    if (/SECRET/i.test(key))
        return "secret";
    if (/KEY/i.test(key))
        return "api_key";
    return "secret";
}
function isVaultWorthy(key, value) {
    if (!value)
        return false;
    // A value that already looks like our placeholder must never be re-vaulted.
    if (value.includes(exports.PLACEHOLDER_PREFIX))
        return false;
    // Obvious secret by key name, OR the value itself matches a known secret shape.
    if (SECRETY_KEY.test(key))
        return true;
    return (0, Redactor_1.containsRawSecret)(value);
}
/**
 * Extract vault candidates from `.env`-style text. Returns entries with byte
 * offsets so {@link applyPlaceholders} can replace precisely. The raw value is
 * carried on the candidate for encryption but is stripped from persisted
 * metadata by {@link buildVaultMetadata}.
 */
function extractEnvSecrets(text) {
    const candidates = [];
    const occurrenceByKey = new Map();
    let offset = 0;
    for (const line of text.split("\n")) {
        const lineStart = offset;
        offset += line.length + 1; // +1 for the split-stripped newline
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#"))
            continue;
        const m = ENV_LINE.exec(line);
        if (!m)
            continue;
        const key = m[1];
        const rawValueQuoted = m[2];
        const rawValue = stripQuotes(rawValueQuoted);
        if (!isVaultWorthy(key, rawValue))
            continue;
        // Locate the raw value's real offsets within the line (inside quotes).
        const valueIdxInLine = line.indexOf(rawValue, line.indexOf("=") + 1);
        if (valueIdxInLine < 0)
            continue;
        const start = lineStart + valueIdxInLine;
        const occurrence = (occurrenceByKey.get(key) ?? 0) + 1;
        occurrenceByKey.set(key, occurrence);
        const placeholderKey = occurrence === 1 ? key : `${key}_${occurrence}`;
        candidates.push({
            key,
            rawValue,
            type: classifySecretType(key, rawValue),
            placeholder: `[${exports.PLACEHOLDER_PREFIX}${placeholderKey}]`,
            start,
            end: start + rawValue.length,
        });
    }
    return candidates;
}
/**
 * Extract every secret shape that can be replaced without breaking its host file.
 *
 * Environment assignments keep their stable key-based placeholders. Standalone
 * credentials (tokens, URLs and private-key blocks) come from SecretDetector and
 * receive occurrence-qualified placeholders so two values of the same type can
 * always be restored independently. Assignment-shaped detector matches are
 * deliberately excluded because replacing `api_key = value` as a whole can make
 * JSON/YAML/source files invalid; the env parser already handles safe assignment
 * replacement where it can identify the value boundary precisely.
 */
function extractVaultCandidates(text) {
    const candidates = extractEnvSecrets(text);
    const occurrenceByType = new Map();
    const placeholders = new Set(candidates.map((candidate) => candidate.placeholder));
    const unsafeWholeAssignmentTypes = new Set([
        "aws_secret_key",
        "generic_api_key",
        "password_assignment",
    ]);
    const matches = (0, SecretDetector_1.detectSecrets)(text).matches
        .filter((match) => !unsafeWholeAssignmentTypes.has(match.type) &&
        Number.isInteger(match.start) &&
        Number.isInteger(match.end) &&
        match.end > match.start)
        .sort((a, b) => b.score - a.score || (b.end - b.start) - (a.end - a.start));
    for (const match of matches) {
        const overlaps = candidates.some((candidate) => match.start < candidate.end && match.end > candidate.start);
        if (overlaps)
            continue;
        const rawValue = text.slice(match.start, match.end);
        if (!rawValue || rawValue.includes(exports.PLACEHOLDER_PREFIX))
            continue;
        const type = match.type.replace(/[^A-Za-z0-9_]/g, "_").toUpperCase();
        let occurrence = (occurrenceByType.get(type) ?? 0) + 1;
        let key = `${type}_${occurrence}`;
        let placeholder = `[${exports.PLACEHOLDER_PREFIX}${key}]`;
        while (placeholders.has(placeholder)) {
            occurrence += 1;
            key = `${type}_${occurrence}`;
            placeholder = `[${exports.PLACEHOLDER_PREFIX}${key}]`;
        }
        occurrenceByType.set(type, occurrence);
        placeholders.add(placeholder);
        candidates.push({
            key,
            rawValue,
            type: match.type,
            placeholder,
            start: match.start,
            end: match.end,
        });
    }
    return candidates.sort((a, b) => a.start - b.start);
}
/**
 * Replace each candidate's raw value with its placeholder. Applied
 * right-to-left so earlier offsets stay valid.
 */
function applyPlaceholders(text, candidates) {
    let out = text;
    const ordered = [...candidates].sort((a, b) => b.start - a.start);
    for (const c of ordered) {
        out = out.slice(0, c.start) + c.placeholder + out.slice(c.end);
    }
    return out;
}
/**
 * Restore placeholders back to raw values using a map of placeholder → raw.
 * Used by `SoterAI: Restore Secret Placeholders`. The raw map is supplied by
 * the extension after decrypting the vault; it is never stored in metadata.
 */
function restorePlaceholders(text, placeholderToRaw) {
    let out = text;
    for (const [placeholder, raw] of Object.entries(placeholderToRaw)) {
        out = out.split(placeholder).join(raw);
    }
    return out;
}
/** Build persist-safe metadata (hash only — never the raw value). */
async function buildVaultMetadata(candidate, originalFile) {
    const hash = await (0, HashCache_1.hashContent)(candidate.rawValue);
    return {
        id: `vault_${candidate.key}_${hash.slice(0, 12)}`,
        key: candidate.key,
        type: candidate.type,
        originalFile,
        placeholder: candidate.placeholder,
        createdAt: new Date().toISOString(),
        hash,
    };
}
/**
 * Produce a safe `.env.example` from `.env` content: keep keys, drop every
 * value. Secret-looking keys get a `<type>` hint; other keys get an empty
 * value. Never emits a raw secret.
 */
function generateEnvExample(text) {
    const lines = [];
    for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) {
            lines.push(line);
            continue;
        }
        const m = ENV_LINE.exec(line);
        if (!m) {
            lines.push(line);
            continue;
        }
        const key = m[1];
        const rawValue = stripQuotes(m[2]);
        const hint = isVaultWorthy(key, rawValue) ? `<${classifySecretType(key, rawValue)}>` : "";
        lines.push(`${key}=${hint}`);
    }
    return lines.join("\n");
}
//# sourceMappingURL=Vault.js.map