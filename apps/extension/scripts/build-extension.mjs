import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(extensionRoot, "..", "..");
const dist = resolve(repositoryRoot, "dist", "extension");
const compileDir = resolve(repositoryRoot, "dist", ".extension-compile");

rmSync(dist, { recursive: true, force: true });
rmSync(compileDir, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

execFileSync("npx", ["tsc", "-p", resolve(extensionRoot, "tsconfig.json"), "--outDir", compileDir], {
  cwd: repositoryRoot, stdio: "inherit", shell: process.platform === "win32",
});

const compiledExtension = resolve(compileDir, "apps", "extension", "src");
for (const directory of ["background", "content", "popup", "sidepanel", "lib", "adapters"]) {
  cpSync(resolve(compiledExtension, directory), resolve(dist, directory), { recursive: true, force: true });
}
cpSync(resolve(compileDir, "packages"), resolve(dist, "packages"), { recursive: true, force: true });

copy("manifest.json", "manifest.json");
copy("managed-schema.json", "managed-schema.json");
copy("src/popup/index.html", "popup/index.html");
copy("src/sidepanel/index.html", "sidepanel/index.html");
mkdirSync(resolve(dist, "assets"), { recursive: true });
cpSync(resolve(repositoryRoot, "public", "icon-192.png"), resolve(dist, "assets", "icon-192.png"));
cpSync(resolve(repositoryRoot, "public", "icon-512.png"), resolve(dist, "assets", "icon-512.png"));

for (const file of walk(dist).filter((path) => extname(path) === ".js")) rewriteModuleImports(file);
rmSync(compileDir, { recursive: true, force: true });

for (const required of ["manifest.json", "background/service-worker.js", "content/index.js", "popup/index.html", "popup/main.js", "sidepanel/index.html", "sidepanel/main.js", "assets/icon-192.png", "assets/icon-512.png"]) {
  if (!existsSync(resolve(dist, required))) throw new Error(`Extension build is missing ${required}`);
}
console.log(`Built loadable extension: ${dist}`);

function copy(from, to) { cpSync(resolve(extensionRoot, from), resolve(dist, to), { force: true }); }
function walk(directory) { return readdirSync(directory).flatMap((name) => { const path = resolve(directory, name); return statSync(path).isDirectory() ? walk(path) : [path]; }); }
function rewriteModuleImports(file) {
  let source = readFileSync(file, "utf8");
  source = source.replace(/(from\s+["']|import\s*["']|import\s*\(\s*["'])(\.\.\/)+packages\/([^"']+)(["'])/g, (_match, prefix, _ups, target, quote) => {
    const packageTarget = resolve(dist, "packages", target);
    return `${prefix}${toModulePath(relative(dirname(file), packageTarget))}${quote}`;
  });
  source = source.replace(/(from\s+["']|import\s*["']|import\s*\(\s*["'])(\.\.?\/[^"']+?)(["'])/g, (_match, prefix, target, quote) => {
    return `${prefix}${hasExtension(target) ? target : `${target}.js`}${quote}`;
  });
  writeFileSync(file, source);
}
function toModulePath(path) { const normalized = path.split(sep).join("/"); return normalized.startsWith(".") ? normalized : `./${normalized}`; }
function hasExtension(path) { return /\.[a-z0-9]+$/i.test(path); }
