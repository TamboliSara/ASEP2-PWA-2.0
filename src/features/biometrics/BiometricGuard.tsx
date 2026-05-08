import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, ShieldCheck, Camera, XCircle, X } from "lucide-react";
import { useBiometrics } from "./useBiometrics";

interface BiometricGuardProps {
  onVerified: (descriptor: Float32Array) => void;
  onClose: () => void;
}

export function BiometricGuard({ onVerified, onClose }: BiometricGuardProps) {
  const [showCameraUI, setShowCameraUI] = useState(true);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  const {
    videoRef,
    modelsLoaded,
    modelError,
    hasPermission,
    isFaceValid,
    currentDescriptor,
    startCamera,
    stopCamera
  } = useBiometrics({
    onRuleBreach: (reason) => {
      setShowCameraUI(true);
      switch (reason) {
        case "no_face":
          setWarningMessage("Face not detected. Please look at the camera.");
          break;
        case "not_centered":
          setWarningMessage("Please center your face in the frame.");
          break;
        case "unstable":
          setWarningMessage("Hold still. Verifying identity...");
          break;
      }
    },
  });

  // When verified, trigger the callback and close
  useEffect(() => {
    if (isFaceValid && currentDescriptor) {
      setWarningMessage(null);
      // Give it a brief moment to show the success state before closing
      const timer = setTimeout(() => {
        stopCamera();
        onVerified(currentDescriptor);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isFaceValid, currentDescriptor, onVerified, stopCamera]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-md bg-panel border border-line rounded-[2rem] overflow-hidden shadow-2xl"
      >
        <button 
          onClick={() => { stopCamera(); onClose(); }}
          className="absolute top-4 right-4 z-10 p-2 bg-black/20 hover:bg-black/40 rounded-full text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8 flex flex-col items-center">
          {/* Consent State */}
          {hasPermission === null && (
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center">
                <Camera className="w-10 h-10 text-accent" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-text">Safety Protocol</h3>
                <p className="text-sm text-text-muted leading-relaxed">
                  To ensure community safety and prevent hoarding, SAFE Lockers require a brief facial scan. 
                  Data is strictly audited and auto-purged.
                </p>
              </div>
              
              {modelError ? (
                <div className="w-full p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-bold">
                  {modelError}
                </div>
              ) : (
                <button
                  onClick={() => startCamera()}
                  disabled={!modelsLoaded}
                  className="w-full py-4 rounded-xl bg-accent text-white font-bold disabled:opacity-50 transition-transform active:scale-95 shadow-lg shadow-accent/20 flex items-center justify-center gap-2"
                >
                  {modelsLoaded ? "I Consent & Enable Camera" : (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Loading AI Models...
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Denied State */}
          {hasPermission === false && (
            <div className="flex flex-col items-center text-center space-y-6 py-4">
              <XCircle className="w-16 h-16 text-red-500" />
              <div className="space-y-2">
                <h3 className="text-xl font-black text-text">Camera Access Denied</h3>
                <p className="text-sm text-text-muted">
                  For community safety, this locker will remain locked until camera permissions are granted. Please allow access in your browser settings.
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-full py-4 rounded-xl bg-panel border border-line text-text font-bold hover:bg-panel-hover"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Active Camera State */}
          {hasPermission === true && (
            <div className="w-full flex flex-col items-center space-y-6">
              <div className="text-center space-y-1">
                <h3 className="text-xl font-black text-text">Verifying Identity</h3>
                <p className="text-xs text-text-muted">Please look directly at the camera</p>
              </div>

              <div className="relative w-64 h-64 mx-auto overflow-hidden rounded-full border-4 border-panel shadow-[0_0_0_2px_var(--accent)]">
                <div className="absolute inset-0 bg-black" />
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover -scale-x-100"
                />
                
                {/* Scanning overlay */}
                <div className="absolute inset-0 border-4 border-accent/30 rounded-full z-10 pointer-events-none mix-blend-overlay" />
                
                <AnimatePresence>
                  {warningMessage && !isFaceValid && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-red-500/80 backdrop-blur-sm flex items-center justify-center text-center p-4 z-20"
                    >
                      <span className="text-white text-sm font-bold">{warningMessage}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Success Overlay */}
                <AnimatePresence>
                  {isFaceValid && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-accent/80 backdrop-blur-sm flex flex-col items-center justify-center text-center p-4 z-30"
                    >
                      <ShieldCheck className="w-12 h-12 text-white mb-2" />
                      <span className="text-white text-sm font-bold uppercase tracking-widest">Verified</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
