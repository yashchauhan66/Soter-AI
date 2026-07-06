# Protected Secret Vault

The vault's job: **remove raw secrets from normal workspace files** so a local
AI assistant reading those files sees placeholders, not credentials.

## How it works

1. **SoterAI: Migrate Secrets to Protected Vault** scans the open `.env`-style
   file, previews the secrets it will move (values shown masked), and asks for
   an explicit modal confirmation.
2. On confirm, it:
   - writes a `<file>.bak` backup **before** any change,
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
  workspace**, so other extensions walking the workspace never see it.
- **Encryption:** AES-256-GCM. The key is generated once and stored in VS Code
  **SecretStorage**, separate from the vault file.
- **Metadata** (id, key, type, original file, placeholder, createdAt, **hash
  only**) is all that is ever displayed. Raw values are never shown in the
  webview, logs, telemetry, ledger, or exports.

## Other commands

- **Restore Secret Placeholders** — reverses the migration for a file (writes a
  `.bak` first, requires confirmation).
- **Open Protected Vault Status** — lists vaulted entries by hash/metadata only.
- **Generate .env.example Safely** — emits keys with `<type>` hints, no values.

## Backup / restore warning

Migration and restore both write a `<file>.bak` before overwriting. Keep those
backups until you have verified the vault works for your project. Do **not**
commit `.bak` files, the vault, or `.soterai/canary.env` — add them to
`.gitignore`.

## Honest scope

The vault protects files you migrate. Files you have **not** migrated remain
readable by other extensions. This is a defense against *accidental* exposure,
not an OS-level access control. See
[ide-guard-limitations.md](ide-guard-limitations.md).
