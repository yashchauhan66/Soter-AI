import assert from "node:assert/strict";
import test from "node:test";

import { isPrivateNetworkAddress, parsePublicHttpsUrl, assertPublicOutboundUrl } from "../lib/network/outboundUrl";

// ─── isPrivateNetworkAddress tests ─────────────────────────────

test("isPrivateNetworkAddress detects all private IPv4 ranges", () => {
  assert.equal(isPrivateNetworkAddress("10.0.0.1"), true, "10.x.x.x is private");
  assert.equal(isPrivateNetworkAddress("10.255.255.255"), true, "10.x.x.x upper bound");
  assert.equal(isPrivateNetworkAddress("172.16.0.1"), true, "172.16.0.0/12 start");
  assert.equal(isPrivateNetworkAddress("172.31.255.255"), true, "172.16.0.0/12 end");
  assert.equal(isPrivateNetworkAddress("192.168.0.1"), true, "192.168.x.x is private");
  assert.equal(isPrivateNetworkAddress("192.168.255.255"), true, "192.168.x.x upper bound");
  assert.equal(isPrivateNetworkAddress("127.0.0.1"), true, "127.x.x.x is loopback");
  assert.equal(isPrivateNetworkAddress("169.254.1.1"), true, "169.254.x.x is link-local");
  assert.equal(isPrivateNetworkAddress("0.0.0.0"), true, "0.x.x.x is invalid/private");
  assert.equal(isPrivateNetworkAddress("224.0.0.1"), true, "224+ is multicast");
});

test("isPrivateNetworkAddress allows public IPv4 ranges", () => {
  assert.equal(isPrivateNetworkAddress("8.8.8.8"), false, "Google DNS is public");
  assert.equal(isPrivateNetworkAddress("1.1.1.1"), false, "Cloudflare DNS is public");
  assert.equal(isPrivateNetworkAddress("203.0.113.1"), false, "Documentation range");
  assert.equal(isPrivateNetworkAddress("198.51.100.1"), false, "Documentation range");
});

test("isPrivateNetworkAddress detects private IPv6 ranges", () => {
  assert.equal(isPrivateNetworkAddress("::1"), true, "IPv6 loopback");
  assert.equal(isPrivateNetworkAddress("::"), true, "IPv6 unspecified");
  assert.equal(isPrivateNetworkAddress("fc00::1"), true, "IPv6 unique-local fc");
  assert.equal(isPrivateNetworkAddress("fd00::1"), true, "IPv6 unique-local fd");
  assert.equal(isPrivateNetworkAddress("fe80::1"), true, "IPv6 link-local fe80");
  assert.equal(isPrivateNetworkAddress("fe90::1"), true, "IPv6 link-local fe90");
  assert.equal(isPrivateNetworkAddress("fea0::1"), true, "IPv6 link-local fea0");
  assert.equal(isPrivateNetworkAddress("feb0::1"), true, "IPv6 link-local feb0");
});

test("isPrivateNetworkAddress allows public IPv6 ranges", () => {
  assert.equal(isPrivateNetworkAddress("2001:4860:4860::8888"), false, "Google DNS IPv6");
  assert.equal(isPrivateNetworkAddress("2606:4700:4700::1111"), false, "Cloudflare DNS IPv6");
});

// ─── parsePublicHttpsUrl tests ────────────────────────────────

test("parsePublicHttpsUrl rejects non-HTTPS protocols", () => {
  assert.throws(() => parsePublicHttpsUrl("http://example.com"), /HTTPS/);
  assert.throws(() => parsePublicHttpsUrl("ftp://example.com"), /HTTPS/);
  assert.throws(() => parsePublicHttpsUrl("javascript:alert(1)"), /HTTPS/);
});

test("parsePublicHttpsUrl rejects URLs with embedded credentials", () => {
  assert.throws(() => parsePublicHttpsUrl("https://user:pass@evil.com"), /credentials/);
  assert.throws(() => parsePublicHttpsUrl("https://user@evil.com"), /credentials/);
});

test("parsePublicHttpsUrl rejects private hostnames", () => {
  assert.throws(() => parsePublicHttpsUrl("https://localhost"), /private hostname/);
  assert.throws(() => parsePublicHttpsUrl("https://localhost:3000"), /private hostname/);
  assert.throws(() => parsePublicHttpsUrl("https://internal.service.local"), /private hostname/);
  assert.throws(() => parsePublicHttpsUrl("https://something.local"), /private hostname/);
  assert.throws(() => parsePublicHttpsUrl("https://dev.internal"), /private hostname/);
});

test("parsePublicHttpsUrl rejects direct private IP addresses", () => {
  assert.throws(() => parsePublicHttpsUrl("https://10.0.0.1"), /private network/);
  assert.throws(() => parsePublicHttpsUrl("https://192.168.1.1"), /private network/);
  assert.throws(() => parsePublicHttpsUrl("https://172.16.0.1"), /private network/);
  assert.throws(() => parsePublicHttpsUrl("https://127.0.0.1"), /private network/);
  assert.throws(() => parsePublicHttpsUrl("https://169.254.1.1"), /private network/);
});

test("parsePublicHttpsUrl accepts valid HTTPS URLs", () => {
  const result = parsePublicHttpsUrl("https://example.com/webhook");
  assert.equal(result.hostname, "example.com");
  assert.equal(result.protocol, "https:");
});

test("parsePublicHttpsUrl accepts public IP addresses", () => {
  const result = parsePublicHttpsUrl("https://8.8.8.8");
  assert.equal(result.hostname, "8.8.8.8");
});

// ─── assertPublicOutboundUrl DNS resolution tests ─────────────

test("assertPublicOutboundUrl rejects hostnames that resolve to private IPs", async () => {
  // localhost resolves to 127.0.0.1 / ::1
  await assert.rejects(() => assertPublicOutboundUrl("https://localhost"), /private/);
});

test("assertPublicOutboundUrl accepts hostnames that resolve to public IPs", async () => {
  // example.com resolves to public IPs
  const result = await assertPublicOutboundUrl("https://example.com");
  assert.equal(result.hostname, "example.com");
});

test("assertPublicOutboundUrl rejects hostnames that fail DNS resolution", async () => {
  // This hostname should not exist
  const unique = `nonexistent-${Date.now()}.invalid`;
  await assert.rejects(() => assertPublicOutboundUrl(`https://${unique}`));
});

test("complete SSRF protection chain blocks SSRF to metadata endpoint", async () => {
  // AWS/GCP metadata endpoints
  await assert.rejects(
    () => assertPublicOutboundUrl("https://169.254.169.254/latest/meta-data/"),
    /private network/,
  );
});

test("complete SSRF protection chain blocks internal kubernetes service", async () => {
  await assert.rejects(
    () => assertPublicOutboundUrl("https://kubernetes.default.svc.cluster.local"),
    /private hostname/,
  );
});
