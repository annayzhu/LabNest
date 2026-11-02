# Automatic LAN discovery — 2026-11-02

## Change

The field-mode device panel previously asked for an IP and kept it in `labnest:lan-origin`; a network change could leave the QR code pointing to the old address. It now ignores that saved origin, discovers current physical LAN IPv4 addresses when opened, and refreshes every 5 seconds. Only the port is editable, with 3001 as the example. Multiple physical networks are offered as detected choices. The port initially matches the browser's external port, never Docker's internal 3000.

Docker Desktop cannot use its container interface as the computer's Wi-Fi address. A per-user host discovery service writes a read-only shared snapshot every 5 seconds; snapshots older than 20 seconds are rejected. Discovery failure hides the QR code and offers retry. The service starts at login. See `docs/operations/local-docker.md` for installation and scope.

## Verification before deployment

- 13 focused unit tests: physical-interface selection; VPN, bridge, invalid and expired address rejection; port validation; native/container route behavior; existing field-mode links.
- 11 existing i18n tests passed. Changed code passed ESLint.
- Isolated production build, including TypeScript, passed. The shared development `.next/types` has stale unrelated route references; it was not used for release validation or modified.
- `scripts/verify-lan-discovery.mjs`: Chromium and WebKit, English at 1440 px and Chinese at 390 px. All four passed automatic host discovery, stale localStorage rejection, editable/invalid port behavior, actual QR decoding, simulated Wi-Fi change, discovery loss and recovery, and horizontal-overflow checks. No browser page errors.
- Read-only actual-host health request via the current LAN address returned HTTP 200.
- Existing data/configuration preflight found only the intended `LABNEST_NETWORK_FILE` addition; no existing application environment key was removed or changed.

Re-run browser checks with `LABNEST_E2E_BASE_URL=http://localhost:3001 node scripts/verify-lan-discovery.mjs`. Evidence defaults to `/tmp/labnest-lan-qa`; use `LABNEST_E2E_OUTPUT` to preserve it elsewhere.

## Limits

Browser tests use desktop browser engines with phone dimensions, not a physical iPhone. Simulated Wi-Fi changes validate UI refresh; this check did not disconnect the computer's real network. Same-LAN reachability from a phone still depends on its network, guest-network isolation, firewall and VPN routing. This change does not provide cross-network connectivity. No database schema or application data changes are involved.
