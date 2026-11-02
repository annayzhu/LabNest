# Watch synchronization feedback — 2026-11-02

The user reported tapping Sync without any visible response. The previous `WatchModel.refresh` cleared the message after a successful read, even when unchanged data was successfully fetched. The button also showed no in-flight state or last successful sync time. A rejected queued write additionally threw before reading the latest snapshot.

The watch now shows progress, a success message with completed/total steps, and the time of the last successful read. Failure keeps the last snapshot/time and an explicit error. A server-rejected write remains queued with its original operation ID/revision and conflict explanation, while a GET refreshes the current state. Old timer operations remain held for explicit review; no delayed timer starts or automatic conflict rebasing were added.

Validation:

- `python3 scripts/verify-watch-sync.py --baseline f4e97fd5` reproduces the missing-success-feedback assertion.
- `python3 scripts/verify-watch-sync.py` passes. The runner extracts the exact production Codable declarations and `refresh` method unchanged, compiles them with Swift, and supplies isolated network/storage/widget/notification doubles. Checks cover unchanged-success feedback, request progress, repeat reads, failure/retry state, saved snapshot preservation, conflict followed by GET, original-revision retention, timer review, acknowledged queue clearance and unpaired guidance. These are synthetic software tests, not operations on real experimental records.
- The full companion project's Watch scheme builds for watchOS Simulator and for generic physical watchOS with signing. The signed Watch app passes `codesign --verify --deep --strict`.
- No server API, database schema or stored experimental record was changed. Existing uncommitted Xcode project formatting and unrelated web changes are excluded from the commit.

Updating port 3001 alone cannot update a previously installed Watch binary. Device installation receipts and release-version verification are saved under `.local-runtime/releases/watch-sync-20261102/`; signed installation does not by itself prove the user has tapped the updated button on the real watch.
