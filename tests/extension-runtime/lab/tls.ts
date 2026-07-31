/**
 * Throwaway TLS material for the packaged-extension runtime lab.
 *
 * The lab has to serve `https://chatgpt.com/` from loopback, because the *store* manifest
 * only injects its content script on real https AI origins — a test that reached the guard
 * over `http://127.0.0.1` would be exercising the dev manifest, not the artefact that ships.
 * Chrome is pointed at the loopback server with `--host-resolver-rules` and told to accept
 * exactly one key with `--ignore-certificate-errors-spki-list`, which is a per-key exception
 * rather than the blanket `--ignore-certificate-errors` switch.
 *
 * The keypair is generated per run into the OS temp directory, is valid for two days, and is
 * deleted when the run ends. Nothing is written inside the repository, so there is no path by
 * which a test certificate can be committed or reused as a real one.
 */
import { execFileSync } from "node:child_process";
import { X509Certificate, createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Hostnames the lab impersonates on loopback. */
export const LAB_HOSTNAMES = ["chatgpt.com", "soterai.in", "localhost"] as const;

export interface LabCertificate {
  cert: string;
  key: string;
  /** base64(SHA-256(SubjectPublicKeyInfo)) — the value Chrome's SPKI allowlist takes. */
  spkiSha256Base64: string;
  dispose(): void;
}

export function createLabCertificate(hostnames: readonly string[] = LAB_HOSTNAMES): LabCertificate {
  const dir = mkdtempSync(join(tmpdir(), "soter-ext-lab-tls-"));
  const configPath = join(dir, "openssl.cnf");
  const certPath = join(dir, "cert.pem");
  const keyPath = join(dir, "key.pem");

  const san = [
    ...hostnames.map((hostname) => `DNS:${hostname}`),
    "IP:127.0.0.1",
  ].join(",");

  writeFileSync(
    configPath,
    [
      "[req]",
      "distinguished_name = dn",
      "x509_extensions = v3_lab",
      "prompt = no",
      "",
      "[dn]",
      "CN = SoterAI Extension Runtime Lab",
      "",
      "[v3_lab]",
      `subjectAltName = ${san}`,
      "basicConstraints = critical,CA:FALSE",
      "keyUsage = critical,digitalSignature,keyEncipherment",
      "extendedKeyUsage = serverAuth",
      "",
    ].join("\n"),
    "utf8",
  );

  execFileSync(
    "openssl",
    [
      "req", "-x509",
      "-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:prime256v1",
      "-nodes",
      "-keyout", keyPath,
      "-out", certPath,
      // Short-lived on purpose: a lab certificate that outlives the lab is a liability.
      "-days", "2",
      "-config", configPath,
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );

  const cert = readFileSync(certPath, "utf8");
  const key = readFileSync(keyPath, "utf8");
  const spki = new X509Certificate(cert).publicKey.export({ type: "spki", format: "der" });
  const spkiSha256Base64 = createHash("sha256").update(spki).digest("base64");

  return {
    cert,
    key,
    spkiSha256Base64,
    dispose() {
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
