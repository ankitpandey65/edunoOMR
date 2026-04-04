export async function sendOtpEmail(args: { to: string; code: string; purposeLabel: string }) {
  const resendKey = String(process.env.RESEND_API_KEY ?? "").trim();
  const from = String(process.env.OTP_FROM_EMAIL ?? "").trim();

  if (resendKey && from) {
    const subject = `Eduno OTP - ${args.purposeLabel}`;
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2>Eduno Verification Code</h2>
        <p>Your OTP for <strong>${args.purposeLabel}</strong> is:</p>
        <div style="font-size:28px;font-weight:700;letter-spacing:4px">${args.code}</div>
        <p>This code expires in 10 minutes.</p>
      </div>
    `;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [args.to],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`Failed to send OTP email: ${msg.slice(0, 200)}`);
    }
    return { channel: "resend" as const };
  }

  // Safe fallback for environments without mail provider.
  console.log(`[OTP][${args.purposeLabel}] ${args.to}: ${args.code}`);
  return { channel: "console" as const };
}
