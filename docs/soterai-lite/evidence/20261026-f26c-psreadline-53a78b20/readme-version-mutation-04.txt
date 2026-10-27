TAP version 13
# Subtest: README accuracy
    # Subtest: names only commands that exist
    ok 1 - names only commands that exist
      ---
      duration_ms: 2.5479
      type: 'test'
      ...
    # Subtest: names only settings that exist, with the manifest's real defaults
    ok 2 - names only settings that exist, with the manifest's real defaults
      ---
      duration_ms: 0.8147
      type: 'test'
      ...
    # Subtest: does not advertise a version other than the one being published
    ok 3 - does not advertise a version other than the one being published
      ---
      duration_ms: 1.5598
      type: 'test'
      ...
    # Subtest: points at a license file that ships in the VSIX
    ok 4 - points at a license file that ships in the VSIX
      ---
      duration_ms: 1.9097
      type: 'test'
      ...
    # Subtest: states the real count of machine-scoped settings
    ok 5 - states the real count of machine-scoped settings
      ---
      duration_ms: 0.5126
      type: 'test'
      ...
    1..5
ok 1 - README accuracy
  ---
  duration_ms: 10.6202
  type: 'suite'
  ...
1..1
# tests 5
# suites 1
# pass 5
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 734.4439
