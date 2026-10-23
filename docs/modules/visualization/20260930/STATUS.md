# Studio P0 integration acceptance — 2026-10-01

Baseline main e16ff99af1d3a8facc7eff54d4352d89bcbeb4d3. Final tested code 8b31986adf1ce356e47ad848cf2191f973b73c6e. Branch codex/studio-link-p0-20260930, isolated checkout /private/tmp/labnest-studio-link-p0-20260930. The original LabNest branch and its unique work remain untouched.

Integration issue [#84](https://github.com/annayzhu/LabNest/issues/84); independent implementation [Studio #46](https://github.com/annayzhu/Visualization-studio/issues/46). Contract: first-batch P0 only. Studio maintains its own P0 ledger/evidence. This checkout changes integration and retires exact enumerated duplicate code, not independent scientific algorithms.

| Requirement | Result | Evidence |
|---|---|---|
| Configurable external Tools link, opens independent product in new tab | 通过 / VERIFIED | actual 1440/390 browser entry → Studio → SVG download; entry SVGs and screenshots |
| Old bookmark, no recoverable preference | 通过 / VERIFIED | redirects to configured independent address |
| Old same-origin preferences | 通过 / VERIFIED | synthetic custom palette → migration download → independent import → project export equality; original localStorage preserved |
| Missing address | 通过 / VERIFIED | actual production runtime with empty URL displays configuration alert and remains on legacy route |
| Unreachable address | 通过 / VERIFIED | external target failure leaves Tools accessible; with old data, migration/download remains available |
| Subpath deployment | 通过 / VERIFIED | Studio separate final-code build at /visualization-studio/, nine prefixed resources + mobile SVG; evidence in Studio repo |
| Retirement prerequisites | 通过 / VERIFIED | baseline libraries/renderers compared; 102 exact file/blob entries in retirement-inventory.json, baseline source recoverable; shared UI remains |
| Full root regression | 通过 / VERIFIED | 526 tests in each timezone Asia/Shanghai and America/Vancouver; full lint, typecheck, production build pass after retirement |
| Source data preservation | 通过 / VERIFIED | no schema/migration change; current runtime schema SHA matches this checkout; no real data written in acceptance |
| PR / merge / live runtime | 待发布 / IMPLEMENTED | add RELEASE.md only after deployment; the tests alone do not prove release |

Reproduce from LabNest checkout: `TZ=Asia/Shanghai npm test`, `TZ=America/Vancouver npm test`, `npm run lint`, `npm run typecheck`, `npm run build`; then `STUDIO_TEST_ROOT=/path/to/built-independent-studio node scripts/verify-studio-link.mjs`. Build/tests use a deliberately unreachable synthetic DATABASE_URL; test does not require database fixtures. Commands/logs are evidence/*.txt. Tests own ports 33117/33118/33120/33121 and terminate them.

**失败：** final executed checks none. **未执行：** physical phone/soft keyboard/160% actual zoom, real researcher trial, actual historical private browser data, public/trusted-HTTPS/cross-network access. Synthetic fixtures do not prove every old user record recovered. P1/P2 are outside this contract. Migration imports the saved custom collection; users explicitly choose the desired palette afterward. The download retains the original preference selection as well.

Live deployment must preserve PostgreSQL and attachment volumes, application secret and external tool URLs. Do not run down -v or rebuild from the dirty original checkout. Keep old runtime as rollback and record exact merged SHA, image/process path, health and LAN entry.
