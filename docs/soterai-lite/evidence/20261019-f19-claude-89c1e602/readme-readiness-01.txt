TAP version 13
# Subtest: the canonical readiness doc is generated, not maintained
    # Subtest: exists
    ok 1 - exists
      ---
      duration_ms: 1.058
      type: 'test'
      ...
    # Subtest: matches what the generator produces from source right now
    ok 2 - matches what the generator produces from source right now
      ---
      duration_ms: 83.3367
      type: 'test'
      ...
    # Subtest: says out loud that it is generated
    ok 3 - says out loud that it is generated
      ---
      duration_ms: 0.4793
      type: 'test'
      ...
    1..3
ok 1 - the canonical readiness doc is generated, not maintained
  ---
  duration_ms: 86.1126
  type: 'suite'
  ...
# Subtest: the readiness doc states the real, current numbers
    # Subtest: names the version being published
    ok 1 - names the version being published
      ---
      duration_ms: 0.3745
      type: 'test'
      ...
    # Subtest: names the license that actually ships
    ok 2 - names the license that actually ships
      ---
      duration_ms: 0.2137
      type: 'test'
      ...
    # Subtest: states the command count the manifest actually declares
    ok 3 - states the command count the manifest actually declares
      ---
      duration_ms: 0.1701
      type: 'test'
      ...
    # Subtest: states the setting and policy counts the manifest actually declares
    ok 4 - states the setting and policy counts the manifest actually declares
      ---
      duration_ms: 0.25
      type: 'test'
      ...
    # Subtest: claims no ML in the packaged extension
    ok 5 - claims no ML in the packaged extension
      ---
      duration_ms: 0.2999
      type: 'test'
      ...
    # Subtest: keeps the permanent limitations in the document, not just in the code
    ok 6 - keeps the permanent limitations in the document, not just in the code
      ---
      duration_ms: 0.2734
      type: 'test'
      ...
    1..6
ok 2 - the readiness doc states the real, current numbers
  ---
  duration_ms: 2.1947
  type: 'suite'
  ...
# Subtest: stale documents do not contradict the shipped product
    # Subtest: vscode-extension-marketplace-readiness.md no longer states a contradicted number
    ok 1 - vscode-extension-marketplace-readiness.md no longer states a contradicted number
      ---
      duration_ms: 0.3067
      type: 'test'
      ...
    # Subtest: no extension-facing document advertises a detection-rule count the source does not back
    ok 2 - no extension-facing document advertises a detection-rule count the source does not back
      ---
      duration_ms: 7.3006
      type: 'test'
      ...
    1..2
ok 3 - stale documents do not contradict the shipped product
  ---
  duration_ms: 7.7549
  type: 'suite'
  ...
# Subtest: README accuracy
    # Subtest: names only commands that exist
    ok 1 - names only commands that exist
      ---
      duration_ms: 4.1978
      type: 'test'
      ...
    # Subtest: names only settings that exist, with the manifest's real defaults
    ok 2 - names only settings that exist, with the manifest's real defaults
      ---
      duration_ms: 1.1622
      type: 'test'
      ...
    # Subtest: does not advertise a version other than the one being published
    ok 3 - does not advertise a version other than the one being published
      ---
      duration_ms: 0.8873
      type: 'test'
      ...
    # Subtest: points at a license file that ships in the VSIX
    ok 4 - points at a license file that ships in the VSIX
      ---
      duration_ms: 2.8595
      type: 'test'
      ...
    # Subtest: states the real count of machine-scoped settings
    not ok 5 - states the real count of machine-scoped settings
      ---
      duration_ms: 4.8882
      type: 'test'
      location: 'C:\\Users\\USER\\OneDrive\\Desktop\\Ai-Agent-Security-Guard\\packages\\vscode-extension\\src\\__tests__\\readme-accuracy.test.ts:2:4152'
      failureType: 'testCodeFailure'
      error: |-
        README claims 63 machine-scoped settings, the manifest declares 64
        
        63 !== 64
        
      code: 'ERR_ASSERTION'
      name: 'AssertionError'
      expected: 64
      actual: 63
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
not ok 4 - README accuracy
  ---
  duration_ms: 16.9006
  type: 'suite'
  location: 'C:\\Users\\USER\\OneDrive\\Desktop\\Ai-Agent-Security-Guard\\packages\\vscode-extension\\src\\__tests__\\readme-accuracy.test.ts:2:1681'
  failureType: 'subtestsFailed'
  error: '1 subtest failed'
  code: 'ERR_TEST_FAILURE'
  ...
1..4
# tests 16
# suites 4
# pass 15
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1069.6927
