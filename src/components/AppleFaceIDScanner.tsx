import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, User, Camera } from 'lucide-react';

interface AppleFaceIDScannerProps {
  onVerify: (imageData?: string) => void;
}

export function AppleFaceIDScanner({ onVerify }: AppleFaceIDScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [scanStatus, setScanStatus] = useState<"idle" | "scanning" | "success" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [hasConsented, setHasConsented] = useState(false);
  const [isCheckboxChecked, setIsCheckboxChecked] = useState(false);

  useEffect(() => {
    if (hasConsented) {
      startCamera();
    }
    return () => stopCamera();
  }, [hasConsented]);

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const startCamera = async () => {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } } 
      });
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
      setTimeout(() => setScanStatus("scanning"), 1000);
    } catch (err) {
      console.error("Camera error:", err);
      setScanStatus("error");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const captureImage = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = 300; // low-res for DB storage
      canvas.height = 300;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Draw centered and mirrored
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        const aspect = videoRef.current.videoWidth / videoRef.current.videoHeight;
        let sWidth = videoRef.current.videoHeight;
        let sHeight = videoRef.current.videoHeight;
        let sx = (videoRef.current.videoWidth - sWidth) / 2;
        let sy = 0;
        ctx.drawImage(videoRef.current, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.6);
      }
    }
    return null;
  };

  useEffect(() => {
    if (scanStatus === "scanning") {
      const interval = setInterval(() => {
        setProgress(p => {
          if (p >= 100) {
            clearInterval(interval);
            const capturedData = captureImage();
            setScanStatus("success");
            setTimeout(() => {
              onVerify(capturedData || undefined);
            }, 1500);
            return 100;
          }
          return p + 2; // increments of 2% every 50ms => 2.5 seconds total
        });
      }, 50);
      return () => clearInterval(interval);
    }
  }, [scanStatus, onVerify]);

  if (!hasConsented) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm mx-auto bg-panel backdrop-blur-xl border border-line rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent to-accent-warm" />
        
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-xl bg-accent/10 text-accent">
            <User size={24} />
          </div>
          <div>
            <h3 className="font-bold text-text text-lg">Identity Verification</h3>
            <p className="text-xs text-text-muted">Security Protocol Requirements</p>
          </div>
        </div>

        <div className="space-y-4 mb-8">
          <div className="flex items-start gap-3 text-sm text-text-muted">
            <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
            <p>Ensure your face is clearly visible, centered, and well-lit.</p>
          </div>
          <div className="flex items-start gap-3 text-sm text-text-muted">
            <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
            <p>Remove any masks, sunglasses, or heavy headwear.</p>
          </div>
          <div className="flex items-start gap-3 text-sm text-text-muted">
            <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
            <p>Position yourself securely within the frame guide.</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-black/20 border border-line/50 mb-8">
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative flex items-center justify-center shrink-0 mt-0.5">
              <input 
                type="checkbox" 
                className="peer sr-only"
                checked={isCheckboxChecked}
                onChange={(e) => setIsCheckboxChecked(e.target.checked)}
              />
              <div className="w-5 h-5 rounded border-2 border-text-muted/40 peer-checked:border-accent peer-checked:bg-accent transition-all duration-200" />
              <svg className="absolute w-3.5 h-3.5 text-black opacity-0 peer-checked:opacity-100 transition-opacity duration-200 pointer-events-none" viewBox="0 0 14 10" fill="none">
                <path d="M1 5L4.5 8.5L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-[11px] text-text-muted group-hover:text-text transition-colors leading-relaxed">
              I consent to a temporary biometric scan for food safety verification. I understand this data is processed locally and never permanently stored.
            </span>
          </label>
        </div>

        <button 
          type="button"
          disabled={!isCheckboxChecked}
          onClick={() => setHasConsented(true)}
          className="w-full py-4 rounded-xl bg-accent text-white font-black text-sm uppercase tracking-wide hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_4px_20px_rgba(16,185,129,0.2)] disabled:shadow-none"
        >
          Accept & Start Scan
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-sm mx-auto bg-panel backdrop-blur-xl border border-line rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden flex flex-col items-center justify-center min-h-[400px]"
    >
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent to-accent-warm" />
      
      <div className="relative w-56 h-56 md:w-64 md:h-64 mb-8 mt-4">
        {/* The Outer Ring (Face ID tick marks) */}
        <svg className="absolute inset-0 w-full h-full drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]" viewBox="0 0 100 100">
          <defs>
            <linearGradient id="faceIdGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#34D399" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <motion.circle
            cx="50" cy="50" r="48"
            fill="none"
            stroke="rgba(16,185,129,0.2)"
            strokeWidth="4"
          />
          <motion.circle
            cx="50" cy="50" r="48"
            fill="none"
            stroke="url(#faceIdGrad)"
            strokeWidth="4"
            filter="url(#glow)"
            strokeLinecap="round"
            strokeDasharray="301.59"
            strokeDashoffset={301.59 - (progress / 100) * 301.59}
            initial={{ strokeDashoffset: 301.59 }}
            animate={{ strokeDashoffset: 301.59 - (progress / 100) * 301.59 }}
            transition={{ duration: 0.1, ease: "linear" }}
            style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%" }}
          />
        </svg>

        {/* Circular Camera Mask */}
        <div className="absolute inset-[4px] rounded-full overflow-hidden bg-black flex items-center justify-center shadow-inner" style={{ clipPath: 'circle(50% at 50% 50%)' }}>
          <motion.video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: scanStatus === "success" ? 0.3 : (stream ? 1 : 0), scale: 1 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 w-full h-full object-cover rounded-full transform -scale-x-100 filter contrast-125 saturate-100"
          />
          {!stream && (
            <User size={48} className="text-white/20 animate-pulse absolute" />
          )}

          {/* Success Overlay */}
          <AnimatePresence>
            {scanStatus === "success" && (
              <motion.div 
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="absolute inset-0 rounded-full flex items-center justify-center bg-[#10B981]/20 backdrop-blur-sm"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", bounce: 0.5, delay: 0.2 }}
                >
                  <ShieldCheck size={64} className="text-white drop-shadow-lg" />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Status Text */}
      <div className="h-12 flex items-center justify-center">
        <AnimatePresence mode="wait">
          {scanStatus === "idle" && (
            <motion.p key="idle" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="text-text-muted font-bold tracking-wide">
              Initializing Camera...
            </motion.p>
          )}
          {scanStatus === "scanning" && (
            <motion.p key="scanning" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="text-text font-black text-lg tracking-tight">
              Position your face within the frame
            </motion.p>
          )}
          {scanStatus === "success" && (
            <motion.p key="success" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="text-[#10B981] font-black text-xl tracking-tight flex items-center gap-2">
              Identity Verified
            </motion.p>
          )}
          {scanStatus === "error" && (
            <motion.div key="error" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="text-red-500 font-bold tracking-wide flex flex-col items-center gap-2">
              <p>Camera Access Denied</p>
              <button onClick={startCamera} type="button" className="text-xs px-4 py-2 bg-red-500/10 rounded-full hover:bg-red-500/20 transition-colors">
                Try Again
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
