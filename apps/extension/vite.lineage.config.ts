import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  publicDir: false,
  build: {
    outDir: "dist/extension",
    emptyOutDir: false,
    rollupOptions: {
      input: resolve(__dirname, "src/content/source-lineage-entry.ts"),
      output: {
        format: "iife",
        inlineDynamicImports: true,
        entryFileNames: "content/source-lineage-entry.js",
      },
    },
  },
});
