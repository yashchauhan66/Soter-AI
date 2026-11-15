import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";
import { mergePassportPolicy } from "../lib/agent-passport";
import { getServiceExperience } from "../lib/docs/serviceExperience";

// Inspect the real issuer's returned AST, but never import its DB-backed module
// or issue a token. Only the pure policy normalization function is executed.
const serverPath = resolve(process.cwd(), "lib/agent-passport/server.ts");
const source = ts.createSourceFile(serverPath, readFileSync(serverPath, "utf8"), ts.ScriptTarget.Latest, true);
const issuer = source.statements.find((node): node is ts.FunctionDeclaration =>
  ts.isFunctionDeclaration(node) && node.name?.text === "issueAgentPassport");
assert.ok(issuer?.body, "The documented issuer must exist");
const policyDeclaration = issuer.body.statements.flatMap((node) =>
  ts.isVariableStatement(node) ? [...node.declarationList.declarations] : [])
  .find((node) => ts.isIdentifier(node.name) && node.name.text === "policy");
assert.ok(policyDeclaration?.initializer && ts.isCallExpression(policyDeclaration.initializer));
assert.equal(policyDeclaration.initializer.expression.getText(source), "mergePassportPolicy");
const policyFields = Object.keys(mergePassportPolicy({}, {}));
const returned = issuer.body.statements.filter(ts.isReturnStatement).at(-1)?.expression;
assert.ok(returned && ts.isCallExpression(returned));
assert.equal(returned.expression.getText(source), "jsonResponse");
const payload = returned.arguments[0];
const options = returned.arguments[1];
assert.ok(payload && ts.isObjectLiteralExpression(payload));
assert.ok(options && ts.isObjectLiteralExpression(options));
const status = options.properties.find((node) =>
  ts.isPropertyAssignment(node) && node.name.getText(source) === "status");
assert.ok(status && ts.isPropertyAssignment(status));
assert.equal(status.initializer.getText(source), "201");
const responseFields = new Set<string>();
for (const property of payload.properties) {
  if (ts.isSpreadAssignment(property)) {
    assert.equal(property.expression.getText(source), "policy", "Unexpected response spread needs explicit review");
    for (const field of policyFields) responseFields.add(field);
  } else {
    assert.ok(ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property));
    assert.ok(ts.isIdentifier(property.name));
    responseFields.add(property.name.text);
  }
}
const note = getServiceExperience("agent-passports").integrationNotes.find((value) =>
  value.startsWith("The route returns HTTP 201 with "));
assert.ok(note, "The issuance response must be described");
const fieldList = note.match(/^The route returns HTTP 201 with ([^.]+)\./)?.[1];
assert.ok(fieldList, "The named response-field list must be explicit");
const documentedFields = fieldList.replace(/\band\s+/g, "").split(",").map((field) => field.trim());

test("passport issuance response fields are derived from the actual top-level return", () => {
  assert.ok(responseFields.has("passportToken"));
  assert.ok(responseFields.has("expiresAt"));
  assert.equal(responseFields.has("policy"), false);
  assert.equal(responseFields.has("expiry"), false);
});

test("SP-01 every documented issuance response property exists on the actual response", () => {
  assert.deepEqual(documentedFields.filter((field) => !responseFields.has(field)), []);
});

test("SP-01 issuance guidance names all normalized policy fields at the top level", () => {
  assert.deepEqual(policyFields.filter((field) => !documentedFields.includes(field)), []);
  assert.match(note, /Policy fields are top-level, not a nested policy object\./);
});

test("SP-01 issuance guidance uses the actual expiresAt property name", () => {
  assert.ok(documentedFields.includes("expiresAt"));
});
