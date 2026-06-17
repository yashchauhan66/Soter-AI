# CyberRakshak CLI (`npx cyberrakshak init`)

## Status: PLANNED (not implemented in this pass)

The CLI init command is a convenience tool that was planned but not implemented to keep the integration kit focused on core SDK and example validation.

---

## Planned Behavior

When implemented, `npx cyberrakshak init` would:

1. **Detect framework** in the current directory:
   - Next.js (detects `next.config.js` or `next.config.mjs`)
   - Express (detects `express` in `package.json`)
   - Node.js (generic)
   - Python/FastAPI (detects `requirements.txt` or `pyproject.toml`)
   - Unknown

2. **Prompt for configuration:**
   - Base URL (default: `https://api.cyberrakshak.com`)
   - API key (stored in `.env`, never committed)

3. **Generate files:**
   - `.env.example` with `CYBERRAKSHAK_BASE_URL` and `CYBERRAKSHAK_API_KEY`
   - Sample integration file based on detected framework

4. **Print next steps:**
   - Copy `.env.example` to `.env`
   - Fill in API key
   - Run the app

5. **Security guarantees:**
   - Never store secrets insecurely
   - Never commit `.env`
   - Never expose API key in frontend code

---

## Why It Was Deferred

- The SDK, examples, and documentation provide clear integration paths
- Framework detection adds complexity without significant DX improvement
- The integration wizard in the dashboard already provides copy-paste snippets
- Manual setup takes < 2 minutes for most developers

---

## Future Implementation

If the CLI is needed, it would be created at `packages/cli/` with:

```
packages/cli/
├── package.json        # bin: { "cyberrakshak": "./dist/cli.js" }
├── src/
│   ├── cli.ts          # Main CLI entry point
│   ├── detect.ts       # Framework detection
│   ├── scaffold.ts     # File generation
│   └── prompts.ts      # User prompts
└── tsconfig.json
```

Dependencies: `commander`, `inquirer`, `chalk`
