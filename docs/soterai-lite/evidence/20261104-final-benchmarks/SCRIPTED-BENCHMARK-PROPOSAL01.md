# V02 synthetic coding benchmark dry-run preparation

4 November 2026. This implements the existing plan131 scripted dry-run preparation; it is not a replacement plan, completed final gate or an authenticated model trial. No driver has been run by the test author.

Root invocation after reviewing the driver:

```powershell
node docs/soterai-lite/evidence/20261104-final-benchmarks/run-scripted-benchmarks-proposed-01.cjs --run e0b7677479089dfdfe7a2d64baa0ce7f66e4a9600c1094fcde96152101829f24
```

Use an owned root wrapper with a 180-second observation deadline and actual close/bothEOF retention. The driver has four sequential cases, each with a measured30-second assertion and a measured120-second aggregate assertion. These assertions detect overrun after completion; they are not cancellation mechanisms. The existing source component algorithms have their own bounded input/work limits. No process signals, automatic retries or cleanup are authorized. All created files remain in a fresh marked `scripted-run-*` child under this evidence directory.

The driver requires the exact current package qualification SHA, verifies its current VSIX fact and proof1110 SHA, and binds all five actual pure matcher/redactor dependency sources to that proof. Those components are compiled in memory with the existing local TypeScript compiler and a fixed five-file loader. No require hook, editor host, product runtime patch, installed extension, tsx/esbuild worker or additional dependency is used. This is component evidence. It must not be labeled installed-VSIX or native tool coverage.

The first synthetic coding project is shaped for Node/Express with an in-memory fake database. The starter exports the actual route handler and an Express app factory with `app.get('/orders', ...)`. Existing local Express is unavailable. The dry run therefore executes the same exported handler directly with controlled request/response objects, labeled `NODE_HANDLER_SCRIPTED_ONLY`. Actual Express routing/integration remains `NOT_RUN_DEPENDENCY_UNAVAILABLE`; there is no substitute framework claim. Do not download a dependency. The human checklist must name an authorized dependency/integration step if this remains unavailable.

The second project uses the actual existing local Next.js15.5.25 `NextRequest` and `NextResponse` classes with an in-memory fake API. It executes the app-route GET function directly. No Next server, framework build, browser or network request is started, and none is claimed. The constructed `http://benchmark.invalid` request URL is an in-memory request identifier, never fetched.

Each project has a meaningful public coding task: complete a route that filters/sorts the fake service rows, returns the required useful public fields, and refuses invalid query values without calling the service. The deterministic script first verifies the starter returns501, changes one explicit TODO switch in an exclusive synthetic file, then verifies exact200 output, invalid400, service-call count and absence of private fake-service fields. Both original and completed source bytes remain for inspection. This is a scripted source transformation, not AI-generated work or a measure of reasoning quality.

On/off comparisons exercise two cooperative component boundaries. The off control forwards a synthetic registered value in scripted context and retains it in diagnostic output; the oracle requires these deliberate synthetic leaks to be observed. The on path uses actual `RegisteredSecretMatcher` to withhold that context, submits a useful public-only fallback, and uses actual `StreamingOutputRedactor` on a split diagnostic value. It requires the value absent, the redaction marker present and useful public output preserved. This tests the chosen component pipeline only; it does not establish arbitrary editor/tool/network interception. Raw synthetic private context/diagnostics are not written into the result.

Reported completion count, prompt count, interruptions and elapsed time are explicitly local **SCRIPTED** metrics. Prompt count means harness context submissions (off1/on2); actual model prompts and authenticated model calls are zero. One local timing per case cannot establish real-agent latency, success rate or user friction. Real-model protection-on/off trials on both projects remain in HUMAN-ACTIONS, as do genuine Express integration and full Next execution where required.

The driver temporarily installs fail-fast guards on common Node HTTP/HTTPS/net request/server functions and `fetch`, restoring them on completion. Zero guard calls is a scoped harness observation, not a universal network-confinement claim. No listener, server, CLI, login, download, environment secret, normal profile, Git operation or process signal is part of this fixture.
