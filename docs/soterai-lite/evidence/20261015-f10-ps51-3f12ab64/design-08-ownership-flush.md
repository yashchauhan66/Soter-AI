# F10 strict ownership and bounded shutdown, before fixes

Controller review baseline01 executes6:2PASS4FAIL. Three malformed sparse-array cases wrongly admitted a tab; one held-store case kept shutdown pending beyond1500ms. Retain all inputs/outputs. Reject nonordinary/accessor/extra/sparse ownership arrays before parsing any row, preserve them and withhold launch. Existing strict row validation remains.

Shutdown requests owned cancellation, records current live snapshots, and allows at most500ms to flush the coalesced ownership write. If storage remains unresolved, mark admission unavailable and return with status ownership=UNVERIFIED. Do not cancel a pending storage API or claim durability/exit; its existing promise remains owned and may settle later. No second concurrent write or kill is added. Subsequent launches stay withheld. A metadata timeout is not evidence of process completion.
