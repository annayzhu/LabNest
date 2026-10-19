import { authorizeWatch, watchRunSnapshot } from '@/lib/watch-execution.server';
import { POST as completeStep } from '@/app/api/mobile/step-completions/route';
import { updateRunTimer } from '@/lib/run-timer.server';
import { z } from 'zod';
type Context = { params: Promise<{ id: string }> };
async function auth(request: Request, context: Context) {
  const { id } = await context.params;
  const deviceId = await authorizeWatch(request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '', id);
  return { id, deviceId };
}
export async function GET(request: Request, context: Context) {
  try { const { id } = await auth(request, context); return Response.json(await watchRunSnapshot(id), { headers: { 'Cache-Control': 'no-store' } }); }
  catch { return Response.json({ error: '连接失效或实验不可读取，请重新配对。' }, { status: 401 }); }
}
const mutation = z.object({ intent: z.enum(['complete','start','pause','reset','finish','strike']), stepId: z.string().min(1), revision: z.number().int().nonnegative(), clientMutationId: z.string().uuid(), deviceCreatedAt: z.string().datetime(), sourceRef: z.string().min(1),
  // Crossing one mix card line off (or back on) while pipetting.
  mixId: z.string().min(1).optional(), lineId: z.string().min(1).optional(), struck: z.boolean().optional() });
export async function POST(request: Request, context: Context) {
  let grant;
  try { grant = await auth(request, context); } catch { return Response.json({ error: '手表连接失效，请重新配对。' }, { status: 401 }); }
  try {
    const input = mutation.parse(await request.json());
    if (input.intent === 'strike') {
      if (!input.mixId || !input.lineId || input.struck === undefined) throw new Error('缺少配液卡组分');
      const { strikeRunMixLine } = await import('@/lib/run-mix.server');
      await strikeRunMixLine({ experimentId: grant.id, stepId: input.stepId, mixId: input.mixId, lineId: input.lineId, struck: input.struck });
      return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (input.intent === 'complete') return completeStep(new Request(request.url, { method: 'POST', body: JSON.stringify({ experimentId: grant.id, experimentStepId: input.stepId, executionPlanRevision: input.revision, clientMutationId: input.clientMutationId, deviceCreatedAt: input.deviceCreatedAt, queueContext: { deviceId: grant.deviceId, actor: 'local-workspace-user', sourceRef: input.sourceRef } }) }));
    await updateRunTimer({ experimentId: grant.id, stepId: input.stepId, expectedRevision: input.revision, timerIntent: input.intent, clientMutationId: input.clientMutationId });
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : '操作未保存，请在手机核对。' }, { status: 409 }); }
}
