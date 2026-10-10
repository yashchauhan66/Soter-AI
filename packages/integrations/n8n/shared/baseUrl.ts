/** Also embedded in the credential-test expression; keep this function self-contained. */
export function validatedBaseUrl(raw: string): string {
  const value = String(raw || "https://soterai.in").trim().replace(/\/+$/, "");
  const match = /^(https?):\/\/(\[[0-9a-f:]+\]|[a-z0-9.-]+)(?::(\d{1,5}))?(\/[^?#\s\\]*)?$/i.exec(value);
  if (!match) throw new Error("SoterAI Base URL must be a valid URL and must not include credentials, query parameters, or fragments.");
  const host = match[2].toLowerCase().replace(/\.$/, "");
  const local = ["localhost", "127.0.0.1", "[::1]", "host.docker.internal"].includes(host);
  if (match[1].toLowerCase() !== "https" && !(match[1].toLowerCase() === "http" && local && host !== "[::1]")) {
    throw new Error("SoterAI Base URL must use HTTPS, except http://localhost for local development.");
  }
  if (match[3] && (Number(match[3]) < 1 || Number(match[3]) > 65535)) throw new Error("SoterAI Base URL has an invalid port.");
  let reserved = false;
  if (!local && host.startsWith("[")) {
    // Only global unicast IPv6 literals are supported. This excludes mapped
    // IPv4, unique-local, link-local, multicast and metadata endpoints.
    reserved = !/^\[[23][0-9a-f]{0,3}:/.test(host) || /^\[(?:2002:|2001:(?:0:|db8:|2:))/.test(host);
  } else if (!local && /^(?:\d+|0x[0-9a-f]+)(?:\.(?:\d+|0x[0-9a-f]+))*$/i.test(host)) {
    const parts = host.split(".");
    const octets = parts.map(Number);
    reserved = parts.length !== 4 || parts.some((part) => !/^(?:0|[1-9]\d{0,2})$/.test(part)) || octets.some((part) => part > 255);
    const [a, b] = octets;
    reserved = reserved || a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || b === 0)) || (a === 198 && (b === 18 || b === 19)) ||
      (a === 100 && b >= 64 && b <= 127);
  } else if (!local) {
    reserved = !host.includes(".") || host.split(".").some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) ||
      /(?:^|\.)(?:localhost|internal|local|corp|lan)$/.test(host) || host === "instance-data";
  }
  if (reserved) throw new Error("SoterAI Base URL must not target private network or cloud metadata IP addresses.");
  return value;
}
