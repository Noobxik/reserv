import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** GET /api/admin/keys */
export async function GET() {
  const keys = await prisma.tempKey.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      server: { select: { name: true } },
      panel: { select: { name: true } },
    },
  });
  return NextResponse.json(keys);
}
