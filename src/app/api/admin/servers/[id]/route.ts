import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** GET /api/admin/servers/[id] */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const server = await prisma.server.findUnique({ where: { id } });
  if (!server) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(server);
}

/** PUT /api/admin/servers/[id] */
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = (await req.json()) as {
    name?: string;
    country?: string;
    type?: string;
    status?: string;
    uptimeMonitorId?: string | null;
    xuiPanelId?: string | null;
    xuiInboundId?: number | null;
  };

  const server = await prisma.server.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.country !== undefined && { country: body.country }),
      ...(body.type !== undefined && { type: body.type }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.uptimeMonitorId !== undefined && { uptimeMonitorId: body.uptimeMonitorId || null }),
      ...(body.xuiPanelId !== undefined && { xuiPanelId: body.xuiPanelId || null }),
      ...(body.xuiInboundId !== undefined && { xuiInboundId: body.xuiInboundId }),
    },
  });

  return NextResponse.json(server);
}

/** DELETE /api/admin/servers/[id] */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  await prisma.server.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
