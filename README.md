# LabNest V1

Your personal nest for protocols, notes, samples, and results.

LabNest is a low-cost, high-quality personal lab record tool for individual researchers and small labs. V1 is intentionally manual-first: entries, protocols, experiment runs, inventory transactions, results, purchases, links, and exports should remain usable when AI is disabled.

## What This MVP Includes

- Next.js + TypeScript + Tailwind 4 application shell.
- Warm scientific editorial design system with reusable tokens and components.
- Dashboard with recent entries, experiments, protocols, pending proposed actions, inventory warnings, and activity.
- Journal-like Entry cards.
- Experiment notebook page with formal sections and protocol checklist.
- Protocol editor/read view with versioned protocol data, parameters, steps, consumption rules, and result templates.
- Protocol Run page that shows parameters, step checklist, calculated consumption, result form, and pending actions.
- Lightweight Samples ledger with biological sample profiles, aliquots, storage positions, lifecycle events, warnings, and experiment provenance.
- Inventory table and transaction history. Quantity changes are modeled through transactions.
- Proposed Actions review inbox. Calculations and AI placeholders do not mutate core records directly.
- Entities, Projects, Results, Purchases, Procurement inquiry sheets with ZJU self-purchase `.xlsx` helpers, Sequence library, Settings, and external literature connector placeholders.
- Search page and `/api/search` endpoint across notes, experiments, protocols, entities, samples, inventory, results, purchases, procurement quote lines, and sequences.
- Attachments page with local file upload storage, metadata capture, record links, and download endpoint.
- Export page with database-backed CSV exports for inventory, results, and entities, JSON protocol export, and a metadata backup snapshot.
- Manual AI copy-paste workbench for ChatGPT/Claude web subscriptions. It generates prompts and validates pasted JSON into proposed actions without API keys.
- Prisma 7 schema for PostgreSQL, Docker Compose, and seed data.
- Unit tests for protocol consumption calculation, inventory transaction logic, procurement inquiry conversion, sequence utilities, and manual AI response parsing.

## Scientific Data Integrity Rules

- AI is optional and subordinate to manual workflows.
- AI and protocol calculations can only create proposed actions.
- Users must accept, edit, reject, and execute actions before data changes.
- Entry, Experiment, Protocol, and ProtocolVersion records share the lightweight `draft -> recorded -> submitted -> reviewed` lifecycle.
- Protocols are versioned, and confirmed local parameter changes create a new `ProtocolVersion` instead of mutating the prior version.
- Experiments created from protocols store the exact protocol version used.
- Inventory quantity changes should occur through `InventoryTransaction`.
- Direct inventory quantity edits should be represented as `adjust` transactions.
- Multi-supplier inquiry spreadsheets should remain lightweight procurement evidence. Only selected quote lines should become `PurchaseRequest` records.
- Unselected quote lines should be retained with a decision reason such as higher price, duplicate, rejected, expired, or future candidate.
- School self-purchase exports should be generated from selected quote lines and grouped by supplier because the ZJU self-purchase form accepts one supplier's rows at a time.
- Sample identity should stay separate from vial-level aliquots: `SampleProfile` tracks the biological source, while `InventoryItem` tracks physical stock and location.
- Sample lifecycle events should capture provenance such as aliquot, store, thaw, consume, QC, discard, and result-link events without adding a hospital-grade approval workflow.
- Attachment binaries remain in local storage; database backups export attachment metadata and storage paths, not embedded binary payloads.
- Literature management should remain external. LabNest stores Zotero/EndNote connector configuration and citation links, not a full embedded literature database.
- ChatGPT/Claude web subscriptions use manual copy-paste mode. LabNest does not automate browser login, scrape subscription pages, or require API keys.
- Demo records are not biological conclusions.

## Local Development

```bash
npm install
cp .env.example .env
docker compose up -d postgres
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

Open http://localhost:3000.

The current UI renders from typed demo data so it is immediately browsable even before connecting pages to live database reads. The Prisma schema and seed are ready for the database-backed implementation path.

## Quality Checks

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Important Paths

- `src/app/` - Next.js routes.
- `src/components/` - reusable UI and LabNest object components.
- `src/lib/protocol.ts` - protocol formula evaluation, record lifecycle helpers, and parameter-change version generation.
- `src/lib/inventory.ts` - transaction-first inventory logic.
- `src/lib/procurement.ts` - lightweight inquiry, selected quote-line conversion, and ZJU self-purchase template helpers.
- `src/lib/procurement-excel.ts` - narrow `.xlsx` read/write helpers for the school self-purchase template shape.
- `src/lib/samples.ts` - lightweight sample ledger helpers for aliquot totals, lifecycle sorting, and sample warnings.
- `src/lib/attachments.ts` - local attachment root, filename, and path safety helpers.
- `src/lib/search.ts` - typed demo search index used by the search page.
- `src/lib/export.ts` - CSV and download response helpers.
- `src/lib/ai.ts` - manual copy-paste AI provider boundary and proposed-action parsing.
- `src/lib/sequence.ts` - lightweight sequence utilities.
- `src/lib/demo-data.ts` - V1 demo data used by the UI.
- `prisma/schema.prisma` - PostgreSQL data model.
- `prisma/seed.ts` - demo project, protocols, entities, samples, inventory, procurement records, experiment run, proposed actions, AI providers, and reference connectors.
- `public/brand/labnest-editorial-workspace.png` - generated editorial dashboard asset.

## Known Gaps For The Next Pass

- Wire pages to Prisma reads/writes and server actions.
- Add real CRUD forms and validation feedback.
- Add persisted Excel upload UI for procurement inquiries and save generated exports as attachments.
- Add action handlers behind the simplified UI surfaces, then restore only the buttons that perform real work.
- Expand exports with Markdown/PDF report views and scheduled backup rotation.
- Expand database-backed full-text search, saved filters, and tag facet counts.
- Implement encrypted API-key persistence and real provider adapters only if API-key mode is needed later.
- Implement Zotero/EndNote connector adapters for citation lookup and linked attachments.
