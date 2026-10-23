# Independent Studio migration

Baseline LabNest: e16ff99. Independent Studio: 56316726a176f9b9f9369f9fba36374e18f8535a, P0 work tracked in annayzhu/Visualization-studio#46. LabNest issue #84.

## Retained and retired

The exact tracked retirement list and recoverable Git blob IDs are in retirement-inventory.json. All baseline scientific libraries and renderers matched the independent product. The component differed in LabNest theme-token presentation; the independent product already had its own presentation. No unique algorithm or data capability was found. Shared UI, fonts, LabNest themes, other tools and historical acceptance records remain.

The embedded runtime, its dedicated libraries/tests, and the packaged standalone source are retired after the entry/migration browser test passed. Independent scientific regression remains in the independent repository. The old route is a small same-origin recovery view only. The portable-tools builder continues its other five products and no longer builds a Studio copy. Historical offline packages are not updated or claimed to contain P0.

## User data

Old embedded code persisted only palette selection and custom palette collection in localStorage. Raw input and Config were transient/exported, with no persisted project store. Migration reads only the two enumerated palette keys, downloads a versioned file and never clears them. Import that file in Studio using Open project. Existing .labnest-figure.json files use the same import entry. Data remain browser local; cross-origin storage is never read directly. Actual historical user browser data were not inspected; verification uses synthetic preferences.

## Configuration

Set VISUALIZATION_STUDIO_URL to the actual device-reachable independent endpoint. It supports an absolute HTTP(S) root or subpath; credentials, query strings and fragments are rejected. An unset address opens the migration/configuration page. The manifest does not send data, model keys or session tokens. Tools opens the configured product in a new tab. Docker forwards this variable at runtime.

## Evidence and release

See evidence/link-report.json, desktop/mobile screenshots and exported SVGs. These are temporary localhost builds, not a release claim. Production merge/deploy, subpath and real-device checks remain pending in STATUS.md.
