# Protected Secret Vault

The vault moves reviewed recognized values out of changed workspace files and
replaces those values with placeholders. This reduces accidental exposure in
those versions of those files. It does not isolate keys or plaintext from the
same-user adversary, other copies, history, open buffers or runtime injection.

## How it works

1. **SoterAI: Migrate Secrets to Protected Vault** scans the open `.env`-style
   file, previews the secrets it will move (values shown masked), and asks for
   an explicit modal confirmation.
2. On confirm, it:
   - writes an encrypted backup outside the workspace **before** any change,
   - replaces each raw value with a placeholder `[SOTERAI_PROTECTED_<KEY>]`,
   - stores the real value **encrypted** in the vault.

```
# before  (.env.production)
DATABASE_URL=postgresql://user:password@host/prod
OPENAI_API_KEY=sk-live-...

# after
DATABASE_URL=[SOTERAI_PROTECTED_DATABASE_URL]
OPENAI_API_KEY=[SOTERAI_PROTECTED_OPENAI_API_KEY]
```

## Where secrets live

- **Encrypted vault file:** `globalStorageUri/soterai-vault.enc` — **outside the
  workspace**. Workspace relocation is not an OS access-control boundary.
- **Encryption:** AES-256-GCM. The key is generated once and stored in VS Code
  **SecretStorage**, separate from the vault file.
- **Status metadata** includes id, key, type, original file, placeholder,
  creation time and hash. Supported vault views use masked values/metadata;
  this does not prove absence of raw values in every process or storage path.

## Other commands

- **Restore Secret Placeholders** — reverses the migration for a file (writes a
  fresh encrypted backup outside the workspace first, requires confirmation).
  Restoring writes plaintext to the destination file again.
- **Open Protected Vault Status** — lists vaulted entries by hash/metadata only.
- **Generate .env.example Safely** — emits keys with `<type>` hints, no values.

## Backup / restore warning

Migration and restore write encrypted backups under extension global storage
before overwriting. Existing historical plaintext `.bak` files are not removed
by that operation and remain a separate exposure. Do not commit recovery
artifacts or real secret material. Ignoring a file in Git does not stop another
process reading it.

## Honest scope

The vault transforms selected values; it does not protect every asset under the
same-user threat model. Credential use, key custody, copies/history, UI access
and lifecycle durability remain separately **UNTESTED**. Full G1–G6 stays
**BLOCKED**, and separate-account deployment stays **DEFERRED**. See
[ide-guard-limitations.md](ide-guard-limitations.md).

Source review: [VaultManager](../packages/vscode-extension/src/firewall/VaultManager.ts),
2026-10-10. No vault/credential values were inspected for this document.
