import { claimWatchPairing } from '@/lib/watch-execution.server';
export async function POST(request: Request) {
  try { const input = await request.json(); return Response.json(await claimWatchPairing(input.code, input.deviceId), { headers: { 'Cache-Control': 'no-store' } }); }
  catch { return Response.json({ error: '配对码失效或已使用。' }, { status: 401 }); }
}
