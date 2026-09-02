import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const pageSize = 30;

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const params = new URL(request.url).searchParams;
  const kind = params.get("kind");
  const page = Math.max(0, Number.parseInt(params.get("page") ?? "0", 10) || 0);

  if (kind === "protocols") {
    const links = await prisma.researchPlanProtocol.findMany({
      where: { researchPlanId: id },
      select: { isPrimary: true, protocol: { select: { id: true, humanCode: true, canonicalTitle: true, title: true } } },
      orderBy: { createdAt: "desc" },
      skip: page * pageSize,
      take: pageSize + 1,
    });
    return Response.json({
      items: links.slice(0, pageSize).map(({ protocol, isPrimary }) => ({
        id: protocol.id,
        href: `/protocols/${protocol.id}`,
        title: `${protocol.humanCode} · ${protocol.canonicalTitle ?? protocol.title}`,
        primary: isPrimary,
      })),
      hasMore: links.length > pageSize,
    });
  }

  if (kind === "records") {
    const perType = Math.ceil(pageSize / 2);
    const [experiments, entries] = await Promise.all([
      prisma.experiment.findMany({
        where: { researchPlanId: id },
        select: { id: true, runCode: true, title: true, date: true, status: true },
        orderBy: { date: "desc" },
        skip: page * perType,
        take: perType + 1,
      }),
      prisma.entry.findMany({
        where: { researchPlanId: id },
        select: { id: true, title: true, occurredAt: true, recordStatus: true },
        orderBy: { occurredAt: "desc" },
        skip: page * perType,
        take: perType + 1,
      }),
    ]);
    return Response.json({
      items: [
        ...experiments.slice(0, perType).map((experiment) => ({
          id: experiment.id,
          href: `/experiments/${experiment.id}`,
          title: `${experiment.runCode} · ${experiment.title}`,
          meta: `Experiment · ${experiment.date.toLocaleDateString()} · ${experiment.status.replaceAll("_", " ")}`,
        })),
        ...entries.slice(0, perType).map((entry) => ({
          id: entry.id,
          href: `/entries/${entry.id}`,
          title: entry.title,
          meta: `Entry · ${entry.occurredAt.toLocaleDateString()} · ${entry.recordStatus.replaceAll("_", " ")}`,
        })),
      ],
      hasMore: experiments.length > perType || entries.length > perType,
    });
  }

  return Response.json({ error: "Unsupported relation kind." }, { status: 400 });
}
