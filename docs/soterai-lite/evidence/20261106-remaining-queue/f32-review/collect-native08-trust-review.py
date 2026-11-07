"""Read fixed closed-run trust metadata; write one new review, never the profile."""
import datetime
import hashlib
import json
import pathlib
import sqlite3

RUN = pathlib.Path(r"D:\SoterAI-Lite-test-profiles\f32-installed-20261106T133825Z-69ab4706")
PROFILE = RUN / "profile-primary"
GATE = PROFILE / "F32Gate" / "primary"
VENDOR = pathlib.Path(r"C:\Users\USER\AppData\Local\Programs\Microsoft VS Code\6bab64e2d1\resources\app\out\vs\workbench\workbench.desktop.main.js")


def fact(file):
    raw = file.read_bytes()
    return {"path": str(file), "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}


def main():
    names = ["primary-code-owned-start.json", "primary-trust-before.json",
             "primary-trust-grant-observation.json", "primary-observer-failure.json",
             "primary-code-owned-close.json", "primary-listener-custody-owned-start.json",
             "primary-listener-custody-owned-close.json"]
    values = {name: json.loads((GATE / name).read_text(encoding="utf-8-sig")) for name in names}
    before = values["primary-trust-before.json"]
    grant = values["primary-trust-grant-observation.json"]
    assert before["isTrusted"] is False and grant["isTrusted"] is True
    assert grant["keyboardIntentPresent"] is False and grant["keyboardReceiptPresent"] is False
    assert values["primary-code-owned-close.json"]["exitCode"] == 0
    assert values["primary-listener-custody-owned-close.json"]["exitCode"] == 1
    assert not (GATE / "primary-renderer-owned-start.json").exists()
    trust = []
    for file in sorted(PROFILE.rglob("state.vscdb")):
        connection = sqlite3.connect(file.as_uri() + "?mode=ro", uri=True)
        try:
            rows = connection.execute("SELECT key,value FROM ItemTable WHERE lower(key) LIKE '%trust%'").fetchall()
            trust.append({"file": fact(file), "rows": [
                {"key": key, "value": value.decode() if isinstance(value, bytes) else value}
                for key, value in rows]})
        finally:
            connection.close()
    source = VENDOR.read_text(encoding="utf-8")
    markers = ["skipDialogs(){", "async prompt(e){if(this.skipDialogs())", "loadTrustInfo(){",
               "calculateWorkspaceTrust(){", "doGetUriTrustInfo(e){", "async setParentFolderTrust(e){",
               "async doShowModal(e,t,i,n,r){", "async showModalOnStart(){"]
    snippets = []
    for marker in markers:
        offset = source.index(marker)
        snippets.append({"marker": marker, "pythonCharacterOffset": offset,
                         "excerpt": source[offset:offset + 850]})
    assert "mockDialogService" not in source
    settings = json.loads((PROFILE / "User" / "settings.json").read_text(encoding="utf-8-sig"))
    trust_settings = {key: settings[key] for key in ["security.workspace.trust.enabled",
        "security.workspace.trust.startupPrompt", "security.workspace.trust.emptyWindow", "window.dialogStyle"]}
    logfile = PROFILE / "logs" / "20261106T192756" / "main.log"
    storage_lines = [line for line in logfile.read_text(encoding="utf-8").splitlines()
                     if "shared storage" in line or "application shared storage" in line]
    result = {
        "schemaVersion": 1, "feature": "F32", "status": "REVIEW_ONLY_TRIGGER_NOT_ESTABLISHED",
        "observedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "runRoot": str(RUN), "nativeLaunches": 0, "signalsRequested": 0, "profileWrites": 0,
        "observations": [{"file": fact(GATE / name), "value": value} for name, value in values.items()],
        "trustDatabases": trust, "trustSettings": trust_settings,
        "mainLog": fact(logfile), "fixedStorageLogLines": storage_lines,
        "workbench": fact(VENDOR), "vendorExcerpts": snippets,
        "rendererStartPresent": False,
        "finding": "Fresh isolated workspace trust changed false to true before owned renderer launch. Stored trusted URI is the run parent; startupPrompt.shown is true. The retained evidence does not identify what completed the startup modal.",
        "userStatement": "Parent agent relayed explicit user confirmation that they did not touch, click, or press Enter in the test window.",
        "limits": ["No DOM input events, modal callback stack, or pre-grant storage writer trace was retained.",
                   "Source exclusions do not establish that every possible platform or external input path was absent.",
                   "No historical native success is transferred to this failed run."]
    }
    output = pathlib.Path(__file__).with_name("native08-trust-review-01.json")
    with output.open("x", encoding="utf-8", newline="\n") as stream:
        json.dump(result, stream, indent=2)
        stream.write("\n")
    print(json.dumps(fact(output)))


if __name__ == "__main__":
    main()
