# SoterAI IDE Guard for JetBrains IDEs

Early adapter implementation. It uses platform-level IntelliJ APIs and the authenticated loopback Local AI Broker; detector and policy logic remain in the shared SoterAI engine.

Current slice: scan selection, scan current file, redact selection, Safe Mode toggle, Password Safe token storage, broker/ledger tool window, settings page, and status widget.

This repository does not yet claim JetBrains support. Build, clean-profile installation, broker integration, UI smoke, per-product Plugin Verifier, and canary privacy evidence are required first.

```powershell
.\gradlew.bat buildPlugin
```

The plugin distribution is produced under `build/distributions`.

