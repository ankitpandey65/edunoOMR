import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import {
  generateOtpCode,
  hashOtp,
  normalizeEmail,
  otpExpirySeconds,
  otpResendSeconds,
} from "@/lib/otp";
import { sendOtpEmail } from "@/lib/email-otp-delivery";

export const runtime = "nodejs";

const PURPOSE = "REGISTER";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as
    | { email?: string; name?: string; password?: string; schoolCode?: string }
    | null;
  const email = normalizeEmail(body?.email ?? "");
  const name = String(body?.name ?? "").trim();
  const password = String(body?.password ?? "");
  const schoolCode = String(body?.schoolCode ?? "")
    .trim()
    .toUpperCase();

  if (!email) return NextResponse.json({ error: "Email is required." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (!password || password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }
  if (!schoolCode) {
    return NextResponse.json({ error: "School code is required." }, { status: 400 });
  }

  const school = await prisma.school.findUnique({
    where: { code: schoolCode },
    select: { id: true, isActive: true },
  });
  if (!school || !school.isActive) {
    return NextResponse.json({ error: "Invalid or inactive school code." }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existingUser) {
    return NextResponse.json({ error: "This email is already registered." }, { status: 409 });
  }

  const now = new Date();
  const existingOtp = await prisma.emailOtp.findUnique({
    where: { email_purpose: { email, purpose: PURPOSE } },
  });
  if (existingOtp && existingOtp.resendAfter > now) {
    const retryAfterSec = Math.max(1, Math.ceil((existingOtp.resendAfter.getTime() - now.getTime()) / 1000));
    return NextResponse.json(
      { error: "Please wait before requesting a new OTP.", retryAfterSec },
      { status: 429 }
    );
  }

  const code = generateOtpCode();
  const codeHash = hashOtp(email, code);
  const expiresAt = new Date(now.getTime() + otpExpirySeconds() * 1000);
  const resendAfter = new Date(now.getTime() + otpResendSeconds() * 1000);
  const passwordHash = await hashPassword(password);

  const payload = JSON.stringify({
    name,
    passwordHash,
    schoolId: school.id,
    role: "SCHOOL",
  });

  await prisma.emailOtp.upsert({
    where: { email_purpose: { email, purpose: PURPOSE } },
    create: {
      email,
      purpose: PURPOSE,
      codeHash,
      payload,
      expiresAt,
      resendAfter,
      attempts: 0,
      verifiedAt: null,
    },
    update: {
      codeHash,
      payload,
      expiresAt,
      resendAfter,
      attempts: 0,
      verifiedAt: null,
    },
  });

  const delivery = await sendOtpEmail({ to: email, code, purposeLabel: "registration" });
  return NextResponse.json({
    ok: true,
    cooldownSec: otpResendSeconds(),
    expiresSec: otpExpirySeconds(),
    delivery: delivery.channel,
  });
}
