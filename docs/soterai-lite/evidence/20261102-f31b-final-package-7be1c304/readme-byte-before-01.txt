TAP version 13
#  WARNING  Neither a .vscodeignore file nor a "files" property in package.json was found. To ensure only necessary files are included in your extension, add a .vscodeignore file or specify the "files" property in package.json. More info: https://aka.ms/vscode-vscodeignore
#  INFO  Files included in the VSIX:
# package-candidate.vsix
# ├─ [Content_Types].xml 
# ├─ extension.vsixmanifest 
# └─ extension/
#    ├─ LICENSE.md [4.39 KB]
#    ├─ PRIVACY.md [0.03 KB]
#    ├─ SBOM.cdx.json [2.33 KB]
#    ├─ THIRD-PARTY-NOTICES.md [0.29 KB]
#    ├─ changelog.md [4 KB]
#    ├─ package.json [0.83 KB]
#    ├─ readme.md [23.52 KB]
#    ├─ dist/
#    │  ├─ extension.js [0.02 KB]
#    │  ├─ local-ai-broker.js [0.02 KB]
#    │  ├─ pre-commit-client.js [0.02 KB]
#    │  └─ soterai-mcp-server.js [0.02 KB]
#    └─ media/
#       ├─ icon.svg [0.04 KB]
#       ├─ logo_circle_whiter.png [0.05 KB]
#       └─ walkthrough/
#          ├─ demo.md [0.05 KB]
#          ├─ integrate.md [0.05 KB]
#          └─ vault.md [0.05 KB]
#  DONE  Packaged: C:\\Users\\USER\\AppData\\Local\\Temp\\soterai-f31b-synthetic-VKzUAZ\\packages\\soterai-lite\\builds\\synthetic\\package-candidate.vsix (18 files, 7.15 KB)
# Subtest: F31b preserves reviewed README relative-link bytes with GitHub repository metadata
not ok 1 - F31b preserves reviewed README relative-link bytes with GitHub repository metadata
  ---
  duration_ms: 2797.656
  type: 'test'
  location: 'C:\\Users\\USER\\OneDrive\\Desktop\\Ai-Agent-Security-Guard\\docs\\soterai-lite\\evidence\\20261102-f31b-final-package-7be1c304\\readme-byte-review-01.test.cjs:4:1'
  failureType: 'testCodeFailure'
  error: 'Final asset changed or provenance mismatch'
  code: 'ERR_TEST_FAILURE'
  stack: |-
    demand (C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard\packages\soterai-lite\scripts\audit-release.cjs:13:42)
    verifyFinal (C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard\packages\soterai-lite\scripts\audit-release.cjs:114:543)
    async auditRelease (C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard\packages\soterai-lite\scripts\audit-release.cjs:135:27)
    async Object.packageBuild (C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard\packages\soterai-lite\scripts\package.cjs:34:16)
    async TestContext.<anonymous> (C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard\docs\soterai-lite\evidence\20261102-f31b-final-package-7be1c304\readme-byte-review-01.test.cjs:8:63)
    async Test.run (node:internal/test_runner/test:1054:7)
    async startSubtestAfterBootstrap (node:internal/test_runner/harness:296:3)
  ...
1..1
# tests 1
# suites 0
# pass 0
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 3008.1019
