# LabNest Watch — first execution client

This is a separate SwiftUI watchOS client, not a web layout. It uses the same captured Protocol, deterministic system resolution, guarded step-completion API and locked timer transitions as LabNest. No formulas or source editing are copied into the watch.

## Build and install

For easier pairing, use the new [iPhone companion project](../LabNestMobile/README.md): open `../LabNestMobile/LabNestMobile.xcodeproj`. It embeds this Watch app and sends the server address and one-use code from the phone through WatchConnectivity. The Watch needs no browser. The standalone project below remains available for manual pairing. Physical installation still requires a real signing team and paired devices; TestFlight has not been published.

Open `LabNestWatch.xcodeproj` in Xcode. Select your own signing team and connected Apple Watch (watchOS 10 or later). Build and run on that device. No signing account or provisioning profile is committed; deployment to port3001 does **not** install this app. During the initial development pass, no connected Watch or iPhone was discoverable. Xcode26.6 / watchOS simulator SDK26.5 compile checks did not establish physical-device behavior; the subsequent Series11(46mm) simulator acceptance is recorded below. On 2026-10-21, signed installation and launch succeeded on a physical iPhone and Apple Watch Series 8 (watchOS26.6); see the [physical installation record](../../docs/watch-device-install-20261021/verification.md). Experiment pairing, physical timers and notification delivery remain separate checks.

For a reproducible unsigned compile:

```sh
xcodebuild -project native/LabNestWatch/LabNestWatch.xcodeproj -target LabNestWatch -configuration Debug -sdk watchsimulator SYMROOT=/tmp/labnest-watch-build CODE_SIGNING_ALLOWED=NO build
```

## Connect and use

1. On the phone/desktop Run, choose and confirm experimental systems. Expand **Apple Watch 执行端 · 预览**, then generate a four-digit numeric, one-use pairing code (10 minutes).
2. In the installed watch app enter the reachable LabNest base URL and code. Use the phone keyboard offered by watchOS if available. `localhost` on the watch is not your Mac. Use a trusted HTTPS endpoint where possible; local HTTP networking depends on the device/ATS configuration and remains unverified here.
3. Refresh, select the exact experimental group/step, read the instruction and quantities. Long Protocol notes are available under **备注与详情**; neither view truncates the text. Connection and reminder controls live in **连接设置**. Complex tables/images and required actual-value entry stay on the phone.
4. Start/pause/finish a timer online. Timer expiry does not complete a step. Explicitly confirm completion only after doing the operation.
5. An offline completion is atomically persisted and labelled pending. Only one pending action is allowed; it retains the original revision. Foreground refresh retries that same operation ID. Conflicts remain local for review; no silent revision replacement. Offline timer controls are deliberately unavailable.
6. Enable reminders only on the intended reminder device. Notifications use timer/experiment/revision IDs; fresh sync removes earlier scheduled reminders and schedules current deadlines. Permissions and actual delivery are separate. Offline watches cannot immediately learn cancellation from another device.
7. “断开本实验的手表连接” revokes grants and outstanding pairing codes. Tokens are stored hashed on the server and in Keychain on the watch; snapshots/pending records are atomic files. No token is placed in a URL or log.

## Acceptance boundaries

The server tests cover one-use pairing, experiment scope, revoke, independent 50/80µL quantities, shared work once, real completion and repeat-request deduplication. The native target compiles. Simulator installation, navigation, full quantities, explicit completion, start/pause, app restart, offline pending persistence and reconnect (one database event) pass. Signed physical iPhone/Watch installation and launch are **已验证** in the 2026-10-21 installation record. Actual experiment pairing, Dynamic Type, physical timer accuracy and notification arrival remain **未执行** in that session; E07/E08 remain open until their full checks are performed. Do not claim that a paired watch receiving a notification can already execute this app.

This local LabNest instance has the existing trusted-workspace access model, not new multi-user identity. `local-workspace-user` is an honest actor label, not an authenticated person's identity. Do not expose the existing local application publicly without its own access-control deployment.

Apple references consulted: [Independent watchOS apps](https://developer.apple.com/documentation/watchos-apps/creating-independent-watchos-apps), [local notification scheduling](https://developer.apple.com/documentation/usernotifications/scheduling-a-notification-locally-from-your-app). Exact API compatibility is checked against the installed SDK. No guaranteed background network delivery is asserted.

## watchOS26.5 simulator follow-up (2026-10-14)

The runtime was installed after the initial unsigned compile. The unsigned app launched, but Keychain correctly rejected it with `-34018` (no application identifier); an unsigned compile is therefore **not** the installation recipe. For isolated simulator QA only, Xcode injected an `application-identifier` of `org.labnest.watch` from the evidence file `docs/structured-protocol/20261014/followup-evidence/watch-simulator/simulator-only.entitlements`, with `CODE_SIGN_IDENTITY=- CODE_SIGNING_ALLOWED=YES CODE_SIGN_ENTITLEMENTS=<absolute evidence path>`. Real devices must use the actual signing team/provisioning profile. Never use a simulator-only identifier as a device signing configuration. [Apple explains the required app/keychain entitlements](https://developer.apple.com/documentation/security/errsecmissingentitlement).

On the isolated production candidate at localhost:3341, the app was paired via a one-use code generated in the real Run page. It displayed50µL/200µL, completed a step with explicit confirmation, started/paused a10minute timer, retained585seconds after restart, queued a completion while the server was stopped, retained the exact request after restart, and synchronized it once on reconnection (revision6→7, one DB event). The webpage then showed3/3completed. This is a synthetic software fixture, not a biological experiment or a physical Watch measurement.

A collapsed wheel picker discovered during this run was replaced by a navigation-list picker; the actual fixed list and quantity text were inspected. Complex tables/images still remain on the phone. No notification permission was requested in this simulator run, and physical lockscreen delivery remains unexecuted. Evidence: `docs/structured-protocol/20261014/followup-evidence/watch-simulator/`.

A failed re-pair now keeps the existing connection, shows the error beside the pairing control and leaves settings open. Only a successful pair triggers refresh/close. Both invalid-code and valid-code paths were operated in the simulator; `final-regression.json` and `repair-error-preserved.png` capture the result.

## Mix cards on the watch (2026-10-15)

A step whose mix card (配液卡) was confirmed on the phone or computer shows **配液卡 · <name>**. It opens one component per screen: the name and this run's total in large type, the per-reaction amount beneath. Turn the digital crown, or double tap (watchOS 11 and later, via `handGestureShortcut(.primaryAction)` on **下一项**), to move on; tap a screen to cross the component off (and tap again to undo). Crossing off is shared with the phone, needs a connection, is never queued offline and never counts as progress. The last screen is the aliquot instruction. An unconfirmed card, or one changed after confirmation, only shows a note asking to confirm it on the phone.

Server contract: `GET /api/watch/runs/:id` adds `mixes` to each step (`stale`, `note`, `quantity`, `aliquot`, `lines[{ id, name, mode, total, perReaction, struck }]`); `POST` accepts `intent: "strike"` with `mixId`, one `lineId` and its new `struck` state (one line per request, so phone and watch never undo each other). Older snapshots without `mixes` still decode.

Verification so far: the unsigned watchsimulator build compiles, and the server snapshot was checked against a confirmed 24-reaction card. The new screens have **not** been exercised in the simulator or on a device.
