import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const script = path.resolve("scripts/finalize-signed-provenance.mjs");

function fixture(dirtyWorktree = false) {
  const root = mkdtempSync(path.join(tmpdir(), "soterai-provenance-"));
  mkdirSync(path.join(root, "reports"), { recursive: true });
  mkdirSync(path.join(root, "artifacts", "security"), { recursive: true });
  writeFileSync(path.join(root, "artifacts", "security", "vscode-extension.cdx.json"), "{}\n");
  writeFileSync(path.join(root, "reports", "release-provenance-attestation.json"), JSON.stringify({
    commitSha: "0123456789abcdef0123456789abcdef01234567",
    artifactHash: "sha256:0123456789abcdef",
    sbomPath: "artifacts/security/vscode-extension.cdx.json",
    sbomPresent: true,
    dirtyWorktree,
  }));
  return root;
}

function finalize(root: string, extraEnv: Record<string, string> = {}) {
  execFileSync(process.execPath, [script], {
    cwd: root,
    env: { ...process.env, SIGNATURE_VERIFIED: "true", REPRODUCIBLE: "true", CAN_SIGN: "true", ...extraEnv },
    stdio: "pipe",
  });
  return JSON.parse(readFileSync(path.join(root, "reports", "release-provenance-attestation.json"), "utf8"));
}

test("provenance refuses a verified-signature claim without retained evidence", () => {
  const report = finalize(fixture(), {
    SIGNATURE_PATH: "signing-evidence/missing.p7s",
    SIGNATURE_MANIFEST_PATH: "signing-evidence/missing.json",
  });
  assert.equal(report.signatureVerified, false);
  assert.deepEqual(report.signatureArtifacts, []);
  assert.match(report.claimBoundary, /verified signature/);
});

test("provenance hashes retained signature evidence after successful verification", () => {
  const root = fixture();
  mkdirSync(path.join(root, "signing-evidence"));
  writeFileSync(path.join(root, "signing-evidence", "manifest.json"), "manifest");
  writeFileSync(path.join(root, "signing-evidence", "signature.p7s"), "signature");
  const report = finalize(root, {
    SIGNATURE_PATH: "signing-evidence/signature.p7s",
    SIGNATURE_MANIFEST_PATH: "signing-evidence/manifest.json",
  });
  assert.equal(report.signatureVerified, true);
  assert.equal(report.signatureArtifacts.length, 2);
  for (const artifact of report.signatureArtifacts) assert.match(artifact.sha256, /^sha256:[a-f0-9]{64}$/);
  assert.match(report.claimBoundary, /Signed, reproducible, SBOM-backed/);
  const markdown = readFileSync(path.join(root, "reports", "release-provenance-attestation.md"), "utf8");
  assert.match(markdown, /Signature verified: yes/);
  assert.match(markdown, /signature\.p7s/);
});

test("a dirty build cannot claim the full signed-provenance gate", () => {
  const root = fixture(true);
  mkdirSync(path.join(root, "signing-evidence"));
  writeFileSync(path.join(root, "signing-evidence", "manifest.json"), "manifest");
  writeFileSync(path.join(root, "signing-evidence", "signature.p7s"), "signature");
  const report = finalize(root, {
    SIGNATURE_PATH: "signing-evidence/signature.p7s",
    SIGNATURE_MANIFEST_PATH: "signing-evidence/manifest.json",
  });
  assert.equal(report.signatureVerified, true);
  assert.match(report.claimBoundary, /clean worktree/);
  assert.doesNotMatch(report.claimBoundary, /^Signed, reproducible/);
});