export const DEFAULT_DATABASE_CONNECT_TIMEOUT_SECONDS = 30;

/**
 * Gives serverless Postgres providers enough time to wake a cold compute.
 * Explicit connection-string settings always win.
 */
export function withDatabaseConnectTimeout(
  url: string | undefined,
  timeoutSeconds = DEFAULT_DATABASE_CONNECT_TIMEOUT_SECONDS,
) {
  if (!url || /(?:[?&])connect_timeout=/i.test(url)) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}connect_timeout=${timeoutSeconds}`;
}
