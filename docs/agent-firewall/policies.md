# Agent Firewall Policies

Default behavior:

- Low risk: allow browser reads, public URL opens, local RAG search, and summarization without secrets.
- Medium risk: allow or redact browser typing, workspace writes, calendar events, and allowlisted API calls.
- High risk: require approval for email sends, form submits, uploads, external API calls with user data, clipboard writes, database changes, package installs, `git push`, and payments.
- Critical risk: block dangerous terminal commands, `.env` and private-key reads, secret exfiltration, deleting user files, unknown external email sends without approval, financial transactions, credential handling, and attempts to disable safety rules.

Configurable fields:

- `allowedDomains`
- `blockedDomains`
- `allowedWorkspaceDir`
- `blockedFilePatterns`
- `toolsRequiringApproval`
- `toolsAlwaysBlocked`
- `piiMode`
- `secretsMode`
- `failClosed`
- `maxRiskWithoutApproval`

Default blocked file patterns include `.env`, `.env.*`, `*.pem`, `*.key`, `id_rsa`, `id_ed25519`, `*.p12`, `*.pfx`, `cookies.sqlite`, `Login Data`, `Local State`, `*.kdbx`, `credentials.json`, and `token.json`.

Default dangerous terminal patterns include `rm -rf`, `del /s`, `format`, `curl * | bash`, `wget * | bash`, `Invoke-WebRequest * | iex`, `cat .env`, `type .env`, `printenv`, `npm publish`, `git push --force`, `chmod 777`, `sudo`, `ssh`, `scp`, `rsync`, and `docker run --privileged`.
