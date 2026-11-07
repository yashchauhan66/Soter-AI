# Cline01 startup failure

The 6 November 2026 native attempt did not reach the product driver. The owned Code process reported `checkInnoSetupMutex: vscode-updating is held`, waited 30,958 ms, then exited with `Code is currently being updated. Please wait for the update to complete before launching.`

`f18-product-20261106T150514Z-a872bfe3/owned-editor-close.json` records exit 1 and both EOF. `route-owned-close.json` independently records the owning PowerShell child's actual exit 1, no signal, both EOF, no overflow, and no deadline. No `product-result.json` exists. This is an incomplete route check caused by the installed editor's startup refusal; no Cline assertion is credited as passing or failing.

The failure and original admission remain retained. A fresh successor may check that the external updater mutex is absent and that no CodeSetup/Inno process is present before preparing a profile and immediately before starting Code. Those observations must not acquire the mutex, stop an updater, bypass Code's startup check, or waive exact host identity. The same driver, guards, candidate, and hook assertions remain required.

Because C has very little free space, the root agent prepared a separate, narrowly scoped relocation of this attempt's 38-file, 38,239,400-byte public vendor clone to D. The relocation script verifies every source and destination byte before removing only this known clone and retains before/after receipts here. Those receipts, if present and complete, identify the archive paths for reviewing the original failed admission. The original failed attempt must never be rerun or relabelled as accepted.

No product source was changed by this investigation. No additional native process was launched by this reviewer.
