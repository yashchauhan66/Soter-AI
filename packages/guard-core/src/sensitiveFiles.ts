/**
 * The canonical set of files whose CONTENT is credential-bearing — the files
 * that must be watched, scanned on open, offered for vault migration, and
 * flagged in a diff.
 *
 * Before this module the same list existed in SIX places across the extension —
 * two as regex-against-basename, four as glob arrays — and they had drifted.
 * Each covered a slightly different set, and critically NONE of them covered an
 * agent's own credential config (`.claude/settings.json`, `.cursor/mcp.json`,
 * `.mcp.json`). That is the first file a coding agent reads and the exact file
 * that started this work: a live key sat in one, and every proactive guard
 * looked straight past it because "settings.json" was on nobody's list.
 *
 * The list is defined ONCE, as globs, and each consumer derives what it needs:
 *   - {@link SENSITIVE_FILE_GLOBS} for `createFileSystemWatcher` / `findFiles`
 *   - {@link isSensitiveFilePath} for a relative-path or basename test
 *
 * Two shapes of one truth so they cannot drift; a drift test in the extension
 * asserts no module re-declares its own copy.
 *
 * ── SCOPE, stated honestly ────────────────────────────────────────────────
 * These globs are WORKSPACE-relative. Widening them catches a *project-local*
 * `.claude/settings.json` committed into a repo. It does NOT catch the user's
 * GLOBAL `~/.claude/settings.json` — a workspace file watcher never sees it.
 * The home-directory case is covered on egress by `soterai hook`, not here.
 * This is defense-in-depth for the in-repo copy, not a second home-dir guard.
 */

/**
 * Credential-bearing file globs. `**\/` means "at any depth"; a single `*` does
 * not cross a path separator. Kept as the union of every list this replaced, so
 * no consumer loses coverage, PLUS the agent-config additions below.
 */
export const SENSITIVE_FILE_GLOBS: readonly string[] = [
    // ── Environment / dotenv ──────────────────────────────────────────────
    "**/.env",
    "**/.env.*", // .env.local, .env.production … (not .environment)
    // ── Private keys / certs ──────────────────────────────────────────────
    "**/*.pem",
    "**/*.key",
    "**/*.p12",
    "**/*.pfx",
    "**/id_rsa",
    "**/id_rsa.*",
    "**/id_ed25519",
    "**/id_ed25519.*",
    "**/.gnupg/**", // private keyrings (secring.gpg, private-keys-v1.d/…)
    // ── Package-registry auth ─────────────────────────────────────────────
    "**/.npmrc",
    "**/.pypirc",
    // ── Cloud provider credentials ────────────────────────────────────────
    "**/.aws/credentials",
    "**/.azure/**/credentials*",
    "**/.docker/config.json",
    "**/.kube/config",
    // ── Generic secret / credential bundles ───────────────────────────────
    "**/secrets.json",
    "**/secrets.yaml",
    "**/secrets.yml",
    "**/credentials.json",
    "**/credentials.yaml",
    "**/credentials.yml",
    // ── Agent credential configs (NEW — path-scoped, never a bare basename) ─
    // These hold API keys / provider URLs an agent loads at startup. Scoped to
    // their parent directory on purpose: a bare `settings.json` would match
    // every `.vscode/settings.json` and flag ordinary editor prefs.
    "**/.claude/settings.json",
    "**/.claude/settings.local.json",
    "**/.mcp.json", // Claude Code project-scoped MCP servers (often carry env creds)
    "**/.cursor/mcp.json",
    "**/.vscode/mcp.json",
    "**/.continue/config.json", // Continue stores model apiKey here
];

/**
 * One representative path per glob that the glob MUST match. Its keys are
 * asserted equal to {@link SENSITIVE_FILE_GLOBS} by the unit test, so a glob
 * cannot be added without a sample proving it matches something real.
 */
export const SENSITIVE_FILE_GLOB_SAMPLES: Readonly<Record<string, string>> = {
    "**/.env": "app/.env",
    "**/.env.*": "app/.env.production",
    "**/*.pem": "certs/server.pem",
    "**/*.key": "certs/tls.key",
    "**/*.p12": "certs/keystore.p12",
    "**/*.pfx": "certs/cert.pfx",
    "**/id_rsa": "home/.ssh/id_rsa",
    "**/id_rsa.*": "home/.ssh/id_rsa.bak",
    "**/id_ed25519": "home/.ssh/id_ed25519",
    "**/id_ed25519.*": "home/.ssh/id_ed25519.pub",
    "**/.gnupg/**": "home/.gnupg/secring.gpg",
    "**/.npmrc": "project/.npmrc",
    "**/.pypirc": "home/.pypirc",
    "**/.aws/credentials": "home/.aws/credentials",
    "**/.azure/**/credentials*": "home/.azure/accessTokens/credentials.json",
    "**/.docker/config.json": "home/.docker/config.json",
    "**/.kube/config": "home/.kube/config",
    "**/secrets.json": "config/secrets.json",
    "**/secrets.yaml": "config/secrets.yaml",
    "**/secrets.yml": "config/secrets.yml",
    "**/credentials.json": "config/credentials.json",
    "**/credentials.yaml": "config/credentials.yaml",
    "**/credentials.yml": "config/credentials.yml",
    "**/.claude/settings.json": "repo/.claude/settings.json",
    "**/.claude/settings.local.json": "repo/.claude/settings.local.json",
    "**/.mcp.json": "repo/.mcp.json",
    "**/.cursor/mcp.json": "repo/.cursor/mcp.json",
    "**/.vscode/mcp.json": "repo/.vscode/mcp.json",
    "**/.continue/config.json": "repo/.continue/config.json",
};

/**
 * Compile a VS Code-style glob to an anchored RegExp. Supports `**\/` (zero or
 * more leading segments), `**` (any run, crossing separators), `*` (a run
 * within one segment), and `?`. Everything else is matched literally. This is
 * the same semantics as the extension's LiveScanner matcher, reimplemented here
 * because guard-core is dependency-free and cannot import from the extension.
 */
function globToRegExp(glob: string): RegExp {
    const normalized = glob.replace(/\\/g, "/");
    let out = "^";
    for (let i = 0; i < normalized.length; i++) {
        const ch = normalized[i];
        if (ch === "*") {
            if (normalized[i + 1] === "*") {
                if (normalized[i + 2] === "/") {
                    out += "(?:.*/)?";
                    i += 2;
                } else {
                    out += ".*";
                    i += 1;
                }
            } else {
                out += "[^/]*";
            }
        } else if (ch === "?") {
            out += "[^/]";
        } else {
            out += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
        }
    }
    return new RegExp(`${out}$`, "i");
}

const SENSITIVE_FILE_REGEXPS: readonly RegExp[] = SENSITIVE_FILE_GLOBS.map(globToRegExp);

/**
 * True if `pathOrName` is a credential-bearing file. Accepts a workspace
 * relative path (`.claude/settings.json`, `config/secrets.yaml`) or a bare
 * basename (`.env`). Because every glob is anchored with the `**\/` "zero or
 * more leading segments" rule, a basename matches the same globs a full path
 * would — but a path-scoped entry like `.claude/settings.json` will NOT match a
 * bare `settings.json`, which is the entire reason it is path-scoped.
 *
 * Backslashes are normalized, so a Windows relative path works unchanged.
 */
export function isSensitiveFilePath(pathOrName: string): boolean {
    const normalized = pathOrName.replace(/\\/g, "/").replace(/^\.\//, "");
    return SENSITIVE_FILE_REGEXPS.some((re) => re.test(normalized));
}

/**
 * The agent-config subset, exported so a caller can explain *why* a file is
 * sensitive ("this is your agent's credential config") rather than just that it
 * is. Kept as a derived slice of the one list, not a second copy.
 */
export const AGENT_CONFIG_GLOBS: readonly string[] = SENSITIVE_FILE_GLOBS.filter(
    (g) => /\.claude\/|\.cursor\/|\.continue\/|\.mcp\.json|\.vscode\/mcp\.json/.test(g),
);
