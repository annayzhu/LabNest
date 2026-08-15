# LabNest Public Demo

This is the isolated public demonstration build for LabNest.

- It uses synthetic `DEMO-*` records only.
- It does not import the real LabNest app, Prisma client, schema, migrations, or local database helpers.
- It does not define D1, R2, upload, or app-owned authentication bindings.
- Demo interactions persist only in the visitor's browser `localStorage`.

The local LabNest development app remains at the repository root and continues to use Docker/PostgreSQL.
