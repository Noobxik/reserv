import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const safeSelect = {
  id: true, name: true, baseUrl: true, username: true, isActive: true, createdAt: true, updatedAt: true,
} as const;

/** GET /api/admin/panels/[id] */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const panel = await prisma.xuiPanel.findUnique({ where: { id }, select: safeSelect });
  if (!panel) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(panel);
}

/** PUT /api/admin/panels/[id] */
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = (await req.json()) as {
    name?: string;
    baseUrl?: string;
    username?: string;
    /** Plain-text password — only provided when changing */
    password?: string;
    isActive?: boolean;
  };

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.baseUrl !== undefined) data.baseUrl = body.baseUrl.replace(/\/$/, "");
  if (body.username !== undefined) data.username = body.username;
  if (body.password) data.encryptedPassword = encrypt(body.password);
  if (body.isActive !== undefined) data.isActive = body.isActive;

  const panel = await prisma.xuiPanel.update({ where: { id }, data, select: safeSelect });
  return NextResponse.json(panel);
}

/** DELETE /api/admin/panels/[id] */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  await prisma.xuiPanel.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
