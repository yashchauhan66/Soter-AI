TAP version 13
# Subtest: README accuracy
    # Subtest: names only commands that exist
    ok 1 - names only commands that exist
      ---
      duration_ms: 4.8748
      type: 'test'
      ...
    # Subtest: names only settings that exist, with the manifest's real defaults
    ok 2 - names only settings that exist, with the manifest's real defaults
      ---
      duration_ms: 1.3726
      type: 'test'
      ...
    # Subtest: does not advertise a version other than the one being published
    ok 3 - does not advertise a version other than the one being published
      ---
      duration_ms: 1.0449
      type: 'test'
      ...
    # Subtest: points at a license file that ships in the VSIX
    ok 4 - points at a license file that ships in the VSIX
      ---
      duration_ms: 2.7827
      type: 'test'
      ...
    # Subtest: states the real count of machine-scoped settings
    ok 5 - states the real count of machine-scoped settings
      ---
      duration_ms: 0.6741
      type: 'test'
      ...
    1..5
ok 1 - README accuracy
  ---
  duration_ms: 14.0754
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
# duration_ms 689.6633
