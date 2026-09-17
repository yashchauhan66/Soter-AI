/**
 * The high-risk secret vocabulary, shared verbatim between guard-core (which
 * emits these names as scan categories) and every consumer that has to make a
 * policy decision from a `ScanResponse` — most importantly `soterai hook`.
 *
 * Why this list exists at all: a scan result is not self-describing. Measured
 * against the live scanner, the two obvious signals both fail:
 *
 *   - `safe` is computed on the REDACTED copy, so it is `true` even for a
 *     request carrying a live API key. It says nothing about the input.
 *   - `redacted` is `true` for a bare email address or a phone number, so
 *     keying a block on it would refuse most ordinary source files.
 *
 * The category names ARE precise: an `ai_api_key` category means a credential
 * of that class was found in the ORIGINAL text. That is the signal worth
 * blocking on, and this list is what makes it checkable.
 *
 * This package is dependency-free by contract, so the list is duplicated from
 * guard-core's `HIGH_RISK_SECRET_PATTERNS` rather than imported. The duplication
 * is not left to trust: `apps/local-ai-broker` depends on BOTH packages and
 * carries a test that fails the build if the two lists ever diverge.
 */
export const HIGH_RISK_SECRET_CLASSES = [
    "private_key",
    "jwt",
    "github_token",
    "gitlab_token",
    "huggingface_token",
    "npm_token",
    "pypi_token",
    "sendgrid_key",
    "digitalocean_token",
    "shopify_token",
    "databricks_token",
    "supabase_key",
    "github_fine_grained",
    "docker_pat",
    "mailgun_key",
    "bitbucket_token",
    "gitlab_ci_token",
    "terraform_token",
    "discord_token",
    "azure_storage",
    "connection_string",
    "aws_access_key",
    "anthropic_key",
    "stripe_key",
    "razorpay_key",
    "ai_api_key",
    "bearer_token",
    "slack_token",
    "database_url",
] as const;

export type HighRiskSecretClass = (typeof HIGH_RISK_SECRET_CLASSES)[number];

const HIGH_RISK_SET: ReadonlySet<string> = new Set(HIGH_RISK_SECRET_CLASSES);

/** True when a scan category names a credential class, not lower-risk PII. */
export function isHighRiskSecretClass(category: string): boolean {
    return HIGH_RISK_SET.has(category);
}

/** The credential classes present in a scan result, in the order reported. */
export function highRiskSecretClasses(categories: readonly string[]): string[] {
    return categories.filter(isHighRiskSecretClass);
}
