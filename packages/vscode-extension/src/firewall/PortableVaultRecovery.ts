import { createHash } from "node:crypto";
import { lstatSync, readdirSync } from "node:fs";
import * as path from "node:path";
import { createRecoveryEnvelope, inspectRecoveryEnvelope, openRecoveryEnvelope, RECOVERY_ENVELOPE_LIMITS } from "../../../core/src/RecoveryEnvelope";
import { VaultStorage, VAULT_LIMIT, vaultJson, vaultObject, vaultUnavailable, missing } from "./VaultStorage";

export const PORTABLE_IMPORT_JOURNAL = "vault-portable-import.json";
export const PORTABLE_IMPORT_STAGE = "vault-portable-import.enc";
export const PORTABLE_VAULT_KEY_ID = "soterai.vaultKey";
const VAULT = "soterai-vault.enc", LOCK = "vault-mutation.lock", MAX_RECORDS = 128;
const SHA = /^[a-f0-9]{64}$/;
const GENERATION = /^vault-generation-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.enc$/i;
const POINTER = /^vault-source-[a-f0-9]{32}\.json$/;
const digest = (bytes: string | Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
export interface PortableVaultRecord { readonly name: string; readonly text: string; readonly sha256: string }
interface Archive { schemaVersion: 1; records: PortableVaultRecord[] }
interface Journal { schemaVersion: 1; envelopeSha256: string; archiveSha256: string; records: Array<{ name: string; sha256: string }> }
interface SecretStore { get(key: string): Thenable<string | undefined>; store(key: string, value: string): Thenable<void> }
const allowedRecord = (name: string): boolean => name === VAULT || GENERATION.test(name) || POINTER.test(name);
const reserved = (name: string): boolean => name === VAULT || /^vault-/i.test(name) || /^write-.*\.enc$/i.test(name);
const validKey = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9+/]{43}=$/.test(value)
    && Buffer.from(value, "base64").toString("base64") === value;

/** Synchronous lease checks must also notice a journal created by another
 * VaultManager instance. An unreadable recovery marker is never treated as absent. */
export function assertNoPortableImport(directory: string): void {
    for (const name of [PORTABLE_IMPORT_JOURNAL, PORTABLE_IMPORT_STAGE]) {
        try { lstatSync(path.join(directory, name)); }
        catch (error) { if (missing(error)) continue; return vaultUnavailable(); }
        return vaultUnavailable();
    }
    try {
        const names = readdirSync(directory);
        if (names.length > 8192 || names.some(name => name.startsWith("vault-portable-"))) return vaultUnavailable();
    } catch (error) { if (!missing(error)) return vaultUnavailable(); }
}

function parseArchive(bytes: Uint8Array): Archive {
    if (bytes.byteLength < 1 || bytes.byteLength > RECOVERY_ENVELOPE_LIMITS.maxArchiveBytes) return vaultUnavailable();
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const value = vaultObject(vaultJson(text), ["schemaVersion", "records"]);
    if (value.schemaVersion !== 1 || !Array.isArray(value.records) || value.records.length < 1 || value.records.length > MAX_RECORDS) return vaultUnavailable();
    const names = new Set<string>();
    const records = value.records.map(item => {
        const record = vaultObject(item, ["name", "text", "sha256"]);
        if (typeof record.name !== "string" || !allowedRecord(record.name) || names.has(record.name.toLowerCase())
            || typeof record.text !== "string" || Buffer.byteLength(record.text) > VAULT_LIMIT
            || typeof record.sha256 !== "string" || !SHA.test(record.sha256) || digest(record.text) !== record.sha256) return vaultUnavailable();
        names.add(record.name.toLowerCase());
        return { name: record.name, text: record.text, sha256: record.sha256 };
    });
    if (!names.has(VAULT)) return vaultUnavailable();
    const archive: Archive = { schemaVersion: 1, records };
    if (JSON.stringify(archive) !== text || records.some((record, index) => index > 0 && records[index - 1].name.localeCompare(record.name) >= 0)) return vaultUnavailable();
    return archive;
}

/** All durable writes contain ciphertext or hashes/record names. No key is
 * journaled. Failed imports retain the journal and require the same envelope. */
export class PortableVaultRecovery {
    constructor(private readonly storage: VaultStorage, private readonly secrets: SecretStore,
        private readonly validate: (records: readonly PortableVaultRecord[], key: string) => Promise<void>,
        private readonly guard: () => void) {}

    private async recordNames(): Promise<string[]> {
        const names = (await this.storage.list()).filter(name => name !== LOCK && reserved(name));
        if (names.some(name => !allowedRecord(name)) || names.length > MAX_RECORDS) return vaultUnavailable();
        return names.sort((a, b) => a.localeCompare(b));
    }
    async export(passphrase: string): Promise<Uint8Array> {
        return this.storage.lock(async () => {
            this.guard(); assertNoPortableImport(this.storage.directory);
            const key = await this.secrets.get(PORTABLE_VAULT_KEY_ID); if (!validKey(key)) return vaultUnavailable();
            const names = await this.recordNames(); if (!names.includes(VAULT)) return vaultUnavailable();
            const records: PortableVaultRecord[] = [];
            for (const name of names) {
                this.guard(); const text = await this.storage.read(name); if (text === undefined) return vaultUnavailable();
                records.push({ name, text, sha256: digest(text) });
            }
            await this.validate(records, key); this.guard();
            const archive = Buffer.from(JSON.stringify({ schemaVersion: 1, records }), "utf8"), keyBytes = Buffer.from(key, "base64");
            try {
                const envelope = await createRecoveryEnvelope({ vaultKey: keyBytes, archive }, passphrase);
                this.guard(); assertNoPortableImport(this.storage.directory);
                if (await this.secrets.get(PORTABLE_VAULT_KEY_ID) !== key || JSON.stringify(await this.recordNames()) !== JSON.stringify(names)) return vaultUnavailable();
                for (const record of records) if (await this.storage.read(record.name) !== record.text) return vaultUnavailable();
                this.guard(); return envelope;
            } finally { keyBytes.fill(0); archive.fill(0); }
        });
    }

    async import(envelope: Uint8Array, passphrase: string, expectedEnvelopeSha256: string): Promise<{ status: "IMPORTED"; recordCount: number }> {
        if (!(envelope instanceof Uint8Array) || envelope.byteLength > RECOVERY_ENVELOPE_LIMITS.maxEnvelopeBytes) return vaultUnavailable();
        const copy = Buffer.from(envelope);
        if (inspectRecoveryEnvelope(copy).envelopeSha256 !== expectedEnvelopeSha256) return vaultUnavailable();
        const opened = await openRecoveryEnvelope(copy, passphrase, expectedEnvelopeSha256);
        try {
            const archive = parseArchive(opened.archive), key = Buffer.from(opened.vaultKey).toString("base64");
            await this.validate(archive.records, key); this.guard();
            const journal: Journal = { schemaVersion: 1, envelopeSha256: expectedEnvelopeSha256, archiveSha256: opened.archiveSha256,
                records: archive.records.map(({ name, sha256 }) => ({ name, sha256 })) };
            const journalText = JSON.stringify(journal), stageText = copy.toString("utf8");
            return await this.storage.lock(async () => {
                this.guard();
                const expected = new Map([...archive.records.map(record => [record.name, record.text] as [string, string]),
                    [PORTABLE_IMPORT_JOURNAL, journalText], [PORTABLE_IMPORT_STAGE, stageText]]);
                await this.storage.recoverPortableWrites(expectedEnvelopeSha256, expected);
                const previous = await this.storage.read(PORTABLE_IMPORT_JOURNAL, 32768);
                const names = (await this.storage.list()).filter(name => name !== LOCK && reserved(name));
                const installedKey = await this.secrets.get(PORTABLE_VAULT_KEY_ID);
                if (previous === undefined) {
                    if (names.length || installedKey !== undefined) return vaultUnavailable();
                    await this.storage.writePortableAtomic(PORTABLE_IMPORT_JOURNAL, journalText, expectedEnvelopeSha256);
                } else {
                    // Exact text also rejects duplicate/unknown/tampered journal fields.
                    if (previous !== journalText || installedKey !== undefined && installedKey !== key
                        || names.some(name => name !== PORTABLE_IMPORT_JOURNAL && name !== PORTABLE_IMPORT_STAGE && !archive.records.some(record => record.name === name))) return vaultUnavailable();
                }
                const stage = await this.storage.read(PORTABLE_IMPORT_STAGE, RECOVERY_ENVELOPE_LIMITS.maxEnvelopeBytes);
                if (stage !== undefined && stage !== stageText) return vaultUnavailable();
                if (stage === undefined) await this.storage.writePortableAtomic(PORTABLE_IMPORT_STAGE, stageText, expectedEnvelopeSha256, RECOVERY_ENVELOPE_LIMITS.maxEnvelopeBytes);
                for (const record of archive.records) {
                    this.guard(); if (await this.storage.read(PORTABLE_IMPORT_JOURNAL, 32768) !== journalText) return vaultUnavailable();
                    const current = await this.storage.read(record.name);
                    if (current !== undefined && current !== record.text) return vaultUnavailable();
                    if (current === undefined) await this.storage.writePortableAtomic(record.name, record.text, expectedEnvelopeSha256);
                }
                this.guard();
                const currentKey = await this.secrets.get(PORTABLE_VAULT_KEY_ID);
                if (currentKey !== undefined && currentKey !== key) return vaultUnavailable();
                if (currentKey === undefined) await this.secrets.store(PORTABLE_VAULT_KEY_ID, key);
                if (await this.secrets.get(PORTABLE_VAULT_KEY_ID) !== key) return vaultUnavailable();
                for (const record of archive.records) if (await this.storage.read(record.name) !== record.text) return vaultUnavailable();
                const expectedNames = [...archive.records.map(record => record.name), PORTABLE_IMPORT_JOURNAL, PORTABLE_IMPORT_STAGE].sort();
                if (JSON.stringify((await this.storage.list()).filter(name => name !== LOCK && reserved(name)).sort()) !== JSON.stringify(expectedNames)
                    || await this.storage.read(PORTABLE_IMPORT_JOURNAL, 32768) !== journalText) return vaultUnavailable();
                await this.validate(archive.records, key); this.guard();
                if (await this.secrets.get(PORTABLE_VAULT_KEY_ID) !== key) return vaultUnavailable();
                await this.storage.remove(PORTABLE_IMPORT_STAGE, stageText, RECOVERY_ENVELOPE_LIMITS.maxEnvelopeBytes);
                this.guard(); if (await this.secrets.get(PORTABLE_VAULT_KEY_ID) !== key) return vaultUnavailable();
                await this.storage.remove(PORTABLE_IMPORT_JOURNAL, journalText);
                return { status: "IMPORTED", recordCount: archive.records.length };
            });
        } finally { opened.vaultKey.fill(0); opened.archive.fill(0); copy.fill(0); }
    }
}
