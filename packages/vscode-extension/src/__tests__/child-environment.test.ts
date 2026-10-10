import assert from "node:assert/strict";
import test from "node:test";
import { brokerChildEnvironment } from "../security/childEnvironment";

test("broker launch excludes credentials, preload hooks, proxy overrides, home and executable search paths", () => {
    const input = {
        SystemRoot: "C:\\Windows", TEMP: "C:\\Temp", LANG: "en_US.UTF-8",
        OPENAI_API_KEY: "synthetic-openai-secret", AWS_SECRET_ACCESS_KEY: "synthetic-aws-secret",
        PRIVATE_PARTNER_VALUE: "synthetic-arbitrary-secret", SOTERAI_BROKER_CONTROL_TOKEN: "inherited-controller",
        NODE_OPTIONS: "--require ./attacker.cjs", NODE_PATH: "./attacker", ELECTRON_RUN_AS_NODE: "0",
        HTTP_PROXY: "http://attacker.invalid", HTTPS_PROXY: "http://attacker.invalid", NODE_EXTRA_CA_CERTS: "./attacker.pem",
        PATH: "./attacker", HOME: "./private-home", USERPROFILE: "C:\\Private",
    };
    assert.deepEqual(brokerChildEnvironment(input), { SystemRoot: input.SystemRoot, TEMP: input.TEMP, LANG: input.LANG });
    assert.equal(input.OPENAI_API_KEY, "synthetic-openai-secret");
});

test("Windows environment names are matched without case sensitivity and no inherited objects are reused", () => {
    assert.deepEqual(brokerChildEnvironment({ SYSTEMROOT: "C:\\Windows", temp: "C:\\Temp" }), { SystemRoot: "C:\\Windows", TEMP: "C:\\Temp" });
    assert.deepEqual(brokerChildEnvironment({}), {});
});
