import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAllDocuments } from "yaml";
const VALUE = "TEST_ONLY_F22B_PRIVATE_6da310e8", GENERATION = "22000000-0000-4000-8000-000000000002";
async function module() { const m = await import("../config-scanners/ContainerSecretPlan"); assert.equal(typeof m.createContainerSecretPlan, "function"); return m; }
async function plan(text: string, format = "yaml", generation = GENERATION) { return (await module()).createContainerSecretPlan(text, format as never, generation); }
const safeError = (e: unknown) => !String(e).includes(VALUE);
function validYaml(text: string) { const docs = parseAllDocuments(text); for (const d of docs) assert.equal(d.errors.length, 0); return docs; }

test("F22b selected-file mapping is bounded to declared container formats and safe relative paths", async () => {
    const { containerFormatForPath } = await module();
    for (const file of ["Dockerfile", "docker/Dockerfile.dev", "build/prod.Dockerfile"]) assert.equal(containerFormatForPath(file), "dockerfile");
    for (const file of ["compose.yml", "docker-compose.prod.yaml", "k8s/deployment.YAML"]) assert.equal(containerFormatForPath(file), "yaml");
    for (const file of ["a.ts", "a.tfvars", "Dockerfile.txt.bak"]) assert.equal(containerFormatForPath(file), undefined);
    for (const file of ["../Dockerfile", "C:/compose.yml", "a\\k8s.yml", "/deployment.yaml", "a//b.yaml"]) assert.throws(() => containerFormatForPath(file), safeError);
});
test("F22b Compose nested environment and build args preserve public configuration with safe YAML replacements", async () => {
    const text = 'services:\n  api:\n    image: public-image:1\n    ports: ["3000:3000"]\n    environment:\n      apiKey: "' + VALUE + '"\n      MONKEY: banana\n      PORT: "3000"\n    build:\n      context: .\n      args:\n        SERVICE_TOKEN: ' + VALUE + '-build\n';
    const result = await plan(text); assert.equal(result.candidates.length, 2); assert.equal(result.restoreMode, "checkpoint"); assert.equal(result.exampleText, ""); assert(!result.maskedText.includes(VALUE)); validYaml(result.maskedText); assert.match(result.maskedText, /MONKEY: banana/); assert.match(result.maskedText, /public-image:1/);
    for (const c of result.candidates) { assert.equal(text.slice(c.start, c.end), c.replacementText); assert.match(c.placeholder, /^\[SOTERAI_PROTECTED_[A-Z0-9_]+\]$/); }
});
test("F22b Compose list assignments retain variable names and quoted escape values are logical privately", async () => {
    const text = 'services:\n  api:\n    environment:\n      - API_KEY=' + VALUE + '\n      - PORT=3000\n      - "PASSWORD=first\\n' + VALUE + '\\u0021"\n';
    const result = await plan(text); assert.equal(result.candidates.length, 2); assert.equal(result.candidates[1].rawValue, "first\n" + VALUE + "!"); assert(!result.maskedText.includes(VALUE)); const object = validYaml(result.maskedText)[0].toJS(); assert.match(object.services.api.environment[0], /^API_KEY=\[SOTERAI_PROTECTED_/); assert.equal(object.services.api.environment[1], "PORT=3000"); assert.match(object.services.api.environment[2], /^PASSWORD=\[SOTERAI_PROTECTED_/);
});
test("F22b Kubernetes container env name/value pairs carry credential ownership without treating public ports as secrets", async () => {
    const text = 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: public-api\nspec:\n  template:\n    spec:\n      containers:\n        - name: api\n          image: public-image:1\n          env:\n            - name: PASSWORD\n              value: ' + VALUE + '\n            - name: PORT\n              value: "3000"\n';
    const result = await plan(text); assert.equal(result.candidates.length, 1); assert.equal(result.candidates[0].rawValue, VALUE); assert(!result.maskedText.includes(VALUE)); assert.equal(validYaml(result.maskedText)[0].toJS().kind, "Deployment");
});
test("F22b Secret stringData and canonical base64 data use valid protected markers with no original encoded copy", async () => {
    const encoded = Buffer.from(VALUE).toString("base64"), text = 'apiVersion: v1\nkind: Secret\nmetadata:\n  name: synthetic-secret\nstringData:\n  arbitrary: ' + VALUE + '-plain\ndata:\n  arbitrary: ' + encoded + '\n';
    const result = await plan(text); assert.equal(result.candidates.length, 2); assert(!result.maskedText.includes(VALUE)); assert(!result.maskedText.includes(encoded)); const object = validYaml(result.maskedText)[0].toJS(); assert.match(Buffer.from(object.data.arbitrary, "base64").toString("utf8"), /^\[SOTERAI_PROTECTED_/); assert.equal(result.restoreMode, "checkpoint"); assert.equal((await plan(result.maskedText)).candidates.length, 0);
});
test("F22b YAML multiline values and actual comment candidates are bounded and remain syntactically valid", async () => {
    const text = '# API_KEY=' + VALUE + '-comment\nservices:\n  api:\n    environment:\n      PASSWORD: |-\n        first\n        ' + VALUE + '\n        last\n      PORT: 3000\n';
    const result = await plan(text); assert.equal(result.candidates.length, 2); assert(result.candidates.some(c => c.rawValue === "first\n" + VALUE + "\nlast")); assert(!result.maskedText.includes(VALUE)); validYaml(result.maskedText);
});
test("F22b explicit templates, protected markers and identified public publishable keys remain useful controls", async () => {
    const text = 'services:\n  api:\n    environment:\n      API_KEY: "${API_KEY}"\n      TOKEN: YOUR_TOKEN_HERE\n      PASSWORD: "[SOTERAI_PROTECTED_EXISTING]"\n      STRIPE_PUBLISHABLE_KEY: pk_test_F22BPUBLICONLY123456\n      MONKEY: banana\n';
    const result = await plan(text); assert.equal(result.candidates.length, 0); assert.equal(result.maskedText, text);
});
test("F22b malformed, ambiguous, aliased, tagged and foreign YAML withholds without values in errors", async () => {
    await module();
    for (const text of ['services: [', 'services:\n  api:\n    environment:\n      API_KEY: ' + VALUE + '\n      API_KEY: duplicate\n', 'services:\n  api: &a {environment: {API_KEY: ' + VALUE + '}}\n  other: *a\n', 'services:\n  api:\n    environment:\n      API_KEY: !unknown ' + VALUE + '\n', 'services:\n  api:\n    <<: {environment: {API_KEY: ' + VALUE + '}}\n', 'foreign:\n  API_KEY: ' + VALUE + '\n']) await assert.rejects(plan(text), safeError);
});
test("F22b encoded noncanonical/binary Secret data and dynamic fallback credentials remain unsupported", async () => {
    await module();
    for (const encoded of ["%%%", "QQ", Buffer.from([0xff, 0x00]).toString("base64")]) await assert.rejects(plan('apiVersion: v1\nkind: Secret\nmetadata: {name: synthetic}\ndata:\n  token: ' + encoded + '\n'), safeError);
    await assert.rejects(plan('services:\n  api:\n    environment:\n      API_KEY: "${API_KEY:-' + VALUE + '}"\n'), safeError);
});
test("F22b bounded Kubernetes multi-document parsing includes each document and refuses foreign extras", async () => {
    const secret = 'apiVersion: v1\nkind: Secret\nmetadata: {name: synthetic}\nstringData: {password: ' + VALUE + '}\n', service = 'apiVersion: v1\nkind: Service\nmetadata: {name: public}\nspec: {ports: [{port: 3000}]}\n';
    const result = await plan(service + '---\n' + secret); assert.equal(result.candidates.length, 1); assert.equal(validYaml(result.maskedText).length, 2); await assert.rejects(plan(service + '---\nforeign: value\n'), safeError); await assert.rejects(plan(Array(17).fill(service).join('---\n')), safeError);
});
test("F22b Docker ENV/ARG static quoting and continuation preserve exact per-entry restoration", async () => {
    const text = 'FROM public-image:1\nARG API_KEY="' + VALUE + '"\nENV PORT=3000 PASSWORD="first ' + VALUE + ' last" \\\n    TOKEN=' + VALUE + '-token\nRUN echo public-control\n';
    const result = await plan(text, "dockerfile"); assert.equal(result.candidates.length, 3); assert(!result.maskedText.includes(VALUE)); assert.match(result.maskedText, /PORT=3000/); let restored = result.maskedText; for (const c of result.candidates) restored = restored.split(c.placeholder).join(c.replacementText); assert.equal(restored, text);
});
test("F22b malformed/unsupported Dockerfile and input/work/finding limits refuse safely", async () => {
    await module();
    for (const text of ['ENV API_KEY="' + VALUE + '\n', 'ENV API_KEY=${API_KEY:-' + VALUE + '}\n', 'RUN <<EOF\n' + VALUE + '\nEOF\n', 'NOT_AN_INSTRUCTION value\n']) await assert.rejects(plan(text, "dockerfile"), safeError);
    for (const text of ['P'.repeat(65537), 'services:\0', 'services:\n  api:\n    environment: {API_KEY: "\ud800"}\n', 'services:\n  api:\n    environment:\n' + Array.from({ length: 129 }, (_, i) => '      API_KEY_' + i + ': ' + VALUE + i + '\n').join('')]) await assert.rejects(plan(text), safeError);
});
test("F22b config parsing never evaluates commands and residual original copies withhold migration", async () => {
    (globalThis as any).__f22bExecuted = false;
    const result = await plan('services:\n  api:\n    command: "globalThis.__f22bExecuted=true"\n    ports: ["3000:3000"]\n'); assert.equal(result.candidates.length, 0); assert.equal((globalThis as any).__f22bExecuted, false); delete (globalThis as any).__f22bExecuted;
    await assert.rejects(plan('services:\n  api:\n    environment: {API_KEY: ' + VALUE + '}\n    description: ' + VALUE + '\n'), safeError);
});

test("F22b public protocol field names cannot exempt a known credential shape embedded in their values", async () => {
    await module(); const syntheticAccessId = "AKIA" + "A1".repeat(8);
    await assert.rejects(plan('apiVersion: ' + syntheticAccessId + '/v1\nkind: Service\nmetadata: {name: public}\nspec: {ports: [{port: 3000}]}\n'), e => !String(e).includes(syntheticAccessId));
});
