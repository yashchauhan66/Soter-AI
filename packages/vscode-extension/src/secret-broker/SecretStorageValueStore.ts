import * as vscode from "vscode";
import { type SecretValueStore } from "./SecretReferenceManager";

export class SecretStorageValueStore implements SecretValueStore {
    constructor(private readonly secrets: vscode.SecretStorage, private readonly prefix = "soterai.secretBroker.") {}

    async get(id: string): Promise<string | undefined> {
        return this.secrets.get(this.prefix + id);
    }

    async set(id: string, value: string): Promise<void> {
        await this.secrets.store(this.prefix + id, value);
    }

    async delete(id: string): Promise<void> {
        await this.secrets.delete(this.prefix + id);
    }
}
