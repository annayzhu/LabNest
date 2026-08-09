# LabNest local persistent service

LabNest uses two Docker services for stable local and phone access:

- `labnest-postgres`: PostgreSQL with the persistent `labnest-postgres` volume.
- `labnest-app`: the production Next.js server on port 3000.
- `labnest-attachments`: the persistent attachment-file volume.

The App container automatically generates Prisma Client, applies pending migrations, creates a production build when the container is first created, and starts `next start`. Both containers use `restart: unless-stopped`, so Docker Desktop can restore them after a reboot.

On this Mac, Docker Desktop is also registered as a hidden macOS login item. After the user signs in, Docker Desktop starts in the background and restores both LabNest containers. Manually stopping a container is respected by `unless-stopped`; run `npm run docker:up` to enable it again.

Stable entry points:

- Computer: `http://localhost:3000`
- Phone on the same Wi-Fi: `http://192.168.0.102:3000`

The phone address follows the Mac's LAN IP and can change after reconnecting to the router.

## Start or rebuild after code changes

```bash
npm run docker:up
```

Rebuilding creates a new App container with the current source. It does not reset PostgreSQL or delete attachments.

## Check status

```bash
npm run docker:status
curl http://localhost:3000/api/health
```

The App should report `healthy`, and the health endpoint should return `status: ok` with `database: reachable`.

## View startup logs

```bash
npm run docker:logs
```

## Development mode

Use `npm run dev` only while actively editing. Stop the Docker App first if it owns port 3000, or run development on another port. The stable computer and phone entry should use the Docker App.

## Data safety

- PostgreSQL data remains in the `labnest-postgres` Docker volume.
- Attachments are stored in the `labnest-attachments` Docker volume. During the initial migration, existing files from `storage/attachments` are copied into this volume; the original host files are retained as an additional recovery copy.
- Do not run `docker compose down -v` unless permanent database-volume deletion is explicitly intended.
