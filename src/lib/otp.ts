import { createHash, randomInt, timingSafeEqual } from "node:crypto";

const OTP_LENGTH = 6;
const OTP_EXPIRY_SECONDS = 10 * 60;
const OTP_RESEND_SECONDS = 30;

function otpSecret() {
  return process.env.AUTH_SECRET || "eduno-otp-fallback-secret";
}

export function otpExpirySeconds() {
  return OTP_EXPIRY_SECONDS;
}

export function otpResendSeconds() {
  return OTP_RESEND_SECONDS;
}

export function normalizeEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

export function generateOtpCode() {
  let code = "";
  for (let i = 0; i < OTP_LENGTH; i++) code += String(randomInt(0, 10));
  return code;
}

export function hashOtp(email: string, code: string) {
  return createHash("sha256")
    .update(`${otpSecret()}|${normalizeEmail(email)}|${String(code).trim()}`)
    .digest("hex");
}

export function verifyOtpHash(email: string, code: string, expectedHash: string) {
  const got = Buffer.from(hashOtp(email, code), "utf8");
  const expected = Buffer.from(String(expectedHash || ""), "utf8");
  if (got.length !== expected.length) return false;
  return timingSafeEqual(got, expected);
}
