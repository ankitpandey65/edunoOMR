import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import type { Role } from "@prisma/client";

const COOKIE = "eduno_session";
const TTL = 60 * 60 * 24 * 7;

export type SessionPayload = {
  sub: string;
  role: Role;
  schoolId: string | null;
  email: string;
};

function secretKey() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error("Set AUTH_SECRET (min 16 chars) in .env");
  }
  return new TextEncoder().encode(s);
}

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

async function shouldUseSecureCookie() {
  const override = String(process.env.SESSION_COOKIE_SECURE ?? "")
    .trim()
    .toLowerCase();
  if (override === "true") return true;
  if (override === "false") return false;
  if (process.env.NODE_ENV !== "production") return false;

  try {
    const h = await headers();
    const proto = String(h.get("x-forwarded-proto") ?? "")
      .split(",")[0]
      .trim()
      .toLowerCase();
    if (proto) return proto === "https";
  } catch {
    // Ignore header lookup errors in non-request contexts.
  }
  return false;
}

export async function signSession(payload: SessionPayload) {
  const token = await new SignJWT({
    role: payload.role,
    schoolId: payload.schoolId,
    email: payload.email,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${TTL}s`)
    .sign(secretKey());

  const jar = await cookies();
  const secure = await shouldUseSecureCookie();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: TTL,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const sub = payload.sub;
    if (!sub || typeof sub !== "string") return null;
    const role = payload.role as Role | undefined;
    const email = payload.email as string | undefined;
    if (!role || !email || (role !== "ADMIN" && role !== "SCHOOL")) return null;
    const schoolId =
      payload.schoolId === null || payload.schoolId === undefined
        ? null
        : String(payload.schoolId);
    return { sub, role, schoolId, email };
  } catch {
    return null;
  }
}

export async function requireSession() {
  const s = await getSession();
  if (!s) throw new Error("Unauthorized");
  return s;
}

export async function requireAdmin() {
  const s = await requireSession();
  if (s.role !== "ADMIN") throw new Error("Forbidden");
  return s;
}

export async function requireSchool() {
  const s = await requireSession();
  if (s.role !== "SCHOOL" || !s.schoolId) throw new Error("Forbidden");
  return { ...s, schoolId: s.schoolId };
}

export async function loginWithEmailPassword(email: string, password: string) {
  const emailNorm = email.toLowerCase().trim();
  const h = await headers();
  const ip = String(h.get("x-forwarded-for") ?? "")
    .split(",")[0]
    .trim();
  const userAgent = String(h.get("user-agent") ?? "").trim();
  const accessLogModel = (prisma as unknown as { accessLog?: any }).accessLog;

  async function writeAccessLog(data: {
    userId?: string | null;
    email: string;
    role?: Role | null;
    action: string;
    success: boolean;
    details?: string;
  }) {
    if (!accessLogModel) return;
    try {
      await accessLogModel.create({
        data: {
          userId: data.userId ?? null,
          email: data.email,
          role: data.role ?? null,
          action: data.action,
          success: data.success,
          details: data.details ?? null,
          ip: ip || null,
          userAgent: userAgent || null,
        },
      });
    } catch {
      // Access logging must never block login flow.
    }
  }

  const user = await prisma.user.findUnique({
    where: { email: emailNorm },
    include: { school: true },
  });
  if (!user) {
    await writeAccessLog({
      email: emailNorm,
      action: "LOGIN",
      success: false,
      details: "Unknown email",
    });
    return { error: "Invalid email or password" as const };
  }
  if (!user.isActive) {
    await writeAccessLog({
      userId: user.id,
      email: user.email,
      role: user.role,
      action: "LOGIN",
      success: false,
      details: "User disabled",
    });
    return { error: "This account has been disabled. Contact your administrator." as const };
  }
  if (user.role === "SCHOOL" && user.schoolId) {
    const school = user.school;
    if (!school?.isActive) {
      await writeAccessLog({
        userId: user.id,
        email: user.email,
        role: user.role,
        action: "LOGIN",
        success: false,
        details: "School disabled",
      });
      return { error: "School access is suspended. Contact the platform administrator." as const };
    }
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    await writeAccessLog({
      userId: user.id,
      email: user.email,
      role: user.role,
      action: "LOGIN",
      success: false,
      details: "Invalid password",
    });
    return { error: "Invalid email or password" as const };
  }
  await signSession({
    sub: user.id,
    role: user.role,
    schoolId: user.schoolId,
    email: user.email,
  });
  await writeAccessLog({
    userId: user.id,
    email: user.email,
    role: user.role,
    action: "LOGIN",
    success: true,
    details: "Login success",
  });
  return { ok: true as const, role: user.role };
}
