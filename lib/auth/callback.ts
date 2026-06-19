const DEFAULT_CALLBACK_URL = "/dashboard";

export function safeCallbackUrl(value: string | null | undefined): string {
  if (!value) return DEFAULT_CALLBACK_URL;
  try {
    const decoded = decodeURIComponent(value).trim();
    if (!decoded.startsWith("/") || decoded.startsWith("//")) return DEFAULT_CALLBACK_URL;
    if (decoded.includes("\\") || /[\u0000-\u001f]/.test(decoded)) return DEFAULT_CALLBACK_URL;
    return decoded;
  } catch {
    return DEFAULT_CALLBACK_URL;
  }
}
