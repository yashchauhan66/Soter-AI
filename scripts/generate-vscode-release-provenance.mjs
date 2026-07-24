import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import os from "node:os";

const root = process.cwd();
const extensionRoot = join(root, "packages", "vscode-extension");
const pkg = JSON.parse(readFileSync(join(extensionRoot, "package.json"), "utf8"));
const reportsDir = join(root, "reports");
const securityDir = join(root, "artifacts", "security");
mkdirSync(reportsDir, { recursive: true });
mkdirSync(securityDir, { recursive: true });

function sha256(file) {
  const hash = createHash("sha256");
  hash.update(readFileSync(file));
  return `sha256:${hash.digest("hex")}`;
}

function optionalExec(command, args) {
  try {
    return execFileSync(command, args, { cwd: root, encoding: "utf8", shell: process.platform === "win32" }).trim();
  } catch {
    return undefined;
  }
}

function artifact(path) {
  if (!existsSync(path)) return undefined;
  const stat = statSync(path);
  return {
    path: relative(root, path).replaceAll("\\", "/"),
    bytes: stat.size,
    sha256: sha256(path),
  };
}

const vsix = join(extensionRoot, `soterai-ide-guard-${pkg.version}.vsix`);
const extensionJs = join(extensionRoot, "dist", "extension.js");
const brokerJs = join(extensionRoot, "dist", "local-ai-broker.js");
const artifacts = [artifact(vsix), artifact(extensionJs), artifact(brokerJs)].filter(Boolean);
const commitSha = optionalExec("git", ["rev-parse", "HEAD"]);
const status = optionalExec("git", ["status", "--short"]) ?? "";
const sbomPath = "artifacts/security/sbom.spdx-lite.json";

const attestation = {
  generatedAt: new Date().toISOString(),
  product: "soterai-ide-guard",
  version: pkg.version,
  commitSha,
  dirtyWorktree: status.length > 0,
  buildCommands: [
    "npm --prefix packages/vscode-extension run typecheck",
    "npm --prefix packages/vscode-extension run test",
    "npm --prefix packages/vscode-extension run package",
  ],
  environment: {
    node: process.version,
    platform: `${os.type()} ${os.release()} ${os.arch()}`,
    cpu: os.cpus()[0]?.model ?? "unknown",
  },
  sbomPath,
  sbomPresent: existsSync(join(root, sbomPath)),
  artifacts,
  artifactHash: artifacts.find((item) => item.path.endsWith(".vsix"))?.sha256,
  signatureVerified: false,
  reproducibleBuildVerified: false,
  verifiedAt: new Date().toISOString(),
  signingStatus: "unsigned-local-build",
  signingNextStep: "Sign the VSIX in CI with an organization-controlled certificate or marketplace-supported signing flow, then set signatureVerified only after verification.",
  reproducibilityNextStep: "Run the same build from a clean tagged commit on a second machine/CI runner and compare artifact hashes before setting reproducibleBuildVerified.",
  claimBoundary: "This proves local artifact integrity and checksum publication readiness. It is not a signed release and does not satisfy the 100/100 signed-provenance gate yet.",
};

const jsonPath = join(reportsDir, "release-provenance-attestation.json");
writeFileSync(jsonPath, `${JSON.stringify(attestation, null, 2)}\n`, "utf8");

const checksums = artifacts
  .map((item) => `${item.sha256.replace("sha256:", "")}  ${item.path}`)
  .join("\n");
writeFileSync(join(reportsDir, "vscode-release-checksums.sha256"), `${checksums}\n`, "utf8");

const markdown = `# VS Code Release Provenance

Generated: ${attestation.generatedAt}

- Product: ${attestation.product}
- Version: ${attestation.version}
- Commit: ${attestation.commitSha ?? "unknown"}
- Dirty worktree: ${attestation.dirtyWorktree ? "yes" : "no"}
- SBOM present: ${attestation.sbomPresent ? "yes" : "no"} (${attestation.sbomPath})
- Signing status: ${attestation.signingStatus}
- Signature verified: ${attestation.signatureVerified ? "yes" : "no"}
- Reproducible build verified: ${attestation.reproducibleBuildVerified ? "yes" : "no"}

## Artifacts

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
${artifacts.map((item) => `| \`${item.path}\` | ${item.bytes} | \`${item.sha256}\` |`).join("\n")}

## Claim Boundary

${attestation.claimBoundary}

## Next Steps

- ${attestation.signingNextStep}
- ${attestation.reproducibilityNextStep}
`;

writeFileSync(join(reportsDir, "release-provenance-attestation.md"), markdown, "utf8");

console.log(`Release provenance written: ${relative(root, jsonPath)}`);
console.log(`Checksums written: ${relative(root, join(reportsDir, "vscode-release-checksums.sha256"))}`);
