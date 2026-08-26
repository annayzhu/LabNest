# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

LabNest primarily serves individual biomedical researchers and small laboratory teams who plan, execute, calculate, document, and review bench experiments. Calculator users may work at a desktop bench computer, tablet, or phone and need quick, trustworthy answers without leaving the research workspace.

## Product Purpose

LabNest is a low-cost, manual-first research workspace for protocols, experiments, samples, inventory, results, and focused scientific tools. The Calculator module provides a coherent set of reusable experimental calculations while keeping complex LabNest records and external standalone tools clearly separated.

Success means a researcher can select a narrowly defined calculation, enter scientifically meaningful values with explicit units, understand the method and warnings, obtain a reproducible result, and reuse plate-aware calculations without copying formulas or values between tools.

## Positioning

LabNest combines provenance-aware research records with deterministic, browser-local experimental utilities. The main Calculator keeps the complete formula catalog; the six plate-aware formulas are also packaged into Free Plate Layout so its standalone HTML remains functional. Shared method-version identifiers and parity tests are required whenever either surface changes.

## Operating Context

- Researchers use Calculator before, during, and after wet-lab work for cell culture, solution preparation, molecular biology, microbiology, virology, and general unit conversion.
- Free Plate Layout Planner remains the plate-planning workspace. Calculations whose results depend on selected wells, treatment groups, replicates, plate count, or per-well volume also appear there through a plate-aware adapter.
- Calculation inputs and outputs are browser-local by default. Calculator does not automatically write to LabNest projects, Results, Attachments, or the database.
- Uploaded colony or plaque images are transient counting inputs only. They are not retained in results, history, browser storage, exports, attachments, or the database.
- The reference screen recording is interaction research only. Its visual skin, copy, taxonomy, defaults, and algorithms are not a product specification and must not be copied.

## Capabilities and Constraints

- Calculator contains 31 complete calculators grouped into cell culture, solutions, molecular biology, virology and microbiology, and general utilities.
- Calculator is available from Tools and as a quick action on the Overview page.
- Free Plate presents one unified calculation workspace: the four established liquid-preparation modules remain unchanged, while six missing plate-aware capabilities (Seeding, Hydrogel, Kill Curve, Fold Dilution, Master Mix, and plate-mode MOI) run directly in the same drawer, including when the standalone HTML is opened without LabNest. Overlapping dilution, transfection, serial-gradient, and dosing workflows continue through the richer established plate modules instead of appearing as duplicate buttons.
- Calculator supports bilingual Chinese and English labels, scientific abbreviations, aliases, search, favorites, reusable presets, and the 50 most recent structured calculation records.
- Calculation records retain inputs, units, method version, outputs, warnings, and time. Users can delete one record or clear all records.
- Colony Counter is a formal image-assisted counting tool with visible detections and mandatory human review. It is not labeled Beta and must not imply that automated counts are ground truth.
- All tools must expose the formula or method, assumptions, units, validation errors, range warnings, and relevant method limitations. Scientific methods and defaults require independent validation; the reference app is not an authority.
- The module is responsive on desktop, tablet, and 390 px mobile screens. Complex plate editing remains optimized for desktop or landscape use, while plate-aware calculations remain callable on mobile.
- Core calculations remain deterministic and browser-local. No cloud or AI dependency is required.

## Brand Commitments

- Preserve the existing LabNest name and its restrained scientific editorial identity.
- Calculator belongs visually to LabNest. It should use the incumbent light, cool violet-gray system rather than reproduce the reference app's dark green appearance.
- Interface language should be concise, explicit, and scientifically conservative. Exploratory or research-use calculations must not be framed as clinical advice.

## Evidence on Hand

- The existing LabNest implementation, design tokens, Tools manifest, Overview quick actions, and Free Plate Layout Planner are the incumbent product and interface evidence.
- The supplied Lab Assistant screen recording demonstrates useful interaction patterns such as grouped discovery, focused calculators, compact inputs, result cards, method explanations, copy actions, and favorites. It is not evidence for scientific formulas or default values.
- Existing Free Plate Layout calculations already cover routine solution preparation, transfection, serial dilution, drug gradients, overage handling, minimum pipetting volume, and cross-plate summaries.
- No performance, accuracy, or clinical claims are available and none may be fabricated.

## Product Principles

1. One authoritative calculation implementation, multiple context-specific adapters.
2. Explicit units, assumptions, method provenance, warnings, and reproducible outputs.
3. Browser-local and privacy-preserving by default; persistence is deliberate and reversible.
4. Focused task interfaces that remain complete without becoming visually heavy.
5. Plate context is reused where it changes the calculation or execution plan; general calculations stay independent.

## Accessibility & Inclusion

- Keyboard operation, visible focus, semantic labels, sufficient contrast, touch-friendly controls, and non-color-only status communication are required.
- Chinese and English terminology must remain searchable and understandable without relying on unexplained abbreviations.
- Desktop, tablet, and 390 px mobile layouts are part of the acceptance surface.
