# SoterAI IDE Guard for Vim — test report

Run date: 2026-07-06
Host OS: Windows 11 x64
Vim: VIM 9.1 (patches 1-2081), msys2 build, `json_encode`/`json_decode` present
curl: present on PATH (`/mingw64/bin/curl`)

**This is not a support claim.** The runtime/broker integration tests below are
**NOT RUN** because no live Local AI Broker was exercised from Vim in this
environment. Only static load and non-network behavior were checked. Do not
promote any row here to "supported" without the broker-backed manual run.

## What was actually checked (static / non-network)

| Check | Result | Evidence |
|---|---|---|
| Scripts load without error | PASS | `vim -N -u NONE -es` sourcing `plugin/soterai.vim` produced no errors and exit 0. |
| All five commands defined | PASS | `exists(':SoterScanBuffer' \| ':SoterScanSelection' \| ':SoterRedactRange' \| ':SoterBrokerStatus' \| ':SoterSafePrompt')` each returned non-zero. |
| Feature-guard correctness | PASS | Guard corrected from the non-existent `has('json')` flag to `exists('*json_encode')`/`exists('*json_decode')`; plugin now loads on a standard build. |
| Config defaults | PASS | `soterai#BrokerUrl()` returned `http://127.0.0.1:47321` with no config set. |
| Result formatting | PASS | `soterai#FormatScan()` rendered a sample `/v1/scan` dict into the expected decision/risk/findings/hash/evidence lines. |
| Broker-unreachable error path | PASS | With no broker running, `soterai#Health()` threw a clean `soterai: curl failed (exit 7)...` error (caught as an exception, no Vimscript stack error). |

## What was NOT run (requires a live broker + manual driving)

| Check | Status | Why |
|---|---|---|
| `POST /v1/scan` round trip from `:SoterScanBuffer` / `:SoterScanSelection` | NOT RUN | No live broker exercised from Vim here. |
| In-place redaction via `:SoterRedactRange` | NOT RUN | Requires broker `POST /v1/redact` and interactive buffer verification. |
| `:SoterSafePrompt` register/clipboard yank | NOT RUN | Requires broker redaction result and a real session. |
| `:SoterBrokerStatus` against a healthy broker | NOT RUN | Only the unreachable path was observed. |
| Token-file resolution end to end | NOT RUN | Static logic reviewed; not exercised against a real `~/.soterai/broker/auth-token`. |
| Canary privacy test | NOT RUN | Must confirm nothing but loopback traffic leaves the machine and the token never appears in `argv`/logs. |

## Manual test procedure (to reach PASS)

Prerequisites: broker running on `http://127.0.0.1:47321`, token in
`~/.soterai/broker/auth-token` (or `g:soterai_token`), plugin on `runtimepath`.

1. **Status.** Open Vim, run `:SoterBrokerStatus`.
   Expected: scratch window shows `Health`, `Version`, and `SafeMode` values; no
   token text appears anywhere.
2. **Scan buffer.** Open a file containing a fake secret (e.g. a dummy AWS key
   pattern). Run `:SoterScanBuffer`.
   Expected: scratch window shows `Decision`, `Risk`, `Findings`, and a
   **redacted** evidence preview; the message line shows the decision + risk.
3. **Scan selection.** Visually select a few lines, run `:'<,'>SoterScanSelection`.
   Expected: same rendering scoped to the selected range.
4. **Redact range.** Select lines containing the fake secret, run
   `:'<,'>SoterRedactRange`.
   Expected: the range is replaced in place with the broker's redacted text; the
   original secret is gone from the buffer.
5. **Safe prompt.** Run `:SoterSafePrompt` (whole buffer) or a range variant.
   Expected: redacted text is placed in the configured register (and `+` when
   `+clipboard`), shown in the scratch window, ready to paste into an AI chat.
6. **Canary / privacy.** With a packet capture or `curl` proxy, confirm the only
   network traffic is loopback to the broker, and inspect the process list
   during a request to confirm the token is not in `curl`'s argv.
7. **Wrong token / broker down.** Set a bad token and stop the broker; confirm
   each command fails with a readable `SoterAI: ...` error and never a raw
   Vimscript traceback.

Record PASS/FAIL with evidence per step before making any Vim support claim.

## Reproduce the static checks

```sh
vim -N -u NONE -es \
  -c 'set rtp+=extensions/vim' \
  -c 'runtime plugin/soterai.vim' \
  -c 'call writefile([exists(":SoterScanBuffer")], "cmds.txt")' \
  -c 'qa!'
```
