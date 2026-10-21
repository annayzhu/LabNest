# Selected mobile home · 2026-10-21

Integrates the user's selected `feat/mobile-home-calendar` design from `941e56ad` into main at `e85d1de0`. The earlier simplified four-shortcut home omitted this separately committed design. The selected version includes running/planned counts, four illustrated action tiles with descriptions, today's experiment cards, and an inline week/month calendar with a selected-day agenda.

The integration retains main's backup alert and the photo/manual/Copilot work. No schema, dependencies or stored records change. Original feature branch and source checkout remain intact.

Local validation: 1,440 unit tests, TypeScript, changed-file ESLint and webpack production build pass. Eight production-browser cases pass across Chromium/WebKit at 320/390/820/1440 px, with Chinese/English and a browser timezone different from the server. Checks cover actual database counts, adjacent-month records, four-item agenda truncation and total count, month expansion, week navigation, no page overflow and the desktop Overview. Physical-device touch is not claimed.

The existing mobile test now scopes its running/planned-only assertion to today's experiment card; the separate calendar intentionally shows completed experiments on their scheduled day. The new calendar script runs in mobile CI against the disposable `labnest_mobile_qa` database. Final exact-head CI remains the merge gate.
