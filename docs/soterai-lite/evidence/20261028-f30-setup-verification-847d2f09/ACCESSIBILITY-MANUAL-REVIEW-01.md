# F30 accessibility manual review retained

Exact current shipped adjacent Project Privacy HTML and actual Code host theme capture were audited in real headless Edge using installed axe 4.12.1. All three modes have zero reported automated violations. Native TreeView keyboard, actual Verify, revoke order, Escape, high contrast and reduced motion are separately verified in native-acceptance-01.json. Live Code webview frame DOM was not observed. No substitute VS Code bridge was injected.

- standard: 30 automated rules passed; incomplete/manual findings [{"id":"aria-prohibited-attr","impact":"serious","nodes":1}].
- forced-colors: 29 automated rules passed; incomplete/manual findings [{"id":"aria-prohibited-attr","impact":"serious","nodes":1},{"id":"color-contrast","impact":"serious","nodes":104}].
- reduced-motion: 30 automated rules passed; incomplete/manual findings [{"id":"aria-prohibited-attr","impact":"serious","nodes":1}].

All original incomplete nodes, raw axe JSON, screenshots and browser stdout/stderr are retained in edge-retained-01 and the original synthetic D profile. These findings remain UNVERIFIED for manual assessment; zero automated violations is not a full accessibility, human screen-reader, usability or independent review result. Original L6 human actions and stop remain mandatory.
