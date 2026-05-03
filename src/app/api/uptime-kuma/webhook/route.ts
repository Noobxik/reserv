import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { XuiClient } from "@/lib/xuiClient";
import { decrypt, timingSafeCompare } from "@/lib/crypto";

export const dynamic = "force-dynamic";

/**
 * Uptime Kuma webhook payload shape (simplified).
 * Status: 1 = UP, 0 = DOWN.
 */
interface UptimeKumaPayload {
  heartbeat?: {
    monitorID?: number;
    status?: number;
    msg?: string;
  };
  monitor?: {
    id?: number;
    name?: string;
  };
}

export async function POST(req: NextRequest) {
  // ── Authenticate with shared secret ──────────────────────────────────────
  const expectedSecret = process.env.UPTIME_KUMA_SECRET ?? "";
  if (!expectedSecret) {
    console.error("[webhook] UPTIME_KUMA_SECRET is not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  // Accept secret via query param or header (Uptime Kuma supports both)
  const paramSecret = req.nextUrl.searchParams.get("secret") ?? "";
  const headerSecret = req.headers.get("x-webhook-secret") ?? "";
  const providedSecret = paramSecret || headerSecret;

  if (!timingSafeCompare(providedSecret, expectedSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: UptimeKumaPayload;
  try {
    body = (await req.json()) as UptimeKumaPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const status = body.heartbeat?.status;
  if (status === undefined) {
    return NextResponse.json({ error: "Missing heartbeat.status" }, { status: 400 });
  }

  const statusStr = status === 1 ? "up" : "down";
  const monitorName = body.monitor?.name ?? null;
  const monitorId = body.monitor?.id ?? null;

  // ── Find matching servers ─────────────────────────────────────────────────
  const orClauses: { uptimeMonitorId: string }[] = [];
  if (monitorName) orClauses.push({ uptimeMonitorId: monitorName });
  if (monitorId != null) orClauses.push({ uptimeMonitorId: String(monitorId) });

  let servers =
    orClauses.length > 0
      ? await prisma.server.findMany({ where: { OR: orClauses } })
      : [];

  // Fallback: match by server name
  if (servers.length === 0 && monitorName) {
    servers = await prisma.server.findMany({ where: { name: monitorName } });
  }

  if (servers.length === 0) {
    return NextResponse.json(
      { message: "No matching server found", statusStr },
      { status: 200 }
    );
  }

  // ── Update server status ──────────────────────────────────────────────────
  await prisma.server.updateMany({
    where: { id: { in: servers.map((s) => s.id) } },
    data: { status: statusStr, lastCheckedAt: new Date() },
  });

  // ── Revoke all active temp keys when a server comes back UP ──────────────
  if (status === 1) {
    await revokeAllActiveKeys();
  }

  return NextResponse.json({
    message: "OK",
    updatedServers: servers.length,
    status: statusStr,
  });
}

async function revokeAllActiveKeys(): Promise<void> {
  const activeKeys = await prisma.tempKey.findMany({
    where: { revoked: false },
    include: { panel: true },
  });

  await Promise.allSettled(
    activeKeys.map(async (key) => {
      try {
        const password = decrypt(key.panel.encryptedPassword);
        const xui = new XuiClient(key.panel.baseUrl);
        await xui.login(key.panel.username, password);
        await xui.delClient(key.inboundId, key.clientId);
      } catch (err) {
        // Log but don't abort — always mark as revoked in DB
        console.error(
          `[webhook] Failed to delete client ${key.clientId} from 3x-ui:`,
          err instanceof Error ? err.message : err
        );
      }

      await prisma.tempKey.update({
        where: { id: key.id },
        data: { revoked: true, revokedAt: new Date() },
      });
    })
  );
}
