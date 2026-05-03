import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { XuiClient } from "@/lib/xuiClient";
import { decrypt } from "@/lib/crypto";

export const dynamic = "force-dynamic";

const TEMP_KEY_LIMIT_GIB = 1.5;

export async function POST() {
  try {
    // 1. Ensure at least one main server is down
    const mainServerDown = await prisma.server.findFirst({
      where: { type: "main", status: "down" },
    });

    if (!mainServerDown) {
      return NextResponse.json(
        { error: "All main servers are operational. No backup key is needed." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // 2. Find an active reserve server that has a panel configured
    const reserveServer = await prisma.server.findFirst({
      where: {
        type: "reserve",
        status: "up",
        xuiPanelId: { not: null },
        xuiInboundId: { not: null },
      },
      include: { panel: true },
    });

    if (!reserveServer?.panel || reserveServer.xuiInboundId == null) {
      return NextResponse.json(
        { error: "No reserve servers are available at this time." },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { panel } = reserveServer;

    if (!panel.isActive) {
      return NextResponse.json(
        { error: "Reserve panel is inactive." },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    // 3. Authenticate with the 3x-ui panel
    let plainPassword: string;
    try {
      plainPassword = decrypt(panel.encryptedPassword);
    } catch {
      console.error("[issue-temp-key] Decryption failed");
      return NextResponse.json(
        { error: "Internal configuration error." },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    const xui = new XuiClient(panel.baseUrl);
    await xui.login(panel.username, plainPassword);

    // 4. Fetch inbound details for URI building
    const inbound = await xui.getInbound(reserveServer.xuiInboundId);

    // 5. Create the client in 3x-ui
    const clientId = crypto.randomUUID();
    const clientEmail = `reserve_${Date.now()}_${clientId.slice(0, 8)}`;

    await xui.addClient(
      reserveServer.xuiInboundId,
      clientId,
      clientEmail,
      TEMP_KEY_LIMIT_GIB
    );

    // 6. Build the VLESS URI
    const vlessUri = xui.buildVlessUri(inbound, clientId, clientEmail);

    // 7. Persist the record
    const tempKey = await prisma.tempKey.create({
      data: {
        serverId: reserveServer.id,
        panelId: panel.id,
        inboundId: reserveServer.xuiInboundId,
        clientId,
        clientEmail,
        vlessUri,
      },
    });

    return NextResponse.json(
      {
        key: vlessUri,
        keyId: tempKey.id,
        limitGiB: TEMP_KEY_LIMIT_GIB,
        note: "This key is temporary and will be revoked automatically when the main server is restored.",
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[issue-temp-key]", message);
    return NextResponse.json(
      { error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
