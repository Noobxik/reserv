import { NextRequest, NextResponse } from "next/server";
import { timingSafeCompare } from "@/lib/crypto";
import { signAdminToken, COOKIE_NAME } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** POST /api/admin/auth — verify password and issue session cookie */
export async function POST(req: NextRequest) {
  let body: { password?: string };
  try {
    body = (await req.json()) as { password?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { password } = body;
  const adminSecret = process.env.ADMIN_SECRET ?? "";

  if (!password || !adminSecret || !timingSafeCompare(password, adminSecret)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const token = await signAdminToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 86400,
    path: "/",
  });
  return res;
}

/** DELETE /api/admin/auth — clear session cookie */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE_NAME);
  return res;
}
