// Packages the WordPress plugin into dist/soter-guard.zip.
// Uses PowerShell's Compress-Archive on Windows and `zip` elsewhere so it works
// without extra npm dependencies.
import { execFileSync } from "node:child_process";
import { mkdirSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const root = process.cwd();
const pluginDir = join(root, "integrations", "wordpress-plugin", "soter-guard");
const distDir = join(root, "dist");
const outFile = join(distDir, "soter-guard.zip");

if (!existsSync(pluginDir)) {
  console.error(`Plugin directory not found: ${pluginDir}`);
  process.exit(1);
}

mkdirSync(distDir, { recursive: true });
if (existsSync(outFile)) rmSync(outFile);

try {
  if (process.platform === "win32") {
    execFileSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `Compress-Archive -Path "${pluginDir}" -DestinationPath "${outFile}" -Force`,
      ],
      { stdio: "inherit" },
    );
  } else {
    // Zip with the plugin folder as the archive root.
    execFileSync("zip", ["-r", outFile, "soter-guard"], {
      cwd: join(root, "integrations", "wordpress-plugin"),
      stdio: "inherit",
    });
  }
  console.log(`WordPress plugin packaged: ${outFile}`);
} catch (error) {
  console.error("Failed to package the WordPress plugin.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
