/** Server time calibration is read-only and must never be served from an offline cache. */
export function GET() {
  return Response.json({ serverTime: Date.now() }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
