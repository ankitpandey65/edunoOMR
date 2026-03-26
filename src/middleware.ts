import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE = "eduno_session";

function getSecret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) return null;
  return new TextEncoder().encode(s);
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const secret = getSecret();
  if (!secret) {
    if (path.startsWith("/admin") || path.startsWith("/school")) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE)?.value;

  if (!token) {
    if (path.startsWith("/admin") || path.startsWith("/school")) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  try {
    const { payload } = await jwtVerify(token, secret);
    const role = payload.role as string | undefined;

    if (path.startsWith("/admin") && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (path.startsWith("/school") && role !== "SCHOOL") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  } catch {
    if (path.startsWith("/admin") || path.startsWith("/school")) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/school/:path*"],
};
