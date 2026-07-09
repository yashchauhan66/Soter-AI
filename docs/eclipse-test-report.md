# Eclipse plugin test report

See `extensions/eclipse/docs/eclipse-test-report.md` for the full test report and acceptance procedure.

Status: NOT RUN. The adapter source exists at `extensions/eclipse/` but has not been compiled with Tycho, installed in any Eclipse instance, or tested against a live broker. No PASS is recorded for any check.

## Verdict

**NOT RUN.** Build (`mvn -B clean verify`), clean-instance install, broker integration, and canary privacy test are all required before Eclipse can be described as supported. See `docs/cross-ide-final-report.md` for the platform verdict.
