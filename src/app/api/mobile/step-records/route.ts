import { recordStructuredStep } from '@/lib/structured-run.server';
export async function POST(request: Request) {
  try {
    const input = await request.json();
    const result = await recordStructuredStep({ ...input, stepId: input.experimentStepId, expectedRevision: input.executionPlanRevision });
    return Response.json(result, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : '实际记录未能同步。' }, { status: 409 });
  }
}
