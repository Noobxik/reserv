import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const servers = await prisma.server.findMany({
    select: {
      id: true,
      name: true,
      country: true,
      type: true,
      status: true,
      lastCheckedAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const mainDown = servers.some((s) => s.type === "main" && s.status === "down");
  const reserveUp = servers.some((s) => s.type === "reserve" && s.status === "up");

  return NextResponse.json(
    {
      servers,
      backupMode: mainDown && reserveUp,
      mainDown,
      reserveAvailable: reserveUp,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
