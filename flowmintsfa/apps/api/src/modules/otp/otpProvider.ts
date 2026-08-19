// OTP delivery adapter — swappable by design (SFA_MVP_Scope_Locked.md §2,
// decision 11). Add a new provider by implementing OtpProvider and
// selecting it in getOtpProvider() based on env.otp.provider. Nothing
// upstream (otpService) needs to change when the provider changes.

import { env } from "../../config/env";

export interface OtpProvider {
  send(phone: string, otp: string): Promise<void>;
}

class ConsoleOtpProvider implements OtpProvider {
  async send(phone: string, otp: string): Promise<void> {
    // Dev/testing fallback — no SMS account configured yet. Never do this
    // in a real deployment; it's only safe because this process's console
    // isn't exposed to the salesman or the public.
    console.log(`[otp:console] would send OTP ${otp} to ${phone}`);
  }
}

class Msg91OtpProvider implements OtpProvider {
  async send(phone: string, otp: string): Promise<void> {
    if (!env.otp.msg91ApiKey) {
      throw new Error(
        "OTP_PROVIDER=msg91 but MSG91_API_KEY is not set. Set it in .env or switch OTP_PROVIDER back to 'console' for dev."
      );
    }
    const res = await fetch("https://control.msg91.com/api/v5/otp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authkey: env.otp.msg91ApiKey,
      },
      body: JSON.stringify({
        mobile: `91${phone}`,
        otp,
        sender: env.otp.msg91SenderId || undefined,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`MSG91 OTP send failed: ${res.status} ${text}`);
    }
  }
}

let cached: OtpProvider | null = null;

export function getOtpProvider(): OtpProvider {
  if (cached) return cached;
  cached = env.otp.provider === "msg91" ? new Msg91OtpProvider() : new ConsoleOtpProvider();
  return cached;
}
