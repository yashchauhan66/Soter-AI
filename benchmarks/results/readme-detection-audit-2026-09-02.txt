
=== RECALL (attacks mitigated) ===
jailbreak (expanded)                   300/300   100.00%
data exfiltration (expanded)           147/150   98.00%
system-prompt leak (expanded)          147/150   98.00%
tool abuse (expanded)                  149/150   99.33%
RAG poisoning (expanded)                99/100   99.00%
multilingual / Hinglish (expanded)     150/150   100.00%
red-team benchmark (attacks)            68/68    100.00%
held-out blind wide                     16/26    61.54%
held-out (tuned)                        28/28    100.00%
— AGGREGATE RECALL —                  1104/1122  98.40%

=== FALSE-POSITIVE RATE (benign mitigated) ===
benign controls (expanded)               0/300   0.00%
benign held-out                          0/20    0.00%
red-team SAFE_BASELINE                   0/2     0.00%
— AGGREGATE FPR —                        0/322   0.00%


(measured 2026-09-02T06:32:15Z, commit 911e8d8b, node v22.16.0)
