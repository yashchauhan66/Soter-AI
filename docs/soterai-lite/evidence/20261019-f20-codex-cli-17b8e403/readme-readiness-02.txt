TAP version 13
# Subtest: the canonical readiness doc is generated, not maintained
    # Subtest: exists
    ok 1 - exists
      ---
      duration_ms: 1.3044
      type: 'test'
      ...
    # Subtest: matches what the generator produces from source right now
    ok 2 - matches what the generator produces from source right now
      ---
      duration_ms: 94.0997
      type: 'test'
      ...
    # Subtest: says out loud that it is generated
    ok 3 - says out loud that it is generated
      ---
      duration_ms: 1.4615
      type: 'test'
      ...
    1..3
ok 1 - the canonical readiness doc is generated, not maintained
  ---
  duration_ms: 98.763
  type: 'suite'
  ...
# Subtest: the readiness doc states the real, current numbers
    # Subtest: names the version being published
    ok 1 - names the version being published
      ---
      duration_ms: 0.4809
      type: 'test'
      ...
    # Subtest: names the license that actually ships
    ok 2 - names the license that actually ships
      ---
      duration_ms: 0.2754
      type: 'test'
      ...
    # Subtest: states the command count the manifest actually declares
    ok 3 - states the command count the manifest actually declares
      ---
      duration_ms: 0.2415
      type: 'test'
      ...
    # Subtest: states the setting and policy counts the manifest actually declares
    ok 4 - states the setting and policy counts the manifest actually declares
      ---
      duration_ms: 0.3378
      type: 'test'
      ...
    # Subtest: claims no ML in the packaged extension
    ok 5 - claims no ML in the packaged extension
      ---
      duration_ms: 0.3796
      type: 'test'
      ...
    # Subtest: keeps the permanent limitations in the document, not just in the code
    ok 6 - keeps the permanent limitations in the document, not just in the code
      ---
      duration_ms: 0.3537
      type: 'test'
      ...
    1..6
ok 2 - the readiness doc states the real, current numbers
  ---
  duration_ms: 2.9657
  type: 'suite'
  ...
# Subtest: stale documents do not contradict the shipped product
    # Subtest: vscode-extension-marketplace-readiness.md no longer states a contradicted number
    ok 1 - vscode-extension-marketplace-readiness.md no longer states a contradicted number
      ---
      duration_ms: 0.3693
      type: 'test'
      ...
    # Subtest: no extension-facing document advertises a detection-rule count the source does not back
    ok 2 - no extension-facing document advertises a detection-rule count the source does not back
      ---
      duration_ms: 7.9419
      type: 'test'
      ...
    1..2
ok 3 - stale documents do not contradict the shipped product
  ---
  duration_ms: 8.494
  type: 'suite'
  ...
# Subtest: README accuracy
    # Subtest: names only commands that exist
    ok 1 - names only commands that exist
      ---
      duration_ms: 4.9837
      type: 'test'
      ...
    # Subtest: names only settings that exist, with the manifest's real defaults
    ok 2 - names only settings that exist, with the manifest's real defaults
      ---
      duration_ms: 1.3879
      type: 'test'
      ...
    # Subtest: does not advertise a version other than the one being published
    ok 3 - does not advertise a version other than the one being published
      ---
      duration_ms: 0.8666
      type: 'test'
      ...
    # Subtest: points at a license file that ships in the VSIX
    ok 4 - points at a license file that ships in the VSIX
      ---
      duration_ms: 3.1122
      type: 'test'
      ...
    # Subtest: states the real count of machine-scoped settings
    ok 5 - states the real count of machine-scoped settings
      ---
      duration_ms: 0.7662
      type: 'test'
      ...
    1..5
ok 4 - README accuracy
  ---
  duration_ms: 14.7656
  type: 'suite'
  ...
1..4
# tests 16
# suites 4
# pass 16
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1035.0074
