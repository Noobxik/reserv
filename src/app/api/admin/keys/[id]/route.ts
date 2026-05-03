import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { XuiClient } from "@/lib/xuiClient";
import { decrypt } from "@/lib/crypto";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * DELETE /api/admin/keys/[id]
 * Manually revoke a key: delete it from 3x-ui and mark it revoked in the DB.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  const key = await prisma.tempKey.findUnique({
    where: { id },
    include: { panel: true },
  });

  if (!key) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (key.revoked) return NextResponse.json({ error: "Key already revoked" }, { status: 409 });

  // Attempt to delete from 3x-ui panel
  try {
    const password = decrypt(key.panel.encryptedPassword);
    const xui = new XuiClient(key.panel.baseUrl);
    await xui.login(key.panel.username, password);
    await xui.delClient(key.inboundId, key.clientId);
  } catch (err) {
    console.error(
      `[admin/keys] Failed to delete client ${key.clientId} from 3x-ui:`,
      err instanceof Error ? err.message : err
    );
    // Continue — mark revoked in DB even if 3x-ui call failed
  }

  const updated = await prisma.tempKey.update({
    where: { id },
    data: { revoked: true, revokedAt: new Date() },
    select: { id: true, revoked: true, revokedAt: true },
  });

  return NextResponse.json(updated);
}
