import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ShieldCheck, 
  Smartphone, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  KeyRound,
  Edit2,
  Sparkles,
  Send
} from "lucide-react";
import { sendSeamlessOtp, verifySeamlessOtp } from "../../services/smsAuth";

interface InlineOtpVerifierProps {
  phoneNumber: string;
  isVerified: boolean;
  onVerified: (verified: boolean, timestamp?: string) => void;
  disabled?: boolean;
}

export function InlineOtpVerifier({
  phoneNumber,
  isVerified,
  onVerified,
  disabled = false
}: InlineOtpVerifierProps) {
  const [otpSent, setOtpSent] = useState(false);
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [countdown, setCountdown] = useState<number>(0);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deliveryInfo, setDeliveryInfo] = useState<{ isSimulated?: boolean; code?: string; message?: string } | null>(null);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const prevPhoneRef = useRef<string>(phoneNumber);

  const isPhoneValid = /^\d{10}$/.test(phoneNumber.replace(/\D/g, ""));

  // Reset OTP state if user edits the phone number
  useEffect(() => {
    if (prevPhoneRef.current !== phoneNumber) {
      prevPhoneRef.current = phoneNumber;
      if (isVerified) {
        onVerified(false);
      }
      setOtpSent(false);
      setDigits(["", "", "", "", "", ""]);
      setErrorMessage(null);
      setDeliveryInfo(null);
      setCountdown(0);
    }
  }, [phoneNumber, isVerified, onVerified]);

  // 30s Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleSendOtp = async () => {
    if (!isPhoneValid || disabled) return;

    setIsSending(true);
    setErrorMessage(null);

    try {
      const result = await sendSeamlessOtp(phoneNumber);
      setDeliveryInfo({
        isSimulated: result.isSimulated,
        code: result.code,
        message: result.message
      });
      setOtpSent(true);
      setCountdown(30);
      setDigits(["", "", "", "", "", ""]);
      setIsSending(false);

      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    } catch (err: any) {
      setIsSending(false);
      setErrorMessage(err.message || "Failed to send OTP. Please try again.");
    }
  };

  const handleDigitChange = (index: number, val: string) => {
    setErrorMessage(null);

    // Handle full 6-digit paste
    const rawVal = val.replace(/\D/g, "");
    if (rawVal.length >= 6) {
      const nextDigits = rawVal.slice(0, 6).split("");
      setDigits(nextDigits);
      inputRefs.current[5]?.focus();
      triggerVerify(nextDigits.join(""));
      return;
    }

    // Single digit input
    const singleDigit = rawVal.slice(-1);
    const updated = [...digits];
    updated[index] = singleDigit;
    setDigits(updated);

    if (singleDigit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (updated.every((d) => d !== "") && updated.join("").length === 6) {
      triggerVerify(updated.join(""));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const triggerVerify = (codeToVerify?: string) => {
    const code = codeToVerify || digits.join("");
    if (code.length !== 6) {
      setErrorMessage("Please enter all 6 digits.");
      return;
    }

    setIsVerifying(true);
    setErrorMessage(null);

    setTimeout(() => {
      setIsVerifying(false);
      const isValid = verifySeamlessOtp(phoneNumber, code);
      if (isValid) {
        onVerified(true, new Date().toISOString());
      } else {
        setErrorMessage("Invalid OTP code. Please check and try again.");
      }
    }, 350);
  };

  const handleQuickFill = () => {
    if (!deliveryInfo?.code) return;
    const splitCode = deliveryInfo.code.split("");
    setDigits(splitCode);
    triggerVerify(deliveryInfo.code);
  };

  return (
    <div className="w-full mt-2 mb-3">
      {/* ── ALREADY VERIFIED CARD ── */}
      {isVerified ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative overflow-hidden p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 backdrop-blur-md shadow-[0_4px_24px_rgba(16,185,129,0.12)] flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                  Mobile Verified
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                  <CheckCircle2 className="w-3 h-3" /> OTP Passed
                </span>
              </div>
              <p className="text-sm font-semibold text-text mt-0.5 font-mono">
                +91 {phoneNumber.replace(/(\d{5})(\d{5})/, "$1 $2")}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              onVerified(false);
              setOtpSent(false);
              setDigits(["", "", "", "", "", ""]);
            }}
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-emerald-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-emerald-500/10 border border-transparent hover:border-emerald-500/20 cursor-pointer"
            title="Re-verify or change mobile number"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Change</span>
          </button>
        </motion.div>
      ) : (
        /* ── VERIFICATION PENDING STATE (ZERO RECAPTCHA) ── */
        <div className="p-4 rounded-2xl border border-line bg-panel/30 backdrop-blur-md shadow-sm">
          {!otpSent ? (
            /* Action to Request OTP */
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-accent/10 border border-accent/20 text-accent">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-text">Verify Mobile Number</p>
                  <p className="text-[11px] text-text-muted">
                    {isPhoneValid 
                      ? `Instant 6-digit OTP will be dispatched to +91 ${phoneNumber}.`
                      : "Enter your 10-digit mobile number to request an OTP."}
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={!isPhoneValid || isSending || disabled}
                onClick={handleSendOtp}
                className={`relative inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 ${
                  isPhoneValid && !disabled
                    ? "bg-accent hover:bg-accent-hover text-white shadow-md hover:shadow-accent/20 cursor-pointer active:scale-95"
                    : "bg-line/40 text-text-muted/60 cursor-not-allowed border border-line"
                }`}
              >
                {isSending ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send OTP</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            /* OTP Digits Input Card */
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              {/* Delivery notification banner */}
              <div className="p-3 rounded-xl bg-accent/10 border border-accent/30 text-text flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-accent/20 flex items-center justify-center text-accent shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-accent">
                      {deliveryInfo?.isSimulated ? "OTP Dispatched (Test Notice)" : "Carrier SMS Dispatched"}
                    </p>
                    <p className="text-[11px] text-text-muted">
                      {deliveryInfo?.message ? (
                        <span>{deliveryInfo.message}</span>
                      ) : deliveryInfo?.isSimulated ? (
                        <span>
                          Testing Code: <strong className="font-mono text-xs text-accent font-bold tracking-widest">{deliveryInfo.code}</strong>
                        </span>
                      ) : (
                        `Check your SMS inbox (+91 ${phoneNumber}) for the 6-digit code.`
                      )}
                    </p>
                  </div>
                </div>

                {deliveryInfo?.isSimulated && (
                  <button
                    type="button"
                    onClick={handleQuickFill}
                    className="px-2.5 py-1 rounded-md bg-accent/20 hover:bg-accent/30 text-accent font-bold text-[11px] border border-accent/40 cursor-pointer transition-colors"
                  >
                    Quick Fill
                  </button>
                )}
              </div>

              {/* 6 Digit Input Boxes */}
              <div className="flex flex-col items-center gap-2 pt-1">
                <div className="flex items-center justify-center gap-2 sm:gap-3 w-full">
                  {digits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => { inputRefs.current[idx] = el; }}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      className={`w-10 h-12 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-bold font-mono rounded-xl border bg-panel/60 text-text transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-accent ${
                        digit
                          ? "border-accent shadow-[0_0_12px_rgba(20,184,166,0.25)]"
                          : "border-line"
                      }`}
                      placeholder="•"
                    />
                  ))}
                </div>

                {errorMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-1.5 text-xs text-rose-500 mt-1"
                  >
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{errorMessage}</span>
                  </motion.div>
                )}
              </div>

              {/* Action buttons: Resend & Manual Verify */}
              <div className="flex items-center justify-between pt-1 border-t border-line/40 text-xs">
                <div className="text-text-muted">
                  {countdown > 0 ? (
                    <span>Resend in <strong className="text-text tabular-nums">{countdown}s</strong></span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={isSending}
                      className="text-accent hover:underline font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" /> Resend OTP
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => triggerVerify()}
                  disabled={digits.some((d) => !d) || isVerifying}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                    !digits.some((d) => !d) && !isVerifying
                      ? "bg-accent hover:bg-accent-hover text-white shadow-md cursor-pointer"
                      : "bg-line/40 text-text-muted cursor-not-allowed border border-line"
                  }`}
                >
                  {isVerifying ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Verify Code</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
