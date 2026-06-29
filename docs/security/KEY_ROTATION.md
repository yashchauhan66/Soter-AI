# Key Rotation & Secret Hygiene

> Action required by a human operator. Claude removed the leaked artifacts and
> hardened ignores, but **secrets that were ever stored in plaintext must be
> rotated** — deletion does not un-expose them.

## What was found & fixed in the repo

- **Deleted `cookies.txt`** — contained a live `authjs.session-token` (a valid
  signed session). Anyone with that file could resume the session until expiry.
- **Deleted `headers.txt`** — curl debug dump (response headers / set-cookie).
- **Hardened `.gitignore`** — `cookies.txt`, `headers.txt`, `*.cookies`,
  `cookies-*.txt` are now ignored so curl/debug artifacts can't be committed.
- **Verified `.env*` is gitignored** and **not** tracked by git. A source scan
  found no real API keys hardcoded in tracked files (only intentional decoy
  "canary" tokens and detector regexes).

## What you must do (cannot be automated here)

1. **Rotate the session signing secret** (`AUTH_SECRET` / `NEXTAUTH_SECRET`).
   This invalidates the leaked session token in `cookies.txt`.
   ```bash
   openssl rand -base64 32   # set as AUTH_SECRET in your host's env
   ```
2. **Rotate every key that has ever lived in plaintext `.env` / `.env.production`**,
   especially:
   - Anthropic / Claude API key (`ANTHROPIC_API_KEY`)
   - Any LLM provider keys (Groq, OpenAI, etc.)
   - Razorpay keys/secrets
   - Database connection string credentials
   - Upstash / Redis tokens
   Rotate them in each provider's dashboard, then update your host's env vars.
3. **Move secrets out of plaintext files on the server.** Prefer your platform's
   secret manager / encrypted env (Vercel/Render/Fly secrets, Docker secrets,
   or a KMS) over a committed-adjacent `.env` file.
4. **If `.env*` was ever committed historically**, scrub git history
   (`git filter-repo` or BFG) and force-push, then rotate again.

## Ongoing hygiene

- Keep using `.env.example` (no real values) as the documented template.
- Run `npm run validate-env` before deploys.
- Never `curl -c cookies.txt` / `-D headers.txt` inside the repo root; if you do,
  the new ignore rules will keep them out of git, but delete them when done.
