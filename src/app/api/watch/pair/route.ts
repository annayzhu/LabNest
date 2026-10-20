import { claimWatchPairing, WatchPairingRateLimitError } from '@/lib/watch-execution.server';
export async function POST(request: Request) {
  try { const input = await request.json(); return Response.json(await claimWatchPairing(input.code, input.deviceId), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) {
    if (error instanceof WatchPairingRateLimitError) return Response.json({ error: error.message }, { status: 429, headers: { 'Retry-After': '600', 'Cache-Control': 'no-store' } });
    return Response.json({ error: '配对码失效或已使用，请重新生成 4 位数字码。' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
}
