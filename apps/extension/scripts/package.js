#!/usr/bin/env node
/**
 * Package Soter extension for Chrome/Edge store submission
 * Creates a zip file from the build output
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DIST_DIR = path.join(__dirname, '..', 'dist', 'extension');
const OUTPUT_DIR = path.join(__dirname, '..', 'dist');
const ZIP_NAME = 'soter-extension-v0.1.0.zip';
const OUTPUT_PATH = path.join(OUTPUT_DIR, ZIP_NAME);

console.log('📦 Packaging Soter Extension...');

// Check if dist/extension exists
if (!fs.existsSync(DIST_DIR)) {
  console.error('❌ Build output not found. Run `npm run build` first.');
  process.exit(1);
}

// Verify manifest exists
const manifestPath = path.join(DIST_DIR, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
  console.error('❌ manifest.json not found in build output.');
  process.exit(1);
}

// Remove old zip if exists
if (fs.existsSync(OUTPUT_PATH)) {
  fs.unlinkSync(OUTPUT_PATH);
  console.log('🗑️  Removed old package');
}

try {
  // Create zip using system zip command (cross-platform)
  const isWindows = process.platform === 'win32';
  
  if (isWindows) {
    // Use PowerShell Compress-Archive on Windows
    execSync(
      `powershell -Command "Compress-Archive -Path '${DIST_DIR}\\*' -DestinationPath '${OUTPUT_PATH}' -Force"`,
      { stdio: 'inherit' }
    );
  } else {
    // Use zip on Unix-like systems
    execSync(`cd "${DIST_DIR}" && zip -r "${OUTPUT_PATH}" .`, { stdio: 'inherit' });
  }

  const stats = fs.statSync(OUTPUT_PATH);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

  console.log(`\n✅ Extension packaged successfully!`);
  console.log(`📦 Package: ${ZIP_NAME}`);
  console.log(`📏 Size: ${sizeMB} MB`);
  console.log(`📂 Location: ${OUTPUT_PATH}`);
  console.log(`\n🚀 Ready for Chrome/Edge store submission`);
} catch (error) {
  console.error('❌ Packaging failed:', error.message);
  process.exit(1);
}
