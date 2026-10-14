# LabNest Watch — first execution client

This is a separate SwiftUI watchOS client, not a web layout. It uses the same captured Protocol, deterministic system resolution, guarded step-completion API and locked timer transitions as LabNest. No formulas or source editing are copied into the watch.

## Build and install

Open `LabNestWatch.xcodeproj` in Xcode. Select your own signing team and connected Apple Watch (watchOS 10 or later). Build and run on that device. No signing account or provisioning profile is committed; deployment to port3001 does **not** install this app. The user has requested Apple Watch support, but no connected watch or iPhone was discoverable during development. Xcode26.6 / watchOS simulator SDK26.5 compile checks do not prove runtime behavior. The available simulators are iOS26.5 only.

For a reproducible unsigned compile:

```sh
xcodebuild -project native/LabNestWatch/LabNestWatch.xcodeproj -target LabNestWatch -configuration Debug -sdk watchsimulator SYMROOT=/tmp/labnest-watch-build CODE_SIGNING_ALLOWED=NO build
```

## Connect and use

1. On the phone/desktop Run, choose and confirm experimental systems. Expand **Apple Watch 执行端 · 预览**, then generate a one-use pairing code (10 minutes).
2. In the installed watch app enter the reachable LabNest base URL and code. Use the phone keyboard offered by watchOS if available. `localhost` on the watch is not your Mac. Use a trusted HTTPS endpoint where possible; local HTTP networking depends on the device/ATS configuration and remains unverified here.
3. Refresh, select the exact experimental group/step, scroll through the full text and quantities. No fixed line limit is imposed. Complex tables/images and required actual-value entry stay on the phone.
4. Start/pause/finish a timer online. Timer expiry does not complete a step. Explicitly confirm completion only after doing the operation.
5. An offline completion is atomically persisted and labelled pending. Only one pending action is allowed; it retains the original revision. Foreground refresh retries that same operation ID. Conflicts remain local for review; no silent revision replacement. Offline timer controls are deliberately unavailable.
6. Enable reminders only on the intended reminder device. Notifications use timer/experiment/revision IDs; fresh sync removes earlier scheduled reminders and schedules current deadlines. Permissions and actual delivery are separate. Offline watches cannot immediately learn cancellation from another device.
7. “断开本实验的手表连接” revokes grants and outstanding pairing codes. Tokens are stored hashed on the server and in Keychain on the watch; snapshots/pending records are atomic files. No token is placed in a URL or log.

## Acceptance boundaries

The server tests cover one-use pairing, experiment scope, revoke, independent 50/80µL quantities, shared work once, real completion and repeat-request deduplication. The native target compiles. Installation, native navigation, scrolling at Dynamic Type, disconnection/reconnection, physical timer accuracy and actual notification arrival are **未执行**; E07/E08 remain open until performed. Do not claim that a paired watch receiving a notification can already execute this app.

This local LabNest instance has the existing trusted-workspace access model, not new multi-user identity. `local-workspace-user` is an honest actor label, not an authenticated person's identity. Do not expose the existing local application publicly without its own access-control deployment.

Apple references consulted: [Independent watchOS apps](https://developer.apple.com/documentation/watchos-apps/creating-independent-watchos-apps), [local notification scheduling](https://developer.apple.com/documentation/usernotifications/scheduling-a-notification-locally-from-your-app). Exact API compatibility is checked against the installed SDK. No guaranteed background network delivery is asserted.
