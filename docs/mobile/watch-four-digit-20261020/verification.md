# Four-digit pairing and concise Watch display

Date: 2026-10-20. Issue: https://github.com/annayzhu/LabNest/issues/110.

## Behavior

- New codes contain four ASCII digits, including leading zeros; single use, ten-minute expiry.
- One PostgreSQL transaction lock protects allocation and claims. Codes remain reserved for the full ten minutes even after use. No plaintext code or token is stored in the activity log.
- Five invalid claims in a rolling ten-minute window temporarily block pairing across this local server. This deliberate server-wide limit cannot be bypassed by rotating caller-supplied device IDs. HTTP 429 includes `Retry-After: 600`. Existing paired devices continue to work.
- This retains LabNest's trusted local-workspace access model. The four-digit code does not add public deployment authentication.
- Web links, iPhone entry (number pad), shared Swift validation and Watch manual pairing use the same format. Update the server, iPhone and Watch apps together. Existing long-lived Watch credentials remain valid; old twelve-character pairing codes must be regenerated.
- The Watch main screen retains group/step, complete instructions, amounts/units, timer and guarded actions. Surrounding Protocol notes move to **备注与详情**. Explicit warning/critical callouts remain in the main instructions. No instruction text is truncated or summarized.
- Duplicate headers and routine sync timestamps are removed. Settings and reminder permissions move to **连接设置**. Offline, pending, conflict and failed-operation messages remain visible.

## Verification

- `npm test`: 165 files, 1,345 tests passed.
- `npm run typecheck`: passed.
- ESLint on changed TypeScript/TSX: passed.
- `npx tsx scripts/verify-watch-pairing.ts` against disposable `labnest_watch_pairing_test` PostgreSQL 16: passed. Covers concurrent generation/claims, all 10,000 code slots, leading zero, reserved consumed codes, expiry, scope/revocation, committed failure counts, changing device IDs, recovery after the failure window, and HTTP 429.
- Swift `PairingLinkChecks`: passed, including four-digit extremes, leading zeros and 16 rejected links.
- Xcode 26.6 simulator build of the iPhone app and embedded Watch app: passed. Existing headermap warnings remain. A separate Swift CLI check initially hit an old `/tmp` versus `/private/tmp` module-cache collision; it passed with a fresh task-specific cache.
- iPhone 17 Pro / Apple Watch Series 11 (46 mm), iOS/watchOS 26.5 simulators: actual web-generated four-digit link opened on iPhone; WatchConnectivity saved the connection on Watch; Watch read the synthetic run; webpage reported connected.
- A previous synthetic pending mutation correctly prevented switching experiments. It was backed up to `/private/tmp/labnest-watch-prior-synthetic-pending-20261020.json` before continuing QA.
- Rendered inspection: concise main step and 10:00 timer; 220 µL total with 50 µL per-tube amount; full notes accessible from details; manual settings say four digits. Final web check includes a narrow layout with the code visible.
- Impeccable detector: no blocking findings; two advisory findings in unchanged existing styles (backdrop color and heading size).

The pairing database/API were real. Run contents and amounts in `synthetic-snapshot.json` are synthetic UI fixtures, not experimental evidence; timer/completion mutation behavior was not revalidated through this preview server. Existing guard logic is unchanged.

Screenshots: `watch-main.png`, `watch-mix.png`, `watch-settings.png`, `phone-pairing.png`, `web-pairing.png`.

This verifies source, server checks and simulators. It does not establish physical Watch installation, real WatchConnectivity delivery, or physical notification arrival. The built `.app` in `/private/tmp/labnest-watch-four-digit-build/` is for simulators; a real device needs its own Xcode signing and installation.
