import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { Script } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

// Structural control only: compile source-selected JSX/data fragments with the
// real TypeScript compiler and React SSR. Link is a primitive anchor projection.
// Never import/execute the pages, auth, db, forms, redirects or callback handlers.
// Full production rendering and authentication validation remain parent-owned.
const ROOT = process.cwd();
const MODE = process.env.SOTER_BRANDING_REPAIR_MODE ?? "current";
assert.ok(MODE === "before" || MODE === "current", "Unknown repair source mode");
const nativeRequire = createRequire(path.join(ROOT, "package.json"));
const requiredPaths = ["app/comparison/page.tsx", "app/signin/page.tsx", "app/signup/page.tsx"];
const sha256 = (raw: string | Buffer) => createHash("sha256").update(raw).digest("hex");
const normalize = (value: string) => value.replace(/\s+/g, " ").trim();

type SourceEntry = {
  relative_path: string;
  source_path: string;
  sha256: string;
  expected_after_sha256: string;
  replacements: [string, string][];
};
type SourceManifest = { files: Record<string, SourceEntry>; authority: string };
let manifest: SourceManifest | undefined;
const authorityObservations: Record<string, unknown>[] = [];

function pinnedJson(file: string, pin: string | undefined): unknown {
  assert.ok(path.isAbsolute(file), "Evidence selector must be an absolute path");
  assert.ok(pin && /^[a-f0-9]{64}$/.test(pin), "Evidence selector needs a valid SHA-256 pin");
  const consumedPath = realpathSync(file); // No existence fallback to the checkout.
  const raw = readFileSync(consumedPath);
  assert.equal(sha256(raw), pin, `Evidence pin mismatch: ${consumedPath}`);
  authorityObservations.push({ consumed_path: consumedPath, sha256: sha256(raw) });
  return JSON.parse(raw.toString("utf8")) as unknown;
}

const manifestPath = process.env.SOTER_BRANDING_REPAIR_MANIFEST;
if (MODE === "before") assert.ok(manifestPath, "Before mode requires sources-before.json");
if (manifestPath !== undefined) {
  assert.equal(path.basename(manifestPath), "sources-before.json");
  manifest = pinnedJson(manifestPath, process.env.SOTER_BRANDING_REPAIR_MANIFEST_SHA256) as SourceManifest;
  assert.deepEqual(Object.keys(manifest.files).sort(), [...requiredPaths].sort());
  assert.equal(path.basename(manifest.authority), "authorized-scope.json");
  const scope = pinnedJson(manifest.authority, process.env.SOTER_BRANDING_REPAIR_SCOPE_SHA256) as {
    sources: Record<string, SourceEntry>;
    mutable_paths: string[];
    permitted_new_paths: string[];
  };
  assert.deepEqual(manifest.files, scope.sources, "Manifest must match the pinned authority");
  assert.deepEqual([...scope.mutable_paths].sort(), [...requiredPaths].sort());
  assert.deepEqual(scope.permitted_new_paths, ["tests/site-branding-comparison.test.ts"]);
  for (const rel of requiredPaths) {
    const entry = manifest.files[rel];
    assert.equal(entry.relative_path, rel);
    assert.ok(path.isAbsolute(entry.source_path));
    assert.match(entry.sha256, /^[a-f0-9]{64}$/);
    assert.match(entry.expected_after_sha256, /^[a-f0-9]{64}$/);
  }
}

type ParsedSource = { relativePath: string; consumedPath: string; ast: ts.SourceFile };
const sourceObservations: Record<string, unknown>[] = [];
const compileObservations: Record<string, unknown>[] = [];

function parsedSource(relativePath: string): ParsedSource {
  const entry = manifest?.files[relativePath];
  if (MODE === "before") assert.ok(entry, `Missing immutable selector: ${relativePath}`);
  const selected = MODE === "before" ? entry!.source_path : path.join(ROOT, relativePath);
  const consumedPath = realpathSync(selected);
  const raw = readFileSync(consumedPath);
  if (entry) {
    assert.equal(sha256(raw), MODE === "before" ? entry.sha256 : entry.expected_after_sha256,
      `Consumed source pin mismatch: ${consumedPath}`);
  }
  const utf8 = raw.toString("utf8");
  assert.equal(sha256(Buffer.from(utf8, "utf8")), sha256(raw), "Source must round-trip as UTF-8");
  const ast = ts.createSourceFile(relativePath, utf8, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const diagnostics = (ast as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics;
  const errors = diagnostics.filter((item) => item.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, `Source parse errors: ${consumedPath}`);
  sourceObservations.push({
    relative_path: relativePath, consumed_path: consumedPath, source_sha256: sha256(raw),
    parsed_utf8_sha256: sha256(utf8),
    ast_print_sha256: sha256(ts.createPrinter({ newLine: ts.NewLineKind.LineFeed }).printFile(ast)),
    parse_kind: "TypeScript.TSX", parse_error_count: errors.length,
  });
  return { relativePath, consumedPath, ast };
}

function one<T>(items: T[], label: string): T {
  assert.equal(items.length, 1, `Expected exactly one ${label}`);
  return items[0];
}

function descendants<T extends ts.Node>(root: ts.Node, predicate: (node: ts.Node) => node is T): T[] {
  const result: T[] = [];
  const visit = (node: ts.Node) => {
    if (predicate(node)) result.push(node);
    ts.forEachChild(node, visit);
  };
  visit(root);
  return result;
}

function unwrap(expression: ts.Expression): ts.Expression {
  while (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) ||
    ts.isSatisfiesExpression(expression) || ts.isTypeAssertionExpression(expression)) {
    expression = expression.expression;
  }
  return expression;
}

function returnedJsx(source: ParsedSource, name: string): ts.JsxElement {
  const fn = one(source.ast.statements.filter(ts.isFunctionDeclaration).filter((node) => node.name?.text === name), name);
  assert.ok(fn.body);
  const statement = one(fn.body.statements.filter(ts.isReturnStatement), `${name} direct return`);
  assert.ok(statement.expression);
  const expression = unwrap(statement.expression);
  assert.ok(ts.isJsxElement(expression), `${name} must return JSX`);
  return expression;
}

function attribute(node: ts.JsxElement, key: string): string | undefined {
  const attrs = node.openingElement.attributes.properties.filter(ts.isJsxAttribute).filter((item) => item.name.getText() === key);
  if (attrs.length === 0) return undefined;
  const attr = one(attrs, `${key} attribute`);
  assert.ok(attr.initializer && ts.isStringLiteral(attr.initializer), `${key} must be a JSX string literal`);
  return attr.initializer.text;
}

function section(source: ParsedSource, returned: ts.JsxElement, id: string): ts.JsxElement {
  return one(descendants(returned, ts.isJsxElement).filter((node) =>
    node.openingElement.tagName.getText(source.ast) === "section" && attribute(node, "aria-labelledby") === id), `${id} section`);
}

function dataArray(source: ParsedSource, name: string): ts.ArrayLiteralExpression {
  const declarations = source.ast.statements.filter(ts.isVariableStatement).flatMap((statement) => [...statement.declarationList.declarations]);
  const declaration = one(declarations.filter((node) => ts.isIdentifier(node.name) && node.name.text === name), `${name} declaration`);
  assert.ok(declaration.initializer);
  const expression = unwrap(declaration.initializer);
  assert.ok(ts.isArrayLiteralExpression(expression));
  return expression;
}

function property(row: ts.ObjectLiteralExpression, name: string): ts.PropertyAssignment {
  return one(row.properties.filter(ts.isPropertyAssignment).filter((node) =>
    (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) && node.name.text === name), `${name} property`);
}

function stringLiteral(row: ts.ObjectLiteralExpression, name: string): ts.StringLiteral {
  const value = property(row, name).initializer;
  assert.ok(ts.isStringLiteral(value), `${name} must be an actual TypeScript string literal`);
  return value;
}

function dataRow(array: ts.ArrayLiteralExpression, key: string, value: string): ts.ObjectLiteralExpression {
  const rows = array.elements.map((item) => {
    const node = unwrap(item);
    assert.ok(ts.isObjectLiteralExpression(node));
    return node;
  });
  return one(rows.filter((row) => stringLiteral(row, key).text === value), `${value} data row`);
}

type PrimitiveElement = React.ReactElement<{
  children?: React.ReactNode; href?: string; className?: string; "aria-labelledby"?: string;
}>;
type Projection = { element: PrimitiveElement; html: string };

function elements(root: React.ReactNode, tag: string): PrimitiveElement[] {
  const result: PrimitiveElement[] = [];
  for (const child of React.Children.toArray(root)) {
    if (!React.isValidElement(child)) continue;
    const element = child as PrimitiveElement;
    if (element.type === tag) result.push(element);
    result.push(...elements(element.props.children, tag));
  }
  return result;
}

function visibleText(root: React.ReactNode): string {
  return normalize(React.Children.toArray(root).map((child): string => {
    if (React.isValidElement(child)) return visibleText((child as PrimitiveElement).props.children);
    return String(child);
  }).join(""));
}

function project(source: ParsedSource, id: string, node: ts.JsxElement, data?: ts.ArrayLiteralExpression): Projection {
  const declarations = data ? `const BETTER = ${data.getText(source.ast)};\n` : "";
  const input = `const Link = "a";\n${declarations}export const projected = (\n${node.getText(source.ast)}\n);\n`;
  const compiled = ts.transpileModule(input, {
    fileName: `${id}.tsx`, reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  });
  const errors = (compiled.diagnostics ?? []).filter((item) => item.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, `Structural projection compile errors: ${id}`);
  const exported: { projected?: PrimitiveElement } = {};
  new Script(compiled.outputText, { filename: `${source.consumedPath}#${id}.structural.cjs` }).runInNewContext({
    exports: exported,
    require: (specifier: string) => {
      assert.equal(specifier, "react/jsx-runtime", "Projection may load only the React JSX runtime");
      return nativeRequire(specifier) as unknown;
    },
  });
  assert.ok(React.isValidElement(exported.projected), `Projection must produce JSX: ${id}`);
  const element = exported.projected as PrimitiveElement;
  const html = renderToStaticMarkup(element);
  compileObservations.push({
    id, control: "AST-bound primitive JSX/data projection; not a production-page render",
    source_relative_path: source.relativePath, consumed_path: source.consumedPath,
    jsx_start: node.getStart(source.ast), jsx_end: node.end, jsx_sha256: sha256(node.getText(source.ast)),
    data_start: data?.getStart(source.ast), data_end: data?.end, data_sha256: data ? sha256(data.getText(source.ast)) : undefined,
    compile_input_sha256: sha256(input), compiled_output_sha256: sha256(compiled.outputText), compile_error_count: errors.length,
    rendered_html: html, rendered_html_sha256: sha256(html), visible_text: visibleText(element),
    executed_production_imports: [],
  });
  return { element, html };
}

function homeLink(source: ParsedSource, returned: ts.JsxElement): ts.JsxElement {
  const branding = one(descendants(returned, ts.isJsxElement).filter((node) =>
    node.openingElement.tagName.getText(source.ast) === "div" &&
    attribute(node, "className") === "mb-8 flex items-center gap-2 font-semibold tracking-wide"), "home branding container");
  return one(descendants(branding, ts.isJsxElement).filter((node) =>
    node.openingElement.tagName.getText(source.ast) === "Link" && attribute(node, "href") === "/"), "local home Link");
}

function invitation(source: ParsedSource, returned: ts.JsxElement, href: string): ts.JsxElement {
  return one(descendants(returned, ts.isJsxElement).filter((node) =>
    node.openingElement.tagName.getText(source.ast) === "p" && attribute(node, "className") === "mt-6 text-sm text-slate-300" &&
    descendants(node, ts.isJsxElement).some((child) => child.openingElement.tagName.getText(source.ast) === "Link" && attribute(child, "href") === href)), `${href} invitation paragraph`);
}

const comparison = parsedSource(requiredPaths[0]);
const signin = parsedSource(requiredPaths[1]);
const signup = parsedSource(requiredPaths[2]);
const comparisonReturn = returnedJsx(comparison, "ComparisonPage");
const betterSection = section(comparison, comparisonReturn, "better");
const betterData = dataArray(comparison, "BETTER");
const licensingTitle = "Open-source libraries can be read, changed and run without a vendor";
const licensingBody = stringLiteral(dataRow(betterData, "title", licensingTitle), "body");
const betterMap = one(descendants(betterSection, ts.isCallExpression).filter((node) =>
  ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.expression) &&
  node.expression.expression.text === "BETTER" && node.expression.name.text === "map"), "BETTER.map rendering position");
const callback = betterMap.arguments[0];
assert.ok(callback);
assert.ok(ts.isArrowFunction(callback));
assert.ok(!ts.isBlock(callback.body));
const callbackBody = unwrap(callback.body);
assert.ok(ts.isJsxElement(callbackBody));
assert.equal(callback.parameters[0].name.getText(comparison.ast), "b");
const bodyPosition = one(descendants(callbackBody, ts.isJsxElement).filter((node) => node.openingElement.tagName.getText(comparison.ast) === "p"), "BETTER row paragraph");
const bodyExpression = one(bodyPosition.children.filter(ts.isJsxExpression), "BETTER paragraph expression");
assert.ok(bodyExpression.expression && ts.isPropertyAccessExpression(bodyExpression.expression));
assert.equal(bodyExpression.expression.expression.getText(comparison.ast), "b");
assert.equal(bodyExpression.expression.name.text, "body");
const betterProjection = project(comparison, "comparison-better", betterSection, betterData);
const licensingRow = one(elements(betterProjection.element, "li").filter((row) =>
  visibleText(one(elements(row, "h3"), "rendered row title")) === licensingTitle), "rendered licensing row");
const licensingParagraph = one(elements(licensingRow, "p"), "rendered licensing paragraph");
const optionRow = dataRow(dataArray(comparison, "OPTIONS"), "name", "SoterAI");
const optionTerms = stringLiteral(optionRow, "terms");
const optionSource = property(optionRow, "source").initializer;
assert.ok(ts.isJsxElement(optionSource));
const optionProjection = project(comparison, "comparison-option-source", optionSource);
const optionsSection = section(comparison, comparisonReturn, "options");
const table = one(descendants(optionsSection, ts.isJsxSelfClosingElement).filter((node) => node.tagName.getText(comparison.ast) === "DataTable"), "options DataTable");
const rowsAttribute = one(table.attributes.properties.filter(ts.isJsxAttribute).filter((node) => node.name.getText(comparison.ast) === "rows"), "table rows binding");
assert.ok(rowsAttribute.initializer && ts.isJsxExpression(rowsAttribute.initializer) && rowsAttribute.initializer.expression);
assert.equal(rowsAttribute.initializer.expression.getText(comparison.ast), "OPTIONS");
const signinReturn = returnedJsx(signin, "SignInPage");
const signupReturn = returnedJsx(signup, "SignUpPage");
const signinHome = homeLink(signin, signinReturn);
const signupHome = homeLink(signup, signupReturn);
const signinHomeProjection = project(signin, "signin-home-link", signinHome);
const signupHomeProjection = project(signup, "signup-home-link", signupHome);
const welcome = invitation(signin, signinReturn, "/signup");
const welcomeProjection = project(signin, "signin-welcome", welcome);
const signupInvitation = invitation(signup, signupReturn, "/signin");
const signupInvitationProjection = project(signup, "signup-invitation", signupInvitation);

console.log("SOTER_BRANDING_REPAIR_OBSERVATION " + JSON.stringify({
  mode: MODE, cwd: ROOT, dependency_root: path.join(ROOT, "node_modules"),
  native_exec_path: process.execPath, native_process_argv: process.argv,
  scratch_environment: { TEMP: process.env.TEMP, TMP: process.env.TMP, TMPDIR: process.env.TMPDIR },
  structural_control: true, production_render_validation: "parent-owned; not performed by this fixture",
  compiler_path: nativeRequire.resolve("typescript"), compiler_sha256: sha256(readFileSync(nativeRequire.resolve("typescript"))),
  regression_path: realpathSync(path.join(ROOT, "tests/site-branding-comparison.test.ts")),
  regression_sha256: sha256(readFileSync(path.join(ROOT, "tests/site-branding-comparison.test.ts"))),
  authorities: authorityObservations, sources: sourceObservations, projections: compileObservations,
  ast_literals: {
    licensing_body: licensingBody.text,
    signin_home_text: signinHome.children.filter(ts.isJsxText).map((node) => node.text),
    signin_accent_text: one(descendants(signinHome, ts.isJsxElement).filter((node) => node.openingElement.tagName.getText(signin.ast) === "span"), "sign-in accent").children.filter(ts.isJsxText).map((node) => node.text),
    signup_home_text: signupHome.children.filter(ts.isJsxText).map((node) => node.text),
    welcome_text: normalize(welcome.children.filter(ts.isJsxText).map((node) => node.text).join("")),
  },
}));

const prefix = "Guardrails AI and NeMo Guardrails are Apache-2.0 code you can audit and fork.";
const qualificationSuffix = " server is proprietary. Some of its published packages keep their own licenses.";

test("BRAND-REPAIR-01 comparison BETTER licensing paragraph displays SoterAI", () => {
  const expected = `${prefix} The SoterAI${qualificationSuffix}`;
  assert.equal(visibleText(licensingParagraph), expected, "Rendered licensing paragraph must display SoterAI");
  assert.equal(licensingBody.text, expected, "Actual BETTER.body AST literal must display SoterAI");
  assert.ok(betterProjection.html.includes(renderToStaticMarkup(licensingParagraph)));
});

test("BRAND-REPAIR-02 comparison licensing qualifications remain exact", () => {
  for (const value of [licensingBody.text, visibleText(licensingParagraph)]) {
    assert.equal(value.slice(0, prefix.length), prefix);
    assert.equal(value.slice(value.indexOf(" server is proprietary.")), qualificationSuffix);
  }
});

test("BRAND-REPAIR-03 comparison product terms and limits destination remain exact", () => {
  assert.equal(optionTerms.text, "Proprietary server. Free plan; paid plans are priced in Indian rupees. Buyers outside India should confirm payment methods and eligibility with sales. Self-hosting with Docker, Postgres and Redis.");
  assert.equal(attribute(optionSource, "href"), "/limitations");
  assert.equal(optionProjection.element.props.href, "/limitations");
  assert.equal(visibleText(optionProjection.element), "Our own limits page");
  assert.equal(optionProjection.html, '<a class="sa-link" href="/limitations">Our own limits page</a>');
});

function assertHomeBrand(source: ParsedSource, node: ts.JsxElement, projection: Projection): void {
  assert.equal(visibleText(projection.element), "SoterAI", "Rendered local home label must display SoterAI");
  assert.equal(normalize(node.children.filter(ts.isJsxText).map((child) => child.text).join("")), "Soter");
  const accent = one(descendants(node, ts.isJsxElement).filter((child) => child.openingElement.tagName.getText(source.ast) === "span"), "AST accent span");
  assert.equal(normalize(accent.children.filter(ts.isJsxText).map((child) => child.text).join("")), "AI");
  assert.ok(projection.html.includes('<span class="text-cyan">AI</span>'));
}

function assertHomeControls(node: ts.JsxElement, projection: Projection): void {
  assert.equal(attribute(node, "href"), "/");
  assert.equal(attribute(node, "className"), "font-mono");
  assert.equal(projection.element.type, "a");
  assert.equal(projection.element.props.href, "/");
  assert.equal(projection.element.props.className, "font-mono");
  assert.equal(one(elements(projection.element, "span"), "rendered accent span").props.className, "text-cyan");
}

test("BRAND-REPAIR-04 sign-in home link displays SoterAI", () => {
  assertHomeBrand(signin, signinHome, signinHomeProjection);
});

test("BRAND-REPAIR-05 sign-in home link retains local destination and accent classes", () => {
  assertHomeControls(signinHome, signinHomeProjection);
});

test("BRAND-REPAIR-06 sign-up home link displays SoterAI", () => {
  assertHomeBrand(signup, signupHome, signupHomeProjection);
});

test("BRAND-REPAIR-07 sign-up home link retains local destination and accent classes", () => {
  assertHomeControls(signupHome, signupHomeProjection);
});

test("BRAND-REPAIR-08 sign-in welcome prompt displays SoterAI", () => {
  assert.equal(visibleText(welcomeProjection.element), "New to SoterAI? Create an account", "Rendered welcome prompt must display SoterAI");
  assert.equal(normalize(welcome.children.filter(ts.isJsxText).map((node) => node.text).join("")), "New to SoterAI?");
});

test("BRAND-REPAIR-09 sign-in create-account link retains signup destination", () => {
  const link = one(elements(welcomeProjection.element, "a"), "welcome create-account anchor");
  assert.equal(link.props.href, "/signup");
  assert.equal(visibleText(link), "Create an account");
  assert.equal(link.props.className, "text-cyan underline underline-offset-2 hover:text-cyan/80");
});

test("BRAND-REPAIR-10 sign-up invitation retains sign-in destination", () => {
  const link = one(elements(signupInvitationProjection.element, "a"), "signup sign-in anchor");
  assert.equal(link.props.href, "/signin");
  assert.equal(visibleText(signupInvitationProjection.element), "Already have an account? Sign in");
  assert.equal(visibleText(link), "Sign in");
  assert.equal(link.props.className, "text-cyan underline underline-offset-2 hover:text-cyan/80");
});
