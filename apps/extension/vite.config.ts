import { cpSync, copyFileSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

function copyExtensionStaticFiles() {
  return {
    name: "copy-extension-static-files",
    closeBundle() {
      const outDir = resolve(__dirname, "dist/extension");
      mkdirSync(outDir, { recursive: true });
      copyFileSync(resolve(__dirname, "manifest.json"), resolve(outDir, "manifest.json"));
      copyFileSync(resolve(__dirname, "managed-schema.json"), resolve(outDir, "managed-schema.json"));
      cpSync(resolve(__dirname, "assets"), resolve(outDir, "assets"), { recursive: true });
      mkdirSync(resolve(outDir, "popup"), { recursive: true });
      mkdirSync(resolve(outDir, "sidepanel"), { recursive: true });
      copyFileSync(resolve(outDir, "src/popup/index.html"), resolve(outDir, "popup/index.html"));
      copyFileSync(resolve(outDir, "src/sidepanel/index.html"), resolve(outDir, "sidepanel/index.html"));
      rmSync(resolve(outDir, "src"), { recursive: true, force: true });
    },
  };
}

export default defineConfig({
  build: {
    outDir: "dist/extension",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        "background/service-worker": resolve(__dirname, "src/background/service-worker.ts"),
        "popup/index": resolve(__dirname, "src/popup/index.html"),
        "sidepanel/index": resolve(__dirname, "src/sidepanel/index.html"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
  plugins: [copyExtensionStaticFiles()],
});
