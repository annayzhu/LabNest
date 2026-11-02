# LabNest local persistent service

LabNest uses two Docker services for stable local and phone access:

- `labnest-postgres`: PostgreSQL with the persistent `labnest-postgres` volume.
- `labnest-app`: the production Next.js server on port 3000.
- `labnest-attachments`: the persistent attachment-file volume.

The App container automatically generates Prisma Client, applies pending migrations, creates a production build when the container is first created, and starts `next start`. Both containers use `restart: unless-stopped`, so Docker Desktop can restore them after a reboot.

On this Mac, Docker Desktop is also registered as a hidden macOS login item. After the user signs in, Docker Desktop starts in the background and restores both LabNest containers. Manually stopping a container is respected by `unless-stopped`; run `npm run docker:up` to enable it again.

Stable entry points:

- Computer: `http://localhost:3001`
- Phone on the same Wi-Fi: automatically generated in **Run mode → Other devices**

The phone address follows the Mac's LAN IP and can change after reconnecting to the router.

## Start or rebuild after code changes

```bash
npm run docker:up
```

Rebuilding creates a new App container with the current source. It does not reset PostgreSQL or delete attachments.

## Check status

```bash
npm run docker:status
curl http://localhost:3001/api/health
```

The App should report `healthy`, and the health endpoint should return `status: ok` with `database: reachable`.

## View startup logs

```bash
npm run docker:logs
```

## Development mode

Use `npm run dev` only while actively editing. Stop the Docker App first if it owns port 3001, or run development on another port. The stable computer and phone entry should use the Docker App.

## Data safety

- PostgreSQL data remains in the `labnest-postgres` Docker volume.
- Attachments are stored in the `labnest-attachments` Docker volume. During the initial migration, existing files from `storage/attachments` are copied into this volume; the original host files are retained as an additional recovery copy.
- Do not run `docker compose down -v` unless permanent database-volume deletion is explicitly intended.

## Automatic LAN address discovery

On macOS, `npm run docker:up` installs/refreshes a per-user LaunchAgent before starting Docker. It reads physical Wi-Fi/Ethernet IPv4 interfaces every 5 seconds and atomically writes `~/.labnest/network/addresses.json`. The application mounts this directory read-only at `/host-network`; it never substitutes Docker's internal IP. The helper runs at login and is restarted on failure. Reinstall it after moving/removing the Node executable with `npm run network:install`.

The device panel requests `/api/network-addresses` when opened and every 5 seconds while open. Snapshots older than 20 seconds are rejected, and unavailable discovery hides the QR code. Previously saved `labnest:lan-origin` values are ignored. The current browser port is the default; only the port is editable (for example, 3001). Changing it changes the link, not the actual server port mapping. With multiple physical networks, the panel offers the automatically detected addresses. Existing public-domain links remain unchanged.

Discovery covers private IPv4 LANs (10/8, 172.16/12, 192.168/16). VPN, loopback, link-local and virtual bridge interfaces are excluded. Guest Wi-Fi isolation, firewalls and disconnected phones cannot be diagnosed by host address detection; an address is not proof of phone reachability.

Linux native execution reads interfaces directly. For Docker on Linux, supervise `npm run network:watch` on the host, then use `docker compose up -d --build app` (the login-service installer is macOS-specific). If using `LABNEST_NETWORK_DIR`, supply the same directory to the host helper and Compose. Uninstall the macOS helper with `launchctl bootout gui/$(id -u)/com.labnest.lan-discovery` and remove `~/Library/LaunchAgents/com.labnest.lan-discovery.plist`.
