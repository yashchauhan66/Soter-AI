const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { version } = require("../package.json");

const DIST_DIR = path.join(__dirname, "..", "dist", "extension");
const OUTPUT_DIR = path.join(__dirname, "..", "dist");
const PACKAGES = [
  `soter-extension-edge-v${version}.zip`,
  `soter-extension-chrome-v${version}.zip`,
];

console.log("Packaging Soter Extension store artifacts...");

if (!fs.existsSync(DIST_DIR)) {
  console.error("Build output not found. Run `npm run build` first.");
  process.exit(1);
}

const manifestPath = path.join(DIST_DIR, "manifest.json");
if (!fs.existsSync(manifestPath)) {
  console.error("manifest.json not found in build output.");
  process.exit(1);
}

try {
  for (const zipName of PACKAGES) {
    const outputPath = path.join(OUTPUT_DIR, zipName);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    createZip(outputPath);
    const stats = fs.statSync(outputPath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`Created ${zipName} (${sizeMB} MB)`);
  }
  console.log("Ready for Chrome Web Store and Microsoft Edge Add-ons submission.");
} catch (error) {
  console.error("Packaging failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function createZip(outputPath) {
  if (process.platform === "win32") {
    const result = spawnSync("powershell", [
      "-NoProfile",
      "-Command",
      "Compress-Archive",
      "-Path",
      path.join(DIST_DIR, "*"),
      "-DestinationPath",
      outputPath,
      "-Force",
    ], { stdio: "inherit" });
    if (result.status !== 0) throw new Error(`Compress-Archive failed for ${outputPath}`);
    return;
  }

  const result = spawnSync("zip", ["-r", outputPath, "."], { cwd: DIST_DIR, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`zip failed for ${outputPath}`);
}
