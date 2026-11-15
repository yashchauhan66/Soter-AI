import assert from "node:assert/strict";
import { test } from "node:test";
import { powerShell7Candidates, resolvePowerShell7, POWERSHELL7_SYSTEM_EXECUTABLE } from "../terminal/PowerShell7Runtime";

test("PS7 resolves the system installation before the fixed per-user installation", () => {
    const local = "C:\\Users\\example\\AppData\\Local";
    const paths = powerShell7Candidates(local);
    assert.deepEqual(paths, [POWERSHELL7_SYSTEM_EXECUTABLE, local + "\\Programs\\PowerShell\\7\\pwsh.exe"]);
    assert.equal(resolvePowerShell7(local, () => true), paths[0]);
    assert.equal(resolvePowerShell7(local, file => file === paths[1]), paths[1]);
    assert.equal(resolvePowerShell7(local, () => false), paths[0]);
});
test("PS7 lookup rejects network, relative, traversal, control and malformed environment paths", () => {
    for (const local of [undefined, 3, "relative", "\\\\server\\share", "C:\\owner\\..\\repo", "C:\\owner\\.\\repo", "C:/owner", "C:\\owner\0bad", "C:\\owner\\\\repo"]) {
        assert.deepEqual(powerShell7Candidates(local), [POWERSHELL7_SYSTEM_EXECUTABLE]);
    }
});
