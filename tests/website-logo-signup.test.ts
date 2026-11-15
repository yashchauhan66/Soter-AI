import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const ROOT = process.cwd();
const consumed = new Map<string, string>();
const modules = new Map<string, Module>();

// Evaluate the real TSX with the same automatic JSX runtime used by Next.
// Relative components are also real sources; auth requests are never submitted.
function load(rel: string): Record<string, unknown> {
  const cached = modules.get(rel);
  if (cached) return cached.exports as Record<string, unknown>;
  const filename = path.join(ROOT, rel);
  // A controlled, read-only replay can load the immutable pre-change form.
  const before = rel === "components/auth/SignUpForm.tsx" ? process.env.SOTER_SIGNUP_BEFORE : undefined;
  const raw = readFileSync(before ?? filename);
  consumed.set(rel, createHash("sha256").update(raw).digest("hex"));
  const mod = new Module(filename);
  mod.filename = filename;
  mod.paths = [path.join(ROOT, "node_modules")];
  modules.set(rel, mod);
  const nativeRequire = createRequire(filename);
  mod.require = Object.assign((id: string) => {
    if (id.startsWith(".")) {
      const base = path.resolve(path.dirname(filename), id);
      const local = [base + ".ts", base + ".tsx"].find((file) => existsSync(file));
      if (local) return load(path.relative(ROOT, local));
    }
    return nativeRequire(id);
  }, nativeRequire);
  const output = ts.transpileModule(raw.toString("utf8"), {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
    reportDiagnostics: true,
  });
  assert.equal((output.diagnostics ?? []).filter((item) => item.category === ts.DiagnosticCategory.Error).length, 0);
  (mod as unknown as { _compile(code: string, file: string): void })._compile(output.outputText, filename);
  return mod.exports as Record<string, unknown>;
}

test("account creation shows a neutral name hint instead of a sample person's name", () => {
  const SignUpForm = load("components/auth/SignUpForm.tsx").SignUpForm as React.ComponentType;
  const html = renderToStaticMarkup(React.createElement(SignUpForm));
  const input = html.match(/<input\b[^>]*\bname="name"[^>]*>/)?.[0];
  assert.ok(input, "The real signup form must render its name field");
  assert.match(input, /placeholder="Enter your name"/);
  assert.doesNotMatch(input, /Priya Sharma/);
});

process.on("exit", () => console.log("SOTER_CUBE_SIGNUP_CONSUMED " + JSON.stringify(Object.fromEntries(consumed))));
