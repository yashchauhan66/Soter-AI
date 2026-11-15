# Demo, screenshots and promo assets

## The 30-second story

Use the final candidate in a separate Windows VS Code test profile. Every value
in `demo/` is synthetic. The storyboard is not a claim that a recording or real
provider test has already happened.

| Time | Actual recording |
| --- | --- |
| 0–4 s | Open `demo/secrets-demo.txt`: "I need AI help with this error. These passwords should not be in my prompt." |
| 4–10 s | Show a real SoterAI finding and select **Preview sanitized lines before copying** |
| 10–19 s | Show that both recognized values are filtered while the useful error context remains |
| 19–25 s | Choose **Copy reviewed text**, then paste into a fresh local document to inspect exactly what was copied |
| 25–30 s | End card: **SoterAI Secret Guard — Check secrets before your next AI prompt. Windows preview.** |

Do not paste into a real provider as evidence of interception without a separate
actual route test. Show the real UI, including any incomplete/unverified status;
do not replace it with an invented green "protected" badge.

Record one uninterrupted successful take, then trim idle time. Keep text readable
on a phone. A second recording can use `demo/environment-example.txt` to show a
names-only contract with synthetic examples. Test recovery separately from a
short promotional clip.

## Graphics supplied

`assets/social-1200x630.png` and `assets/social-1080x1080.png` use the existing
SoterAI logo and the new positioning. They are **promotional illustrations** with
synthetic code; they are not editor screenshots or observed provider results.
Editable SVG versions are supplied beside them.

Regenerate into a new output directory with:

```sh
node marketing/extension-launch-2026-11-13/generate-assets.cjs <new-directory>
```

For source-level fixture validation, run:

```sh
node --import tsx marketing/extension-launch-2026-11-13/demo/verify.cjs
```

That validates the fixture through the actual local text-preparation helper.
It does not exercise installed editor UI or provider traffic.

## Captured installed-product images — 13 November 2026

Candidate: `soterai.soterai-ide-guard` 0.7.0 win32-x64 preview; SHA-256
`528c3cb0bfed0fa106d920c54694873a6023e7a1c123ba984ba89100b424741d`.
These are actual screenshots of the installed product in an isolated VS Code
driver host using synthetic fixtures. They are not invented UI or provider
recordings. The promotional social cards above remain illustrations.

![Actual installed debug preview in the isolated driver host, with synthetic fixtures](assets/native-debug-preview-528c3cb0.png)

Caption: **Review useful debug context before copying. Real installed SoterAI
Secret Guard, 13 November `528c3cb0` candidate, synthetic fixture, isolated
Windows VS Code test host.**

![Actual installed environment contract in the isolated driver host, with synthetic examples](assets/native-environment-contract-528c3cb0.png)

Caption: **Share environment names and synthetic examples. Real installed
SoterAI Secret Guard, 13 November `528c3cb0` candidate, isolated Windows VS Code
test host.**

The corresponding [native handoff](../../docs/soterai-lite/PRODUCTION-NATIVE-2026-11-13.md)
records 11 reviewed-workflow checks, including useful copied context,
cancellation and source/preview/settings drift refusal. A still image shows the
preview only; use an actual uninterrupted recording to demonstrate copy and
cancellation. An unchanged supported Cline/provider route needs its own
acceptance recording and cannot be inferred from these images.

The historical 13 November native handoff additionally records the configured synthetic Node
app's complete eight-check installed workflow: reviewed two-variable setup,
exit 0, verified visible `VAULT_APP_OK=true`, cancellation and restoration.
This is a tested fixture, not a general framework compatibility or provider
demo. The unchanged pinned Cline 4.1.26 native legacy-override refusal passed;
these images do not establish a public loopback task, real-provider or
request/tool-result/attachment acceptance.

## Fresh-candidate recording status — 14 November 2026

Current [VSIX and handoff](../../docs/soterai-lite/PRODUCTION-READINESS-2026-11-14.md):
`df92f72ae4672ed8f4857b0cfba51fc422b7811ad57aff36b76b417e149ef55f`,
1,674,363 bytes. Source checks verify that provider inputs stay pending on focus
loss and explicit cancellation ends setup before writes. Current native
workflow/Cline/vault seed/restart drivers are prepared; approved launches were
blocked by technical approval-review errors before execution.

No fresh installed recording or screenshot is claimed. The two real editor
images above are historical `528c3cb0` product evidence; social cards are
illustrations. Complete the fresh native sequence in the handoff before
recording this candidate, and label any synthetic loopback footage separately
from an actual provider/canary test. Use the existing Windows preview end card;
do not add a 10/10 or fully production-ready badge.
