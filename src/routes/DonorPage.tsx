import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Package, ShieldCheck, Info, ChevronLeft, ChevronRight, Shield } from "lucide-react";
import { DepositForm } from "../components/forms/DepositForm";
import { SafetyCapacityCard } from "../components/SafetyCapacityCard";
import { useLockerController } from "../features/useLockerController";
import { BiometricGuard } from "../features/biometrics/BiometricGuard";
import { useAppContext } from "../store/AppContext";
import { useTranslation } from "../store/useTranslation";
import { ScrollReveal } from "../components/ScrollReveal";
import { TextReveal } from "../components/TextReveal";

export function DonorPage() {
  const navigate = useNavigate();
  const { state, dispatch } = useAppContext();
  const { currentLocker, submitDeposit, isBusy } = useLockerController();
  const { t } = useTranslation();
  const [isFlowStarted, setIsFlowStarted] = useState(false);
  const [depositConfirmed, setDepositConfirmed] = useState(false);
  const [showSafetyCard, setShowSafetyCard] = useState(false);
  const [showBiometricModal, setShowBiometricModal] = useState(false);
  const [biometricDescriptor, setBiometricDescriptor] = useState<Float32Array | null>(null);

  // Auto-show safety card if not started and not showing yet
  useEffect(() => {
    if (!isFlowStarted && !depositConfirmed) {
      const timer = setTimeout(() => setShowSafetyCard(true), 500);
      return () => clearTimeout(timer);
    }
  }, [isFlowStarted, depositConfirmed]);

  async function handleSubmit() {
    const donation = await submitDeposit();
    setDepositConfirmed(true);
    if (donation) {
      window.setTimeout(() => navigate("/receive", { replace: true }), 900);
    }
  }

  const navigateLocker = (direction: number) => {
    const index = state.lockers.findIndex(l => l.lockerId === state.selectedLockerId);
    const nextIndex = (index + direction + state.lockers.length) % state.lockers.length;
    dispatch({ type: "select-locker", id: state.lockers[nextIndex].lockerId });
  };

  const currentLockerIndex = state.lockers.findIndex(l => l.lockerId === state.selectedLockerId);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-[calc(100vh-140px)] flex flex-col items-center justify-center p-4 md:p-8"
    >
      <AnimatePresence>
        {showSafetyCard && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-24 pb-12 bg-black/60 backdrop-blur-sm overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
            >
              <SafetyCapacityCard onClose={() => setShowSafetyCard(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showBiometricModal && (
          <BiometricGuard 
            onVerified={(descriptor) => {
              setBiometricDescriptor(descriptor);
              setShowBiometricModal(false);
              setIsFlowStarted(true); // Proceed to form
            }}
            onClose={() => setShowBiometricModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Top Navigation */}
      <div className="w-full max-w-6xl flex justify-between items-center mb-6">
        <Link to="/" className="group flex items-center gap-2 text-sm font-bold text-text-muted hover:text-accent transition-colors">
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          {t("backToHome") || "Back to Home"}
        </Link>

        <button 
          onClick={() => setShowSafetyCard(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-panel/40 border border-line hover:border-accent/30 text-text-muted hover:text-accent transition-all group"
        >
          <Shield className="w-4 h-4" />
          <span className="text-xs font-black uppercase tracking-widest">Safety Guidelines</span>
        </button>
      </div>

      <ScrollReveal type="blur" direction="up" distance={40} threshold={0.1}>
        <div className="w-full max-w-5xl grid md:grid-cols-5 gap-0 overflow-hidden rounded-[2rem] border border-line bg-panel/20 backdrop-blur-3xl shadow-2xl">
          
          {/* Visual Side (Left) */}
          <div className="md:col-span-2 relative p-8 md:p-10 flex flex-col items-center justify-center text-center overflow-hidden bg-gradient-to-br from-accent/10 via-panel/50 to-accent-warm/10 border-r border-line/10">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] rounded-full bg-accent/5 blur-[120px] animate-pulse" />
              <div className="absolute top-[20%] left-[10%] w-[40%] h-[40%] rounded-full bg-accent/10 blur-[80px]" />
              <div className="absolute bottom-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-accent-warm/10 blur-[60px]" />
              <div className="absolute inset-0 opacity-[0.02] mix-blend-overlay" style={{ backgroundImage: 'radial-gradient(var(--accent) 1.5px, transparent 1.5px)', backgroundSize: '24px 24px' }} />
            </div>

            <div className="relative z-10 space-y-8">
              <ScrollReveal type="zoom" direction="up" distance={20} delay={0.2} parallax={0.1}>
                <div className="inline-flex flex-col items-center gap-3">
                  <div className="relative">
                    <div className="absolute inset-0 bg-accent/20 blur-2xl rounded-full scale-125 animate-pulse" />
                    <button 
                      onClick={() => setShowSafetyCard(true)}
                      className="relative p-3 rounded-2xl bg-panel/40 border border-accent/30 shadow-[0_0_40px_rgba(20,184,166,0.15)] backdrop-blur-xl hover:bg-accent/10 hover:border-accent/50 transition-all group/shield"
                    >
                      <ShieldCheck className="w-8 h-8 text-accent group-hover/shield:scale-110 transition-transform" />
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-2.5 px-3 py-1 rounded-full bg-accent/10 border border-accent/20">
                    <span className="w-1 h-1 rounded-full bg-accent animate-ping" />
                    <span className="text-[9px] font-black tracking-[0.3em] uppercase text-accent/90">
                      {t("donorEyebrow") || "DONOR MODE"}
                    </span>
                  </div>
                </div>
              </ScrollReveal>

              <ScrollReveal type="slide" direction="up" distance={20} delay={0.3} parallax={0.05}>
                <div className="space-y-4">
                  <div className="relative">
                    <TextReveal mode="words" direction="up" distance={15}>
                      <h1 className="text-3xl md:text-4xl font-black tracking-tight text-text leading-tight drop-shadow-[0_10px_30px_rgba(0,0,0,0.1)]">
                        {t("donorTitle") || "Register the meal before the locker unlocks."}
                      </h1>
                    </TextReveal>
                    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-16 h-0.5 bg-gradient-to-r from-transparent via-accent/50 to-transparent rounded-full" />
                  </div>
                  
                  <TextReveal mode="block" direction="up" distance={10} delay={0.4}>
                    <p className="text-base text-text-muted font-bold tracking-tight opacity-80 max-w-xs mx-auto leading-relaxed">
                      {t("donorBody") || "The donor record stays private in Firebase while the receiver dashboard shows only safe public food details and live chamber intelligence."}
                    </p>
                  </TextReveal>
                </div>
              </ScrollReveal>

              <ScrollReveal direction="up" distance={10} delay={0.4}>
                <div className="flex items-center justify-center gap-6 opacity-20">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-0.5 h-6 bg-gradient-to-b from-transparent via-accent to-transparent" />
                    <span className="text-[6px] font-black uppercase tracking-widest">v4.0.2</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-0.5 h-6 bg-gradient-to-b from-transparent via-accent-warm to-transparent" />
                    <span className="text-[6px] font-black uppercase tracking-widest">TLS 1.3</span>
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </div>
          
          {/* Interaction Side (Right) */}
          <section className="md:col-span-3 p-8 md:p-12 lg:p-14 bg-panel/40 backdrop-blur-md flex flex-col min-h-[640px] relative overflow-hidden">
            <ScrollReveal type="blur" direction="right" distance={30} delay={0.5} parallax={0.02} className="flex-1 flex flex-col">
              <div className="flex-1 flex flex-col justify-center w-full">
                <AnimatePresence mode="wait">
                  {currentLocker.activeDonation ? (
                    <motion.div 
                      key="occupied"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="flex flex-col items-center text-center space-y-8"
                    >
                      <div className="relative">
                        <div className="absolute inset-0 bg-accent-warm/20 blur-3xl rounded-full scale-150" />
                        <div className="relative p-6 rounded-[2rem] bg-panel/40 border border-accent-warm/30 backdrop-blur-xl">
                          <Package className="w-16 h-16 text-accent-warm" />
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <h2 className="text-3xl font-black tracking-tight text-text">
                          {t("unitFull") || "Unit is Occupied"}
                        </h2>
                        <p className="text-base text-text-muted font-medium max-w-md mx-auto leading-relaxed">
                          {t("unitFullBody") || "This SAFE unit already contains a food item. To protect food safety and prevent cross-contamination, only one item is permitted per compartment."}
                        </p>
                      </div>

                      <button 
                        className="group relative flex items-center justify-center gap-3 w-full max-w-sm py-4.5 rounded-2xl bg-accent hover:bg-accent-hover text-white dark:text-black font-black text-base transition-all duration-300 shadow-[0_10px_40px_rgba(20,184,166,0.3)] hover:shadow-[0_15px_50px_rgba(20,184,166,0.4)] hover:-translate-y-1"
                        onClick={() => navigate("/receive")}
                      >
                        <span>{t("viewActiveDonation") || "View Active Donation"}</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </button>
                    </motion.div>
                  ) : !isFlowStarted ? (
                    <motion.div 
                      key="ready"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="flex flex-col items-center text-center space-y-10"
                    >
                      <div className="relative w-48 h-48">
                        <div className="absolute inset-0 bg-accent/10 blur-[60px] rounded-full animate-pulse" />
                        <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="relative z-10 w-full h-full">
                          <defs>
                            <linearGradient id="lockerGrad" x1="40" y1="40" x2="160" y2="180" gradientUnits="userSpaceOnUse">
                              <stop stopColor="var(--accent)" stopOpacity="0.3" />
                              <stop offset="1" stopColor="var(--accent)" stopOpacity="0.05" />
                            </linearGradient>
                          </defs>
                          <rect x="40" y="40" width="120" height="140" rx="24" fill="url(#lockerGrad)" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="6 4" />
                          <path d="M160 60L185 50V170L160 180" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          <circle cx="100" cy="110" r="32" fill="rgba(255,255,255,0.03)" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="4 4" />
                          <path d="M90 110H110M100 100V120" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                      </div>

                      <div className="space-y-3">
                        <TextReveal mode="words" direction="up" distance={15}>
                          <h2 className="text-4xl font-black tracking-tight text-text">
                            {t("lockerReadyHeadline") || "Locker is Ready"}
                          </h2>
                        </TextReveal>
                        <TextReveal mode="words" direction="up" distance={10} delay={0.2}>
                          <p className="text-lg text-text-muted font-bold opacity-80">
                            {t("lockerReadyBody") || "Cleared for collection"}
                          </p>
                        </TextReveal>
                      </div>

                      <div className="flex flex-col w-full max-w-sm gap-4">
                        <button 
                          className="group relative flex items-center justify-center gap-3 w-full py-5 rounded-2xl bg-accent hover:bg-accent-hover text-white dark:text-black font-black text-lg transition-all duration-300 shadow-[0_10px_40px_rgba(20,184,166,0.3)] hover:shadow-[0_15px_50px_rgba(20,184,166,0.4)] hover:-translate-y-1"
                          onClick={() => setIsFlowStarted(true)}
                        >
                          <span>{t("donateNow") || "Start Donation"}</span>
                          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </button>
                        
                        <button 
                          onClick={() => setShowSafetyCard(true)}
                          className="flex items-center justify-center gap-2 py-3 rounded-xl border border-line text-text-muted hover:text-accent hover:border-accent/30 transition-all font-bold text-xs uppercase tracking-widest"
                        >
                          <Shield className="w-3.5 h-3.5" />
                          Review Capacity & Safety
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="form"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="w-full max-w-2xl mx-auto"
                    >
                      <DepositForm 
                        onSubmit={handleSubmit} 
                        isBusy={isBusy} 
                        isNaked={true} 
                        onShowSafety={() => setShowSafetyCard(true)}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>


              {/* Navigation Controller (Bottom) */}
              <div className="mt-16 flex items-center justify-center gap-6 px-6 py-3 rounded-full bg-panel/40 border border-line backdrop-blur-xl shadow-lg w-fit mx-auto">
                <button 
                  onClick={() => navigateLocker(-1)} 
                  className="p-2 rounded-full hover:bg-accent/10 text-text-muted hover:text-accent transition-all"
                  aria-label="Previous Locker"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                
                <div className="flex items-center gap-3 px-4 py-1 border-x border-line/20">
                  <span className="text-[10px] font-black uppercase tracking-widest text-accent/60">SAFE</span>
                  <span className="text-lg font-black text-text tabular-nums">
                    {(currentLockerIndex + 1).toString().padStart(2, '0')}
                  </span>
                  <span className="text-xs font-bold text-text-muted opacity-40">/</span>
                  <span className="text-xs font-bold text-text-muted opacity-40">
                    {state.lockers.length.toString().padStart(2, '0')}
                  </span>
                </div>

                <button 
                  onClick={() => navigateLocker(1)} 
                  className="p-2 rounded-full hover:bg-accent/10 text-text-muted hover:text-accent transition-all"
                  aria-label="Next Locker"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </ScrollReveal>
          </section>
        </div>
      </ScrollReveal>

      {/* Footer Info */}
      <div className="mt-8 flex items-center gap-4 opacity-30">
        <div className="flex items-center gap-2">
          <Info className="w-3 h-3" />
          <span className="text-[10px] font-bold uppercase tracking-wider">All interactions are logged for food safety</span>
        </div>
      </div>

      <style>{`
        .py-4\\.5 { padding-top: 1.125rem; padding-bottom: 1.125rem; }
      `}</style>
    </motion.div>
  );
}

