import assert from "node:assert/strict";
import test from "node:test";
import { controlledEnvironment, controlledInvocation } from "../ControlledExecution";
import { analyzeControlledTerminalCommand } from "@soterai/guard-core";

test("content-emitting Git history and diff commands are denied before execution", () => {
    for (const command of ["git show HEAD:private.txt", "git log -p", "git diff", "git status --ignored", "git status --untracked-files=all"]) {
        assert.equal(analyzeControlledTerminalCommand(command).action, "DENY", command);
    }
});

test("controlled execution never resolves a program from the request, working directory or PATH", () => {
    assert.equal(controlledInvocation("git", ["status"], {}), undefined);
    assert.equal(controlledInvocation("git", ["status"], { git: "./fake-git" }), undefined);
    const invocation = controlledInvocation("git", ["status", "--short"], { git: process.execPath });
    assert.equal(invocation?.file, process.execPath);
    assert.deepEqual(invocation?.args, ["--no-pager", "--no-optional-locks", "-c", "core.fsmonitor=false", "-c", "core.hooksPath=", "-c", "submodule.recurse=false", "status", "--short", "--ignore-submodules=all"]);
    assert.equal(controlledInvocation("toString", [], {}), undefined);
});

test("controlled processes inherit neither credentials, hooks, config overrides nor a search path", () => {
    const clean = controlledEnvironment({ PATH: "attacker", NODE_OPTIONS: "--require attacker", AWS_SECRET_ACCESS_KEY: "synthetic",
        GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "core.fsmonitor", GIT_CONFIG_VALUE_0: "attacker", SystemRoot: "C:\\Windows" });
    assert.equal(clean.PATH, undefined);
    assert.equal(clean.NODE_OPTIONS, undefined);
    assert.equal(clean.AWS_SECRET_ACCESS_KEY, undefined);
    assert.equal(clean.GIT_CONFIG_COUNT, undefined);
    assert.equal(clean.SystemRoot, "C:\\Windows");
    assert.equal(clean.GIT_CONFIG_NOSYSTEM, "1");
});
