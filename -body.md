Follow-up to PR #34/#35. After #35 merged (at 85746062), three commits landed on this branch but never reached main:

- db6c18d7 fix(tests+deps): clear the two red suites and patch 4 npm audit advisories
  - next 15.5.22 -> 15.5.25 (2 critical RCE advisories), sharp -> 0.35.4, onnxruntime-node pinned 1.21.1 (removes the unpatchable adm-zip tree). npm audit --omit=dev: 0.
  - Stale SEO title assertion fixed; full suite now 2836 tests / 0 fail.
- c69f906b seo: press and media kit, llms-full.txt for LLM answer engines
  - /press page, sitemap + footer links, llms-full.txt + generator.
- 0260b353 fix(lint): rename the CJS host variable in generate-llms-full.mjs
  - Clears the single ESLint error that failed the CI Lint step; npm run lint now all groups clean.
