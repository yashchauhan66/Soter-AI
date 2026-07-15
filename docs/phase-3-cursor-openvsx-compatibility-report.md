# Phase 3 Cursor / OpenVSX Compatibility Report

## Cursor

| Check | Result |
| --- | --- |
| Cursor CLI available | PASS, `3.10.17` |
| VSIX isolated install | PASS |
| Extension list verification | PASS, `soterai.soterai-ide-guard@0.2.0` |
| Command/webview visual runtime | EVIDENCE REQUIRED |

## VSCodium / OpenVSX

| Check | Result |
| --- | --- |
| VSCodium CLI | Not installed |
| Engine version | `^1.85.0`; compatible with VS Code-family hosts that support this API level |
| Microsoft-only API dependency | No Marketplace-only runtime API found in reviewed extension source |
| OpenVSX package readiness | Package artifact is clean and should be package-compatible |
| OpenVSX publish readiness | YES, after account/token workflow and optional VSCodium visual check |

## Decision

Cursor-compatible distribution: YES for VSIX install compatibility; visual runtime evidence still required.

OpenVSX readiness: YES for package readiness; live OpenVSX publish/account action and VSCodium runtime remain external evidence.

