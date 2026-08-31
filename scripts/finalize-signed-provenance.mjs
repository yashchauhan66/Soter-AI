import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// Finalizes reports/release-provenance-attestation.json using ONLY the real
// verification results passed in by the signed-release workflow. This is the
// single place allowed to flip signatureVerified / reproducibleBuildVerified to
// true, and it does so strictly from environment flags that are themselves
// derived from actual verify steps (vsce verify-signature exit code; a
// second-build hash comparison). There is no code path here that sets a gate
// flag true without its backing evidence being true.
//
// Env contract (set by .github/workflows/signed-release.yml):
//   SIGNATURE_VERIFIED = "true" only if `vsce verify-signature` succeeded
//   REPRODUCIBLE       = "true" only if build #2 hash matched build #1
//   CAN_SIGN           = "true" if an org signing certificate secret was present

const root = process.cwd();
const jsonPath = join(root, "reports", "release-provenance-attestation.json");

if (!existsSync(jsonPath)) {
  console.error(`Missing ${relative(root, jsonPath)} — run "npm run release:vscode:provenance" first.`);
  process.exit(1);
}

const flag = (name) => process.env[name] === "true";
const signaturePath = process.env.SIGNATURE_PATH ? join(root, process.env.SIGNATURE_PATH) : undefined;
const signatureManifestPath = process.env.SIGNATURE_MANIFEST_PATH ? join(root, process.env.SIGNATURE_MANIFEST_PATH) : undefined;
const signatureEvidencePresent = Boolean(
  signaturePath && signatureManifestPath && existsSync(signaturePath) && existsSync(signatureManifestPath),
);
const signatureVerified = flag("SIGNATURE_VERIFIED") && signatureEvidencePresent;
const reproducibleBuildVerified = flag("REPRODUCIBLE");
const canSign = flag("CAN_SIGN");

const attestation = JSON.parse(readFileSync(jsonPath, "utf8"));

const evidenceArtifact = (file) => ({
  path: relative(root, file).replaceAll("\\", "/"),
  bytes: statSync(file).size,
  sha256: `sha256:${createHash("sha256").update(readFileSync(file)).digest("hex")}`,
});

attestation.signatureVerified = signatureVerified;
attestation.reproducibleBuildVerified = reproducibleBuildVerified;
attestation.verifiedAt = new Date().toISOString();
attestation.signatureArtifacts = signatureEvidencePresent
  ? [evidenceArtifact(signatureManifestPath), evidenceArtifact(signaturePath)]
  : [];

attestation.signingStatus = signatureVerified
  ? "signed-verified-ci"
  : canSign
    ? "signing-attempted-unverified"
    : "unsigned-local-build";

attestation.signingNextStep = signatureVerified
  ? "Signature verified in CI against an organization-controlled certificate."
  : canSign
    ? "Signing certificate was present but verification did not succeed — investigate before publishing."
    : "Add VSIX_SIGNING_CERT_BASE64 + VSIX_SIGNING_CERT_PASSWORD organization secrets, then re-run the Signed Release workflow.";

attestation.reproducibilityNextStep = reproducibleBuildVerified
  ? "Two independent CI builds produced identical artifact hashes."
  : "A second clean build produced a different hash — pin toolchain/deps for byte-reproducibility before claiming it.";

// The signed-provenance evidence gate (lib/enterprise/security100EvidenceGate.ts)
// passes only when commitSha is a 40-hex, artifactHash present, signatureVerified,
// reproducibleBuildVerified, SBOM exists, and verifiedAt is set. State it plainly.
const gateReady =
  Boolean(attestation.commitSha) &&
  /^[a-f0-9]{40}$/i.test(attestation.commitSha ?? "") &&
  Boolean(attestation.artifactHash) &&
  attestation.dirtyWorktree === false &&
  signatureVerified &&
  reproducibleBuildVerified &&
  Boolean(attestation.sbomPresent);

attestation.claimBoundary = gateReady
  ? "Signed, reproducible, SBOM-backed release. Satisfies the 100/100 signed-provenance gate."
  : "Not yet a full signed-provenance gate pass. Missing: " +
    [
      !signatureVerified && "verified signature",
      !reproducibleBuildVerified && "reproducible-build match",
      !attestation.sbomPresent && "SBOM",
      attestation.dirtyWorktree && "clean worktree (build from a tagged commit)",
    ]
      .filter(Boolean)
      .join(", ") +
    ".";

writeFileSync(jsonPath, `${JSON.stringify(attestation, null, 2)}\n`, "utf8");
const markdownPath = join(root, "reports", "release-provenance-attestation.md");
const markdown = `# VS Code Release Provenance

- Product: ${attestation.product ?? "soterai-ide-guard"}
- Version: ${attestation.version ?? "unknown"}
- Commit: ${attestation.commitSha ?? "unknown"}
- Dirty worktree: ${attestation.dirtyWorktree ? "yes" : "no"}
- SBOM present: ${attestation.sbomPresent ? "yes" : "no"} (${attestation.sbomPath ?? "not recorded"})
- Signing status: ${attestation.signingStatus}
- Signature verified: ${attestation.signatureVerified ? "yes" : "no"}
- Reproducible build verified: ${attestation.reproducibleBuildVerified ? "yes" : "no"}

## Signature Evidence

${attestation.signatureArtifacts.length
  ? attestation.signatureArtifacts.map((item) => `- \`${item.path}\` — ${item.bytes} bytes — \`${item.sha256}\``).join("\n")
  : "No detached signature evidence is present."}

## Claim Boundary

${attestation.claimBoundary}

## Next Steps

- ${attestation.signingNextStep}
- ${attestation.reproducibilityNextStep}
`;
writeFileSync(markdownPath, markdown, "utf8");
console.log(
  `Finalized provenance: signatureVerified=${signatureVerified} ` +
    `reproducibleBuildVerified=${reproducibleBuildVerified} gateReady=${gateReady}`,
);
