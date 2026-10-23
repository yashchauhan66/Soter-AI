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
export declare const SENSITIVE_FILE_GLOBS: readonly string[];
/**
 * One representative path per glob that the glob MUST match. Its keys are
 * asserted equal to {@link SENSITIVE_FILE_GLOBS} by the unit test, so a glob
 * cannot be added without a sample proving it matches something real.
 */
export declare const SENSITIVE_FILE_GLOB_SAMPLES: Readonly<Record<string, string>>;
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
export declare function isSensitiveFilePath(pathOrName: string): boolean;
/**
 * The agent-config subset, exported so a caller can explain *why* a file is
 * sensitive ("this is your agent's credential config") rather than just that it
 * is. Kept as a derived slice of the one list, not a second copy.
 */
export declare const AGENT_CONFIG_GLOBS: readonly string[];
//# sourceMappingURL=sensitiveFiles.d.ts.map