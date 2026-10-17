# F14 cross-window secret event review

Root LOW review: a different window can update the extension canary SecretStorage registry, but the manager only watched provider credential events. New manager cases M13/M14 were authored after the initial core implementation, before this correction. secret-event-review-before01:14 tests13PASS1FAIL, the canary event left the owner healthy; no real secret/leak or independent coverage claim.

The manager now withdraws for provider or canary SecretStorage changes, including events originating in another window; unrelated secret events preserve ownership. The normal same-context CanaryManager event remains too. New final focused/compiler/full gates must cover these current bytes. Pipeline final-local01 started before these extra fixtures and the correction, so its results/artifact (if completed) are historical and cannot be final-source acceptance. All outputs remain retained; final-local02 will use unique names after01 finishes.
