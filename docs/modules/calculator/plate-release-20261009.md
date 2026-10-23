# Unified plate release delivery

User authorization: merge the independent preparation release with LabNest, update
Desktop Tools offline package and LabNest's Tools link. Refs independent
`annayzhu/Plate-Layout-Planner#42`, continuing AC11/AC12. LabNest baseline:
`461844ce7c088800d59f8f30937aa2f46dda8f35` (PR92 already merged).

## Acceptance

1. Independent app owns plate state, names, clear layout, zoom, current-plan
   lifecycle, summaries and exports. LabNest imports a versioned manifest with
   hash parity; only a declared HTML host insertion differs.
2. Preserve LabNest's full Master Mix editor and plate-aware seeding, hydrogel,
   kill curve and MOI through the existing Calculator, with request/source/scope
   validation and full input restore. Do not duplicate the Master Mix card.
   Fold dilution is in Routine preparation; existing Calculator fold plans can
   still be edited through the host adapter.
3. Preserve typed component identities, separate templates without overage,
   compatible cross-plate premix and one effective plan per plate. Export table,
   instructions and source/destination operations; stale plans are excluded.
4. Tools links to the new version on the existing origin/path so browser storage
   is retained. Desktop gets the matching standalone release, validated from a
   fresh ZIP extraction. Old Desktop copy is retired recoverably only afterwards.
5. Run focused and full tests, browser workflows including exported-file readback,
   build, review, PR and merge; then verify actual deployed LabNest link/runtime.
   Do not close the issue until all delivery surfaces pass. No database/schema
   migration, AI branch changes or ChatGPT Site deployment is part of this work.

## Boundaries

Offline and LabNest use identical plate runtime files but intentionally different
Master Mix editors: standalone needs no server; LabNest uses its full Calculator.
Host-created plans retain backup/export snapshots offline; editing those plans
requires LabNest and is explicitly explained in the offline UI.

Historical LabNest static downloads keep their six Calculator forms and local
service-worker cache through `labnest-offline.js`. This compatibility adapter is
loaded only by the declared host insertion and runs only outside the embedded
LabNest route; it uses the existing engine and canonical plan transaction rather
than copying formulas or project state. It is not part of the independent r17
desktop bundle. The original offline-cache regression and six save/reopen/draft
lifecycle checks remain required.

`node scripts/sync-plate-release.mjs /path/to/verified-release` checks hashes before
copying. `free-plate-integration.test.ts` detects asset drift. The host adapter
does not read or mutate localStorage; publishing calls the release's transaction.

Evidence will be recorded after verification, not inferred from merged PR status.
