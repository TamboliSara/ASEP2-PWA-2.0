/**
 * Seamless SMS OTP Service (Zero reCAPTCHA)
 *
 * Supports:
 * 1. Direct Indian SMS Gateways (Fast2SMS / 2Factor) via API key in .env.local
 * 2. Custom Webhook / Backend SMS endpoint (VITE_SMS_WEBHOOK_URL)
 * 3. In-memory / Realtime verification for instant, frictionless flow
 */

interface StoredOtp {
  code: string;
  expiresAt: number;
  phone: string;
}

const otpStore = new Map<string, StoredOtp>();

export interface SendOtpResult {
  success: boolean;
  message?: string;
  isSimulated?: boolean;
  code?: string;
}

/**
 * Dispatches a 6-digit OTP to the entered phone number with ZERO reCAPTCHA.
 */
export async function sendSeamlessOtp(rawPhoneNumber: string): Promise<SendOtpResult> {
  const digits = rawPhoneNumber.replace(/\D/g, "");
  const normalizedPhone = digits.slice(-10);

  if (normalizedPhone.length !== 10) {
    throw new Error("Please enter a valid 10-digit mobile number.");
  }

  // Generate 6-digit OTP
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes validity

  otpStore.set(normalizedPhone, { code, expiresAt, phone: normalizedPhone });

  // 1. Check for Fast2SMS API Key
  const fast2SmsKey = import.meta.env.VITE_FAST2SMS_API_KEY;
  if (fast2SmsKey) {
    try {
      const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
        method: "POST",
        headers: {
          authorization: fast2SmsKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          route: "otp",
          variables_values: code,
          numbers: normalizedPhone
        })
      });
      const data = await response.json();
      if (data.return) {
        return { 
          success: true, 
          isSimulated: false, 
          message: `Real carrier SMS text message sent to +91 ${normalizedPhone} via Fast2SMS.` 
        };
      } else {
        return {
          success: true,
          isSimulated: true,
          code,
          message: data.message || "Fast2SMS requires KYC before delivering live carrier SMS."
        };
      }
    } catch (e) {
      console.warn("[SMS Gateway Error]", e);
    }
  }

  // 2. Check for 2Factor API Key
  const twoFactorKey = import.meta.env.VITE_2FACTOR_API_KEY;
  if (twoFactorKey) {
    try {
      const response = await fetch(`https://2factor.in/API/V1/${twoFactorKey}/SMS/${normalizedPhone}/${code}`);
      const data = await response.json();
      if (data.Status === "Success") {
        return { success: true, message: `SMS text message sent to +91 ${normalizedPhone}` };
      }
    } catch (e) {
      console.warn("[2Factor SMS Error]", e);
    }
  }

  // 3. Check for Custom Webhook / Cloud Function
  const webhookUrl = import.meta.env.VITE_SMS_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalizedPhone, otp: code })
      });
      if (response.ok) {
        return { success: true, message: `SMS text message sent to +91 ${normalizedPhone}` };
      }
    } catch (e) {
      console.warn("[Webhook SMS Error]", e);
    }
  }

  // 4. Default instant dispatch (Seamless presentation mode)
  // Simulate network dispatch delay
  await new Promise((r) => setTimeout(r, 400));

  return {
    success: true,
    isSimulated: true,
    code,
    message: `Verification code dispatched to +91 ${normalizedPhone}`
  };
}

/**
 * Validates the 6-digit OTP entered by the user.
 */
export function verifySeamlessOtp(rawPhoneNumber: string, enteredCode: string): boolean {
  const digits = rawPhoneNumber.replace(/\D/g, "");
  const normalizedPhone = digits.slice(-10);

  const stored = otpStore.get(normalizedPhone);
  if (!stored) {
    return false;
  }

  if (Date.now() > stored.expiresAt) {
    otpStore.delete(normalizedPhone);
    return false;
  }

  if (stored.code === enteredCode.trim()) {
    otpStore.delete(normalizedPhone); // Consume OTP once used
    return true;
  }

  return false;
}
