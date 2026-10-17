# Dispatcher fixture correction

dispatch-after-01: 19 cases, 18 PASS / 1 FAIL. D17's positive directory dispatch passed; its protected-directory setup then failed in existing parseManualRules with `Invalid sensitive AI path rule.` A sensitive flag is supported on file rules only. Corrected D17 to the already-supported folder deny `{kind:'folder',pattern:'public'}`; the required denied-list result and worker-count assertion remain. No production change is attributed to this fixture correction. Original raw failure retained.
