# Rating and next product improvements

Current engineering judgment: **6/10 overall**, **7/10 usefulness within supported
managed workflows**, **4/10 stable-release readiness**. These are subjective
ratings, not percentages of threats prevented. Recent source/package results
support the implemented controls; GUI/provider/upgrade/recovery and independent
developer acceptance remain incomplete.

## Highest-value next work

1. **Frontend secret exposure guidance.** Explain when a credential placed in
   `NEXT_PUBLIC_*`, `VITE_*` or another supported public variable may be shipped
   to browsers. Pair private-key detections with legitimate public-key controls
   such as Stripe publishable keys. Offer a reviewed server-side remediation
   plan; do not blindly rename variables and break the application.
   Acceptance: private credential example flagged with the exposure reason;
   benign public configuration stays usable; no source rewritten without review.
2. **A working protect-and-run journey for one stack.** Start with a small Node
   project and prove migration, placeholders, a supported approved run and
   recovery. Expand to a real Next.js development workflow only after that
   runtime is implemented and tested. Use mocks/test identities for AI-modifiable
   code: an application given production secrets can leak them.
3. **Make existing custom-secret registration easy to use.** Help the owner mark
   unrecognized private values through the existing matching system and show
   exactly what was verified. Do not imply every encoding or independent route
   is covered. Keep raw values out of diagnostics, shareable reports and analytics.
4. **Real tool-route health.** Run positive and negative canaries through actual
   supported Cline/Claude traffic and invalidate evidence on version/config drift.
   Keep configured, locally checked, live verified and uncovered states distinct.
5. **False-alarm and performance work from real tasks.** Measure normal logs,
   public configuration, attachments and large tool schemas on target hardware.
   Investigate the retained concurrent Claude time-budget failure; preserve
   protection limits while improving work efficiency and useful failure messages.

These are recommendations, not features implemented by the marketing task.
Avoid adding many new dashboards while the first supported workflow still needs
independent usability proof.

## Release advice

Do not publish the current candidate as a broadly trusted stable release yet.
Run the same VSIX through GUI activation, reviewed-copy, configured
upgrade/recovery and actual supported-provider tests. Then conduct a closed
pilot with real developers and address the findings before a limited public
preview. Stable acceptance also needs the relevant independent security and
accessibility review.

Make the first Lite release about local Windows managed secret protection.
Unverified Docker/AWS experiments are separate scope; they do not need to become
universal Lite blockers if they are not shipped or advertised as proven features.
Publish only the tested artifact, preserve the existing package ID, and verify
the served version independently on VS Code Marketplace and Open VSX.
