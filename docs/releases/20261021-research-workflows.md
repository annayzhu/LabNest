# Research workflow review · 2026-10-21

This release integrates the local photo/manual/Copilot work with main at `7bab13d7`. It retains the existing mobile menus, unified capture editor, Watch pairing, bundled tools and verified backup behavior. The three additive migrations introduce the vision-provider selection, manual-search settings and Copilot run table. They do not remove existing tables or columns.

Review corrections:

- Inventory pages retain one package-operation area and add the manual card alongside it.
- The merged translation dictionary contains one loading-message key.
- A Copilot design is supported only by a verified extraction for the same question and matching experiment method/name. An unrelated experiment in the same paper is insufficient. The new regression failed before the correction.
- Experiments created by adoption keep their scientific question, purpose/readouts/controls, literature identifiers and uncertainty text in the existing purpose field. Removing the Copilot run leaves those records intact. A regression verifies the database readback after adoption and run removal.

## Verification

- 1,440 unit tests; TypeScript; lint (no errors, 12 pre-existing warnings); Prisma schema validation; webpack production build. All new migrations apply to a disposable PostgreSQL 16 database.
- Photo recognition: absent vision provider, 50-photo cap, three concurrent requests, one failed photo/retry, page order, no persisted image attachments, transcription saved as the source of a four-step draft Protocol.
- Manuals: inventory upload/readback, internal search with AI off, extraction into a Protocol, one web search on allowed vendors, encrypted key retained without exposing it in the page.
- Copilot: purpose-only start, five stages with tool calls, full-text/abstract distinction, adoption/ignore and database writes, stop/resume between stages, create/adjust from the overview, and uncertainty/source preservation when creating an experiment.

The three feature browser scripts use an isolated development server and local model/search/literature stand-ins. Production disables those stand-in URLs; production compilation and the existing production browser suites are separate checks. These tests do not establish real model transcription accuracy, literature completeness or scientific validity. Physical iPhone/HEIC camera behavior and Chinese IME were not exercised.

## Editor acceptance scope

| Real route | Changed behavior | Evidence |
| --- | --- | --- |
| Entry create/edit | Optional metadata disclosure; existing document media unchanged | Entry persistence/draft/pending-save CI and mobile capture CI |
| Research Plan create/edit/detail | Optional metadata and adopted Copilot blocks | Copilot DB readback; existing document editor CI |
| Experiment create/edit | Optional metadata; adopted purpose includes sources | Copilot adopted-experiment DB readback; existing editor CI |
| Protocol create/edit/import | Optional metadata; photo/manual sources | Photo/manual browser scripts and Protocol consistency CI |
| Result and Report edit | Optional metadata | Existing document/Entry cross-route browser CI |

These map to C06/C08/C09/E01/F06/F07 of the staged requirements. Existing long-document, table, image identity and save/reopen checks remain in CI. Export rendering was not changed. The final GitHub checks on the exact PR head are the release gate; local checks alone do not replace them. Private runtime settings, user records and historical generated evidence are excluded from the source commit.
