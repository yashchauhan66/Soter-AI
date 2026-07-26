import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  SOTERAI_API_VERSION,
  SOTERAI_CONTRACT_VERSION,
} from "../lib/apiContract";

test("OpenAPI v1 contract validates against the SDK routes", () => {
  const output = execFileSync(process.execPath, ["scripts/validate-api-contract.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  const result = JSON.parse(output);
  assert.equal(result.ok, true);
  assert.equal(result.apiVersion, SOTERAI_API_VERSION);
  assert.equal(result.contractVersion, SOTERAI_CONTRACT_VERSION);
  assert.ok(result.sdkEndpointCount >= 20);
});

test("OpenAPI spec exposes guard schemas and version headers", () => {
  const spec = JSON.parse(readFileSync("docs/api/openapi.v1.json", "utf8"));
  assert.equal(spec.openapi, "3.1.0");
  assert.equal(spec.info.version, SOTERAI_API_VERSION);
  assert.equal(spec.info["x-contract-version"], SOTERAI_CONTRACT_VERSION);
  assert.equal(spec.paths["/api/guard/input"].post.requestBody.$ref, "#/components/requestBodies/GuardInput");
  assert.equal(spec.components.schemas.GuardInputRequest.required[0], "message");
  assert.equal(spec.components.responses.GuardResult.headers["X-SoterAI-API-Version"].schema.const, SOTERAI_API_VERSION);
  assert.equal(spec.components.responses.GuardResult.headers["X-SoterAI-Contract-Version"].schema.const, SOTERAI_CONTRACT_VERSION);
});

test("/api/openapi serves the contract with no-store version headers", async () => {
  const { GET } = await import("../app/api/openapi/route");
  const response = await GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-soterai-api-version"), SOTERAI_API_VERSION);
  assert.equal(response.headers.get("x-soterai-contract-version"), SOTERAI_CONTRACT_VERSION);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  const body = await response.json();
  assert.equal(body.info.version, SOTERAI_API_VERSION);
});
