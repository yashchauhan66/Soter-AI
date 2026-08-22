import { resolve } from "node:path";
import { defineConfig } from "vite";

// v0.2.0: builds the MAIN-world WebSocket hook as a standalone IIFE bundle.
// Declared in manifest.json with "world": "MAIN" and "run_at": "document_start".
export default defineConfig({
  publicDir: false,
  build: {
    outDir: "dist/extension",
    emptyOutDir: false,
    rollupOptions: {
      input: resolve(__dirname, "src/content/ws-page-hook.ts"),
      output: {
        format: "iife",
        inlineDynamicImports: true,
        entryFileNames: "content/ws-page-hook.js",
      },
    },
  },
});