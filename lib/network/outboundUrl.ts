import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

function isPrivateIpv4(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function isPrivateIpv6(address: string) {
  const normalized = address.toLowerCase().split("%")[0];
  return normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb");
}

export function isPrivateNetworkAddress(address: string) {
  const version = isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version === 6) return isPrivateIpv6(address);
  return true;
}

export function parsePublicHttpsUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("Outbound integration URLs must use HTTPS.");
  if (url.username || url.password) throw new Error("Outbound integration URLs must not contain credentials.");
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new Error("Outbound integration URL points to a private hostname.");
  }
  if (isIP(hostname) && isPrivateNetworkAddress(hostname)) throw new Error("Outbound integration URL points to a private network.");
  return url;
}

export async function assertPublicOutboundUrl(value: string) {
  const url = parsePublicHttpsUrl(value);
  if (!isIP(url.hostname)) {
    const addresses = await lookup(url.hostname, { all: true, verbatim: true });
    if (!addresses.length || addresses.some(({ address }) => isPrivateNetworkAddress(address))) {
      throw new Error("Outbound integration hostname resolves to a private network.");
    }
  }
  return url;
}
