# Engineering integration

Visualization Studio is a standalone Next.js 16 application. Its scientific calculations, uploaded inputs, previews, and exports run in the browser; it has no database or upload API. The safest integration keeps this repository as an independently built application and mounts it at a stable web path.

## Deliverables for an engineer

Provide the repository plus these deployment decisions:

- public URL, for example `/visualization-studio/`
- hostname and port for the Node process
- reverse-proxy ownership and TLS termination
- whether the host application opens the studio as a full page, a menu route, or an iframe
- desired Content Security Policy `frame-ancestors` when iframe embedding is used

The repository already includes source code, the lockfile, example/template data, SVG/PNG/config export, unit and browser tests, and a standalone production build configuration.

## Build at the site root

```bash
npm ci
npm run verify
npm run test:e2e
```

For a conventional Node deployment:

```bash
npm run build:webpack
PORT=3000 HOSTNAME=0.0.0.0 npm run start
```

## Build for a sub-path

`basePath` is compiled into the Next.js client bundles. Set it during the build and rebuild whenever the public path changes:

```bash
NEXT_PUBLIC_VISUALIZATION_STUDIO_BASE_PATH=/visualization-studio npm run build:webpack
PORT=3000 HOSTNAME=0.0.0.0 npm run start
```

Do not add the hash route from the host application to this value. `/single/#/home/index` is a client-side route; the studio needs a real server path such as `/visualization-studio/`.

## Standalone runtime

The production build creates `.next/standalone/server.js`. Next.js does not copy static assets by default, so this repository runs `scripts/prepare-standalone.mjs` after each build to assemble them automatically. Start or transfer the prepared runtime:

```bash
PORT=3000 HOSTNAME=0.0.0.0 node .next/standalone/server.js
```

Copy the complete `.next/standalone` directory to the server. The target host does not need the full development dependency tree.

## Reverse proxy example

This Nginx location exposes the app at the same origin as the existing website. Build with `NEXT_PUBLIC_VISUALIZATION_STUDIO_BASE_PATH=/visualization-studio` first.

```nginx
location = /visualization-studio {
    return 308 /visualization-studio/;
}

location /visualization-studio/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $http_host;
    proxy_set_header X-Forwarded-Host $http_host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

The exact redirect and the prefix location are both required. The repository sets `trailingSlash: true`, so `/visualization-studio/` is the canonical application URL while `/visualization-studio/_next/...` remains under the same proxy prefix.

Verify the HTML, `/_next` assets under the configured base path, downloadable SVG/PNG/config files, and refresh behavior before exposing the menu entry.

## Embed in the existing hash-routed application

For `http://47.105.55.185:18150/single/#/home/index`, add a host-application route or menu item whose component contains an iframe. Same-origin hosting avoids cross-origin download and security-policy surprises:

```html
<iframe
  title="Visualization Studio"
  src="/visualization-studio/"
  style="display:block;width:100%;height:calc(100vh - 64px);border:0;background:#f7f7f5"
  sandbox="allow-scripts allow-same-origin allow-downloads"
></iframe>
```

If the studio is served from another origin, use the full HTTPS URL, review the iframe sandbox, and configure the studio response policy to allow only the intended host, for example:

```http
Content-Security-Policy: frame-ancestors 'self' http://47.105.55.185:18150
```

Do not use `X-Frame-Options: DENY` or `SAMEORIGIN` for a cross-origin iframe. Prefer HTTPS for both applications in production; browsers may block mixed active content when an HTTPS host embeds an HTTP studio.

## Integration contract

- Preserve the studio viewport width; the app owns its responsive desktop/mobile layout.
- Do not restyle internal DOM selectors from the host application.
- Allow browser downloads for SVG, 600 dpi PNG, template data, and JSON configuration.
- Uploaded data remains in the browser. Avoid adding analytics that capture textarea contents or file names.
- The default exported figure is 340 × 340 px with Arial, black semantic text, and the Chinese-traditional 柴染棕 palette.
- Re-run the release gate after upgrading Next.js, React, spreadsheet parsing, or any renderer.

## Acceptance check after deployment

1. Open the studio directly and through the host route.
2. Select a plot at the bottom of the desktop list; its complete preview should be brought into view without page hunting.
3. On a phone-sized viewport, confirm that the collapsed plot selector and palette show only the current choices.
4. Load Example 1, edit a numeric parameter directly, and export SVG, PNG, template data, and config.
5. Confirm that every network request stays under the intended origin and that uploaded data produces no request body.
6. Run `npm run test:e2e` against the release source before promotion.
