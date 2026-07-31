import { sha256 } from "./provenance";

export interface HubFetchPolicy {
  token: string;
  allowedDomains: string[];
  allowedRepositories: string[];
  maximumBytes: number;
  timeoutMs: number;
  maximumRedirects: number;
  expectedSha256: string;
}

type FetchLike = typeof fetch;

function repositoryFromUrl(url: URL): string | null {
  const match = url.pathname.match(/^\/([^/]+\/[^/]+)\/resolve\//);
  return match?.[1] ?? null;
}

function assertApproved(url: URL, policy: HubFetchPolicy): void {
  if (url.protocol !== "https:") throw new Error("Hub fetch requires HTTPS");
  if (!policy.allowedDomains.includes(url.hostname)) throw new Error("Hub domain is not allowlisted");
  const repo = repositoryFromUrl(url);
  if (!repo || !policy.allowedRepositories.includes(repo)) throw new Error("Hub repository is not allowlisted");
}

/** Authenticated, redirect-bounded, size-bounded acquisition. Never loads the model. */
export async function fetchHuggingFaceArtifact(
  inputUrl: string,
  policy: HubFetchPolicy,
  fetchImpl: FetchLike = fetch,
): Promise<Buffer> {
  if (!policy.token.trim()) throw new Error("Authenticated Hub fetch requires an access token");
  if (!/^[a-f0-9]{64}$/i.test(policy.expectedSha256)) throw new Error("Hub fetch requires SHA-256 pinning");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), policy.timeoutMs);
  try {
    let current = new URL(inputUrl);
    for (let redirects = 0; ; redirects += 1) {
      assertApproved(current, policy);
      const response = await fetchImpl(current, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: { authorization: `Bearer ${policy.token}`, accept: "application/octet-stream" },
      });
      if (response.status >= 300 && response.status < 400) {
        if (redirects >= policy.maximumRedirects) throw new Error("Hub redirect limit exceeded");
        const location = response.headers.get("location");
        if (!location) throw new Error("Hub redirect has no location");
        current = new URL(location, current);
        continue;
      }
      if (!response.ok) throw new Error(`Hub fetch failed with HTTP ${response.status}`);
      const declared = Number(response.headers.get("content-length") ?? "0");
      if (declared > policy.maximumBytes) throw new Error("Hub artifact exceeds download-size limit");
      if (!response.body) throw new Error("Hub response has no body");

      const chunks: Buffer[] = [];
      let total = 0;
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > policy.maximumBytes) {
          await reader.cancel();
          throw new Error("Hub artifact exceeds download-size limit");
        }
        chunks.push(Buffer.from(value));
      }
      const bytes = Buffer.concat(chunks, total);
      if (sha256(bytes) !== policy.expectedSha256.toLowerCase()) throw new Error("Hub artifact hash mismatch");
      return bytes;
    }
  } finally {
    clearTimeout(timer);
  }
}
