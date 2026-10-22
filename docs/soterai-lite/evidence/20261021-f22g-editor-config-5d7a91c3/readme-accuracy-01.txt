TAP version 13
# Subtest: README accuracy
    # Subtest: names only commands that exist
    ok 1 - names only commands that exist
      ---
      duration_ms: 2.0289
      type: 'test'
      ...
    # Subtest: names only settings that exist, with the manifest's real defaults
    ok 2 - names only settings that exist, with the manifest's real defaults
      ---
      duration_ms: 0.6114
      type: 'test'
      ...
    # Subtest: does not advertise a version other than the one being published
    ok 3 - does not advertise a version other than the one being published
      ---
      duration_ms: 1.734
      type: 'test'
      ...
    # Subtest: points at a license file that ships in the VSIX
    ok 4 - points at a license file that ships in the VSIX
      ---
      duration_ms: 1.5013
      type: 'test'
      ...
    # Subtest: states the real count of machine-scoped settings
    not ok 5 - states the real count of machine-scoped settings
      ---
      duration_ms: 2.6712
      type: 'test'
      location: 'C:\\Users\\USER\\OneDrive\\Desktop\\Ai-Agent-Security-Guard\\packages\\vscode-extension\\src\\__tests__\\readme-accuracy.test.ts:2:4152'
      failureType: 'testCodeFailure'
      error: |-
        README claims 76 machine-scoped settings, the manifest declares 77
        
        76 !== 77
        
      code: 'ERR_ASSERTION'
      name: 'AssertionError'
      expected: 77
      actual: 76
      operator: 'strictEqual'
      stack: |-
        TestContext.<anonymous> (C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard\packages\vscode-extension\src\__tests__\readme-accuracy.test.ts:115:16)
        Test.runInAsyncScope (node:async_hooks:214:14)
        Test.run (node:internal/test_runner/test:1047:25)
        Suite.processPendingSubtests (node:internal/test_runner/test:744:18)
        Test.postRun (node:internal/test_runner/test:1173:19)
        Test.run (node:internal/test_runner/test:1101:12)
        async Suite.processPendingSubtests (node:internal/test_runner/test:744:7)
      ...
    1..5
not ok 1 - README accuracy
  ---
  duration_ms: 10.1351
  type: 'suite'
  location: 'C:\\Users\\USER\\OneDrive\\Desktop\\Ai-Agent-Security-Guard\\packages\\vscode-extension\\src\\__tests__\\readme-accuracy.test.ts:2:1681'
  failureType: 'subtestsFailed'
  error: '1 subtest failed'
  code: 'ERR_TEST_FAILURE'
  ...
1..1
# tests 5
# suites 1
# pass 4
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 378.239
