import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";

export const dynamic = "force-dynamic";

/** GET /api/admin/panels — list all panels (password is never returned) */
export async function GET() {
  const panels = await prisma.xuiPanel.findMany({
    select: {
      id: true,
      name: true,
      baseUrl: true,
      username: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(panels);
}

/** POST /api/admin/panels */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    name: string;
    baseUrl: string;
    username: string;
    password: string;
    isActive?: boolean;
  };

  if (!body.name || !body.baseUrl || !body.username || !body.password) {
    return NextResponse.json(
      { error: "name, baseUrl, username, and password are required" },
      { status: 400 }
    );
  }

  const encryptedPassword = encrypt(body.password);

  const panel = await prisma.xuiPanel.create({
    data: {
      name: body.name,
      baseUrl: body.baseUrl.replace(/\/$/, ""),
      username: body.username,
      encryptedPassword,
      isActive: body.isActive ?? true,
    },
    select: {
      id: true, name: true, baseUrl: true, username: true, isActive: true, createdAt: true, updatedAt: true,
    },
  });

  return NextResponse.json(panel, { status: 201 });
}
