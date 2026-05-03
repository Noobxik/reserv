import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

export const COOKIE_NAME = "admin_session";

function getSecret(): Uint8Array {
  return new TextEncoder().encode(process.env.JWT_SECRET ?? "");
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Protect admin routes ─────────────────────────────────────────────────
  const isAdminRoute =
    pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

  if (isAdminRoute && pathname !== "/api/admin/auth") {
    const token = req.cookies.get(COOKIE_NAME)?.value;

    if (!token) {
      return unauthorized(req, pathname);
    }

    try {
      const { payload } = await jwtVerify(token, getSecret());
      if (payload.role !== "admin") throw new Error("not admin");
    } catch {
      const res = unauthorized(req, pathname);
      res.cookies.delete(COOKIE_NAME);
      return res;
    }
  }

  return NextResponse.next();
}

function unauthorized(req: NextRequest, pathname: string): NextResponse {
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Redirect browser to admin login page
  const url = req.nextUrl.clone();
  url.pathname = "/admin";
  url.search = "?login=1";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
