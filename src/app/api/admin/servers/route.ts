import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** GET /api/admin/servers */
export async function GET() {
  const servers = await prisma.server.findMany({
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(servers);
}

/** POST /api/admin/servers */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    name: string;
    country?: string;
    type: string;
    uptimeMonitorId?: string;
    xuiPanelId?: string | null;
    xuiInboundId?: number | null;
  };

  if (!body.name || !body.type) {
    return NextResponse.json({ error: "name and type are required" }, { status: 400 });
  }

  const server = await prisma.server.create({
    data: {
      name: body.name,
      country: body.country ?? "",
      type: body.type,
      uptimeMonitorId: body.uptimeMonitorId || null,
      xuiPanelId: body.xuiPanelId || null,
      xuiInboundId: body.xuiInboundId ?? null,
    },
  });

  return NextResponse.json(server, { status: 201 });
}
