## Origin-boundary review

Reviewed commit `6db0fd869515e9e4e3d4ab2f42916b752f698dd4` read-only: the Copy POST route, step-order PATCH route, their shared `acceptsRequestOrigin` helper, and four new route-level regression cases. No source edits or test rerun.

**No actionable security or behavior regression found in this patch.** Both routes still reject an invalid origin before reading input or invoking mutation code (`copy/route.ts:4`, `steps/order/route.ts:8`). The helper compares the complete origin, including scheme and non-default port, to the actual Host plus request URL scheme. It does not trust `x-forwarded-host` or other forwarded headers. Malformed origins, non-HTTP(S) origins and malformed Host values fail closed. Missing Origin retains the previous routes' non-browser-client behavior. No authorization, validation, row locking, idempotency or record-protection logic was removed.

**The deployed HTTP port mismatch is addressed.** For internal URL `http://0.0.0.0:3000/...` with preserved Host `172.17.68.235:3001`, the corresponding browser Origin is accepted. A foreign Origin is rejected even when the forwarded host is spoofed. The new tests exercise both actual route exports, so they catch accidental omission of the guard in either route.

**Evidence boundary.** The accepted-origin tests deliberately supply invalid bodies and expect 409: they establish passage through the origin boundary, not successful Copy/reorder or database persistence. The separate rebuilt-container browser actions remain necessary for that claim. HTTPS terminating proxies are not established by these cases; the helper still derives scheme from `request.url` and deliberately ignores forwarded scheme headers. Current HTTP deployment compatibility should not be described as universal proxy support.

Conclusion: this small patch is suitable to proceed to the planned deployed browser recheck. It does not reopen the previously closed source-lock or Watch-origin findings.
