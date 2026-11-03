# qPCR workflow · acceptance on 3002

Scope: PRD P0; P1 deferred. User confirmed four public test seams: planner/mix, Cq/ΔCq/ΔΔCq results/charts, record save/recovery/retry/conflicts, browser/print.

Baseline: LabNest bc52dcfb83f18acf550a00c04b7e23fd6b60e471; Planner 8fd1ce7ef032eacdc6d0c2313bb9d7fc35d02524; Analysis 7e812fc2ed899a16ce8410edaebfeaf6fcc8b36b. Remote main verified 2026-11-03. Existing unrelated changes preserved. Tool work uses clean temporary clones because original directories contain uncommitted work.

1. Record-bound output contract and durable draft → behavioral tests for insertion, update, retry, merge and conflict.
2. Existing planner and analyzer extensions → regression values, state roundtrip, copy and chart completeness.
3. Contextual document integration and saved print → end-to-end synthetic records and desktop/tablet/mobile checks.
4. Review, commit and isolated 3002 deployment → source hashes and health. No publication to main or 3001 in this acceptance round.

UI mode: Operate. Preserve LabNest tokens, typography, controls, document structure. Primary order: inputs → full plate → mix → save; result → import/review → chart → insert → print. Method/provenance belong in details; normal state has no instruction banners. Full workspace retains editor underneath and returns focus to its launch position.
