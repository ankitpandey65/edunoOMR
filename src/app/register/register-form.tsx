"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type SchoolOption = { code: string; name: string };

export function RegisterForm({ schools }: { schools: SchoolOption[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [schoolCode, setSchoolCode] = useState(schools[0]?.code ?? "");
  const [otp, setOtp] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const emailValid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()), [email]);

  async function sendOtp() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/register/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, password, schoolCode }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        cooldownSec?: number;
        delivery?: string;
      };
      if (!res.ok) {
        setError(j.error || "Failed to send OTP.");
        if (typeof j.cooldownSec === "number") setCooldown(j.cooldownSec);
        return;
      }
      setOtpSent(true);
      setCooldown(typeof j.cooldownSec === "number" ? j.cooldownSec : 30);
      setMessage(
        j.delivery === "console"
          ? "OTP sent in server-console mode (mail provider not configured)."
          : "OTP sent to your email."
      );
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/register/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean };
      if (!res.ok || !j.ok) {
        setError(j.error || "OTP verification failed.");
        return;
      }
      setMessage("Registration successful. Redirecting to login...");
      setTimeout(() => router.push("/login"), 900);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {error ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div> : null}
      {message ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          {message}
        </div>
      ) : null}

      <div>
        <label className="label">Email (mandatory)</label>
        <input
          type="email"
          className="input"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@school.edu"
        />
      </div>
      <div>
        <label className="label">Name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
      </div>
      <div>
        <label className="label">Password</label>
        <input
          type="password"
          className="input"
          minLength={6}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 6 characters"
        />
      </div>
      <div>
        <label className="label">School</label>
        <select className="input" value={schoolCode} onChange={(e) => setSchoolCode(e.target.value)} required>
          {schools.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name} ({s.code})
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || !emailValid || !password || !schoolCode || cooldown > 0}
          onClick={sendOtp}
        >
          {otpSent ? "Resend OTP" : "Send OTP"}
        </button>
        <span className="self-center text-xs text-slate-400">
          {cooldown > 0 ? `Resend available in ${cooldown}s` : "You can resend OTP now."}
        </span>
      </div>

      {otpSent ? (
        <>
          <div>
            <label className="label">Enter OTP</label>
            <input
              className="input font-mono tracking-[0.25em]"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D+/g, "").slice(0, 6))}
              placeholder="123456"
            />
          </div>
          <button type="button" className="btn btn-primary w-full" disabled={busy || otp.length !== 6} onClick={verifyOtp}>
            Verify OTP & Register
          </button>
        </>
      ) : null}
    </div>
  );
}
