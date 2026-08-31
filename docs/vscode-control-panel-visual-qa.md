# SoterAI Control Panel visual and usability acceptance

This is the repeatable acceptance protocol for the VS Code extension Control
Panel. Automated tests verify structure and behavior; this checklist verifies
what source assertions cannot: visual hierarchy, clipping, contrast, density,
and first-use comprehension in a real editor.

## Release gate

Test the packaged VSIX, not an Extension Development Host build:

1. Install `packages/vscode-extension/soterai-ide-guard-0.6.1.vsix` into a clean
   VS Code profile.
2. Open a disposable workspace containing no real secrets.
3. Open **SoterAI Guard → Control Panel**.
4. Record editor version, OS, theme, zoom, sidebar width, result, and screenshot
   in the matrix below. Do not mark a row passed without inspecting it.

## Visual matrix

| Environment | Width / zoom | Required result | Status |
| --- | --- | --- | --- |
| VS Code Dark Modern | 220 px / 100% | No horizontal scroll; actions and labels remain understandable | Pending manual review |
| VS Code Dark Modern | 320 px / 100% | Primary status and next action are visible before advanced controls | Pending manual review |
| VS Code Light Modern | 320 px / 100% | Text, badges, borders, and focus indicators remain legible | Pending manual review |
| VS Code High Contrast | 320 px / 100% | Every card/button boundary and focused control is visible | Pending manual review |
| VS Code High Contrast Light | 320 px / 100% | No state relies only on color | Pending manual review |
| Any supported theme | 320 px / 150% | No clipped labels or overlapping controls | Pending manual review |
| Any supported theme | 320 px / 200% | All actions remain keyboard reachable and text can reflow | Pending manual review |
| Any supported theme | 500 px / 100% | Layout stays compact and does not create excessive empty space | Pending manual review |

Repeat the matrix on Windows, macOS, and Linux before calling the visual design
fully validated. Capture the current Control Panel after it passes and replace
the older Safe Mode Marketplace screenshot only after reviewing its alt text and
ensuring it contains test data only.

## State matrix

Verify each state with real extension settings and behavior:

- Fresh install: three-step guided setup is visible.
- Local broker stopped: blocking says **Needs setup** and the primary action
  starts setup.
- Full protection: guided setup is absent and coverage is the primary action.
- Untrusted workspace: project access and data-boundary text explain the limit.
- Managed control: switch is disabled and the organization-provided reason is
  visible.
- Lockdown: the primary action offers recovery; destructive access is not
  silently restored.
- Failure: VS Code shows the underlying error and the panel provides retry
  guidance without claiming success.

## Keyboard and assistive technology

1. Navigate every interactive element with Tab and Shift+Tab.
2. Activate buttons with Enter and Space where native button semantics apply.
3. Confirm focus returns to the initiating control after a panel re-render.
4. Confirm each switch announces its label, checked state, and disabled state.
5. Confirm headings expose one level-one page title and logical level-two
   sections.
6. Confirm action progress and post-action feedback are announced once.
7. Enable reduced motion and verify no meaningful information depends on motion.

## Five-person first-use study

Use five developers who have not worked on SoterAI. Do not coach them. Ask each
participant to:

1. Explain whether SoterAI can currently block an AI request.
2. Explain what data can leave the machine.
3. Run the safe demo through guided setup.
4. Find project risk and the latest findings.
5. Explain the difference between **Blocks** and **Warns**.

Record completion, time, wrong turns, and the participant's explanation. The
release target is at least 4/5 unassisted completion for every task and no user
mistaking monitoring for blocking. Any failed task must produce a wording or
navigation issue before the next release; human results must never be invented.

## Automated evidence already required

- `npm run typecheck`
- `npm test`
- `npm run test:host`
- `npm run bundle`
- `npm run package`
- `npm run verify:vsix`
- `node scripts/generate-readiness.mjs --check`

The host suite verifies semantic landmarks, focus persistence, responsive and
forced-color CSS, strict message allowlisting, all rendered workflows, and the
existence of every command the panel invokes.