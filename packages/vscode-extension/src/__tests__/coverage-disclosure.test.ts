import "./phase2/register.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { COVERAGE_DISCLOSURE, operationalCoverage } from "../security/CoverageDisclosure";
test("coverage makes operational scope and same-user gaps explicit", () => {
    assert.match(COVERAGE_DISCLOSURE, /^Covers:/);
    assert.match(COVERAGE_DISCLOSURE, /Does not cover:.*same-user/);
    assert.match(COVERAGE_DISCLOSURE, /buffers.*clipboard.*screenshots/);
    assert.match(COVERAGE_DISCLOSURE, /UNTESTED/);
    assert.match(operationalCoverage("configured"), /Operational state: configured\. Verification: UNTESTED/);
});
