import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeEmail, verifyOtpHash } from "@/lib/otp";

export const runtime = "nodejs";

const PURPOSE = "REGISTER";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { email?: string; otp?: string } | null;
  const email = normalizeEmail(body?.email ?? "");
  const otp = String(body?.otp ?? "").trim();
  if (!email || !otp) {
    return NextResponse.json({ error: "Email and OTP are required." }, { status: 400 });
  }

  const row = await prisma.emailOtp.findUnique({
    where: { email_purpose: { email, purpose: PURPOSE } },
  });
  if (!row) return NextResponse.json({ error: "No OTP request found for this email." }, { status: 404 });
  if (row.verifiedAt) return NextResponse.json({ error: "This OTP is already used." }, { status: 400 });
  if (row.expiresAt < new Date()) return NextResponse.json({ error: "OTP expired. Please resend OTP." }, { status: 400 });
  if (row.attempts >= 5) return NextResponse.json({ error: "Too many invalid attempts. Resend OTP." }, { status: 429 });

  if (!verifyOtpHash(email, otp, row.codeHash)) {
    await prisma.emailOtp.update({
      where: { id: row.id },
      data: { attempts: { increment: 1 } },
    });
    return NextResponse.json({ error: "Invalid OTP." }, { status: 400 });
  }

  let payload: { name?: string; passwordHash?: string; schoolId?: string; role?: string } = {};
  try {
    payload = JSON.parse(row.payload || "{}");
  } catch {
    payload = {};
  }
  if (!payload.passwordHash || !payload.schoolId) {
    return NextResponse.json({ error: "Invalid registration payload. Resend OTP." }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existingUser) {
    await prisma.emailOtp.update({
      where: { id: row.id },
      data: { verifiedAt: new Date() },
    });
    return NextResponse.json({ error: "Email is already registered." }, { status: 409 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.create({
      data: {
        email,
        name: payload.name || null,
        passwordHash: payload.passwordHash!,
        role: "SCHOOL",
        schoolId: payload.schoolId!,
        isActive: true,
      },
    });
    await tx.emailOtp.update({
      where: { id: row.id },
      data: { verifiedAt: new Date() },
    });
  });

  return NextResponse.json({ ok: true });
}
