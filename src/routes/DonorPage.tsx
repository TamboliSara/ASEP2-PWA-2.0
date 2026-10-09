import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Package, ShieldCheck, Info, ChevronLeft, ChevronRight, Shield, AlertTriangle, Cpu } from "lucide-react";
import { DepositForm } from "../components/forms/DepositForm";
import { SafetyCapacityCard } from "../components/safety/SafetyCapacityCard";
import { useLockerController } from "../features/locker/useLockerController";

import { useAppContext } from "../store/AppContext";
import { useTranslation } from "../store/useTranslation";
import { ScrollReveal } from "../components/effects/ScrollReveal";
import { TextReveal } from "../components/effects/TextReveal";
import { ChamberVisionHud } from "../features/camera/ChamberVisionHud";

export function DonorPage() {
  const navigate = useNavigate();
  const { state, dispatch } = useAppContext();
  const { currentLocker, submitDeposit, isBusy } = useLockerController();
  const { t } = useTranslation();
  const [isFlowStarted, setIsFlowStarted] = useState(false);
  const [depositConfirmed, setDepositConfirmed] = useState(false);
  const [depositFailed, setDepositFailed] = useState(false);
  const [showSafetyCard, setShowSafetyCard] = useState(false);
  const isHardwareChamber = currentLocker.lockerId === "chamber-1";

  async function handleSubmit(imageData?: string) {
    setDepositFailed(false);
    const donation = await submitDeposit(imageData);
    if (donation) {
      // Real food confirmed by ultrasonic sensor — proceed to receiver dashboard
      setDepositConfirmed(true);
      window.setTimeout(() => navigate("/receive", { replace: true }), 900);
    } else {
      // Ghost attempt: no food detected, deposit was cancelled by firmware.
      // Reset the flow so the donor can try again cleanly.
      setDepositFailed(true);
      setIsFlowStarted(false);
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
      className="flex flex-col items-center justify-center p-2 sm:p-4 py-3 sm:py-5"
    >
      <AnimatePresence>
        {showSafetyCard && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-36 sm:pt-40 md:pt-44 pb-16 bg-black/60 backdrop-blur-sm overflow-y-auto"
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





      {/* Active Deposit / Door Unlocked Progress Modal */}
      <AnimatePresence>
        {isBusy && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 15 }}
              transition={{ type: "spring", damping: 26, stiffness: 320 }}
              className="w-full max-w-md p-6 sm:p-8 rounded-[2rem] bg-panel/95 border border-accent/40 shadow-2xl flex flex-col items-center text-center space-y-5"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-accent/25 blur-2xl rounded-full scale-125 animate-pulse" />
                <div className="relative w-16 h-16 rounded-2xl bg-accent/10 border border-accent/30 flex items-center justify-center text-accent">
                  <Package className="w-8 h-8 animate-bounce" />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/15 border border-accent/30">
                  <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
                  <span className="text-[11px] font-black uppercase tracking-widest text-accent">
                    Solenoid Unlocked
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-text">
                  Place Food in Locker
                </h3>
                <p className="text-xs text-text-muted max-w-sm mx-auto leading-relaxed">
                  {state.syncMessage || "Open the locker door, place your food container inside, and push the door shut."}
                </p>
              </div>

              {/* ── Live Chamber Vision HUD ── */}
              <div className="w-full">
                <ChamberVisionHud
                  lockerId={currentLocker.lockerId}
                  ultrasonicDistCm={currentLocker?.telemetry?.distanceCm}
                  isDonorMode={true}
                />
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ghost-attempt failure banner — shown when hardware detects no food */}
      <AnimatePresence>
        {depositFailed && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
            className="w-full max-w-5xl mb-4 flex items-start gap-3 px-5 py-4 rounded-2xl"
            style={{
              background: "rgba(239,68,68,0.08)",
              border: "1.5px solid rgba(239,68,68,0.35)",
              backdropFilter: "blur(12px)"
            }}
          >
            <div style={{ flexShrink: 0, marginTop: "2px" }}>
              <AlertTriangle className="w-5 h-5" style={{ color: "#f87171" }} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "0.8rem", fontWeight: 900, color: "#f87171", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                No Food Detected
              </p>
              <p style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.6)", margin: 0, lineHeight: 1.55 }}>
                The optical vision system and backup sensor did not detect food inside the chamber. The locker has been re-locked automatically.
                Please ensure your food container is placed inside the chamber and within view of the camera, then try again.
              </p>
            </div>
            <button
              onClick={() => setDepositFailed(false)}
              className="text-text-muted hover:text-white transition-colors flex-shrink-0 mt-0.5"
              aria-label="Dismiss"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <ScrollReveal type="blur" direction="up" distance={40} threshold={0.1}>
        <div className="w-full max-w-5xl grid md:grid-cols-5 gap-0 overflow-hidden rounded-[2rem] border border-line bg-panel/20 backdrop-blur-3xl shadow-2xl">
          
          {/* Visual Side (Left) */}
          <div className={`md:col-span-2 relative ${isFlowStarted ? 'p-7 md:p-9 lg:p-10' : 'p-8 md:p-10 lg:p-12'} flex flex-col items-center justify-center text-center overflow-hidden bg-gradient-to-br from-accent/10 via-panel/50 to-accent-warm/10 border-r border-line/10`}>
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] rounded-full bg-accent/5 blur-[120px] animate-pulse" />
              <div className="absolute top-[20%] left-[10%] w-[40%] h-[40%] rounded-full bg-accent/10 blur-[80px]" />
              <div className="absolute bottom-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-accent-warm/10 blur-[60px]" />
              <div className="absolute inset-0 opacity-[0.02] mix-blend-overlay" style={{ backgroundImage: 'radial-gradient(var(--accent) 1.5px, transparent 1.5px)', backgroundSize: '24px 24px' }} />
            </div>

            <div className={`relative z-10 ${isFlowStarted ? 'space-y-5' : 'space-y-6'}`}>
              <ScrollReveal type="zoom" direction="up" distance={20} delay={0.2} parallax={0.1}>
                <div className="inline-flex flex-col items-center gap-1.5">
                  <div className="relative">
                    <div className="absolute inset-0 bg-accent/20 blur-2xl rounded-full scale-125 animate-pulse" />
                    <button 
                      data-tour="safety-button"
                      onClick={() => setShowSafetyCard(true)}
                      className="relative p-3 rounded-2xl bg-panel/40 border border-accent/30 shadow-[0_0_40px_rgba(20,184,166,0.15)] backdrop-blur-xl hover:bg-accent/10 hover:border-accent/50 transition-all group/shield"
                    >
                      <ShieldCheck className="w-8 h-8 text-accent group-hover/shield:scale-110 transition-transform" />
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-2 px-3.5 py-1 rounded-full bg-accent/10 border border-accent/20">
                    <span className="w-1 h-1 rounded-full bg-accent animate-ping" />
                    <span className="text-[10px] font-black tracking-[0.3em] uppercase text-accent/90">
                      {t("donorEyebrow") || "DONOR MODE"}
                    </span>
                  </div>
                </div>
              </ScrollReveal>

              <ScrollReveal type="slide" direction="up" distance={20} delay={0.3} parallax={0.05}>
                <div className="space-y-1.5">
                  <div className="relative">
                    <TextReveal mode="words" direction="up" distance={15}>
                      <h1 className="text-2xl md:text-3xl font-black tracking-tight text-text leading-tight drop-shadow-[0_10px_30px_rgba(0,0,0,0.1)]">
                        {t("donorTitle") || "Secure Food Donation"}
                      </h1>
                    </TextReveal>
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-16 h-0.5 bg-gradient-to-r from-transparent via-accent/50 to-transparent rounded-full" />
                  </div>
                  
                  <TextReveal mode="block" direction="up" distance={10} delay={0.4}>
                    <p className="text-xs md:text-sm text-text-muted font-medium tracking-tight opacity-80 max-w-xs mx-auto leading-relaxed">
                      {t("donorBody") || "Donor details remain private while food safety and freshness are tracked live."}
                    </p>
                  </TextReveal>
                </div>
              </ScrollReveal>

              {/* Live telemetry indicator */}
              <ScrollReveal direction="up" distance={10} delay={0.4}>
                <div data-tour="donor-telemetry" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', marginTop: isFlowStarted ? '0.6rem' : '0.75rem' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--accent)' }}>
                      {(currentLocker?.telemetry?.internalTempC && currentLocker.telemetry.internalTempC > 0)
                        ? `${currentLocker.telemetry.internalTempC.toFixed(2)}°`
                        : "--"}
                    </div>
                    <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      TEMP
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--accent)' }}>
                      {(currentLocker?.telemetry?.humidityPct && currentLocker.telemetry.humidityPct > 0)
                        ? `${currentLocker.telemetry.humidityPct.toFixed(1)}%`
                        : "--"}
                    </div>
                    <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      HUMIDITY
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--accent)' }}>
                      {currentLocker?.telemetry?.sensorHealth === 'healthy' ? '✓' : '✓'}
                    </div>
                    <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      SENSOR
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </div>
          
          {/* Interaction Side (Right) */}
          <section data-tour="donor-action-panel" className={`md:col-span-3 ${isFlowStarted ? 'p-7 md:p-9 lg:p-10 min-h-[480px]' : 'p-8 md:p-10 lg:p-12 min-h-[520px]'} bg-panel/40 backdrop-blur-md flex flex-col relative overflow-hidden`}>
            <ScrollReveal type="blur" direction="right" distance={30} delay={0.5} parallax={0.02} className="flex-1 flex flex-col">
              <div className="flex-1 flex flex-col justify-center w-full">
                <AnimatePresence mode="wait">
                  {currentLocker.activeDonation ? (
                    <motion.div 
                      key="occupied"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="flex flex-col items-center text-center space-y-6"
                    >
                      <div className="relative">
                        <div className="absolute inset-0 bg-accent-warm/20 blur-3xl rounded-full scale-150" />
                        <div className="relative p-4.5 rounded-2xl bg-panel/40 border border-accent-warm/30 backdrop-blur-xl">
                          <Package className="w-14 h-14 text-accent-warm" />
                        </div>
                      </div>
                      
                      <div className="space-y-1.5">
                        <h2 className="text-2xl md:text-3xl font-black tracking-tight text-text">
                          {t("unitFull") || "Unit is Occupied"}
                        </h2>
                        <p className="text-sm text-text-muted font-medium max-w-md mx-auto leading-relaxed">
                          {t("unitFullBody") || "This SAFE unit already contains a food item. To protect food safety and prevent cross-contamination, only one item is permitted per compartment."}
                        </p>
                      </div>

                      <button 
                        className="group relative flex items-center justify-center gap-3 w-full max-w-sm py-4 rounded-xl bg-accent hover:bg-accent-hover text-white dark:text-black font-black text-sm md:text-base transition-all duration-300 shadow-[0_10px_40px_rgba(20,184,166,0.3)] hover:shadow-[0_15px_50px_rgba(20,184,166,0.4)] hover:-translate-y-0.5"
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
                      className="flex flex-col items-center text-center space-y-6"
                    >
                      <div data-tour="door-preview" className="relative w-40 h-40">
                        <div className="absolute inset-0 bg-accent/10 blur-[40px] rounded-full animate-pulse" />
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

                      <div className="space-y-2">
                        <TextReveal mode="words" direction="up" distance={15}>
                          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-text">
                            {t("lockerReadyHeadline") || "Locker is Ready"}
                          </h2>
                        </TextReveal>
                        <TextReveal mode="words" direction="up" distance={10} delay={0.2}>
                          <p className="text-sm md:text-base text-text-muted font-bold opacity-80">
                            {t("lockerReadyBody") || "Cleared for collection"}
                          </p>
                        </TextReveal>
                      </div>

                      <div className="flex flex-col w-full max-w-sm gap-2">
                        <button 
                          data-tour="start-donation-btn"
                          className="group relative flex items-center justify-center gap-3 w-full py-4 rounded-xl bg-accent hover:bg-accent-hover text-white dark:text-black font-black text-base transition-all duration-300 shadow-[0_10px_40px_rgba(20,184,166,0.3)] hover:shadow-[0_15px_50px_rgba(20,184,166,0.4)] hover:-translate-y-0.5"
                          onClick={() => setIsFlowStarted(true)}
                        >
                          <span>{t("donateNow") || "Start Donation"}</span>
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </button>
                        
                        <button 
                          onClick={() => setShowSafetyCard(true)}
                          className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-line text-text-muted hover:text-accent hover:border-accent/30 transition-all font-bold text-xs uppercase tracking-widest cursor-pointer"
                        >
                          <Shield className="w-3 h-3" />
                          Review Capacity & Safety
                        </button>

                        {isHardwareChamber ? (
                          <div className="flex items-center justify-center gap-2 py-1.5 px-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-400 font-bold text-[11px] tracking-wider w-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>Physical Hardware Active • Cloud Synced</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => dispatch({ type: "select-locker", id: "chamber-1" })}
                            className="flex items-center justify-center gap-2 py-2 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 transition-all font-bold text-xs uppercase tracking-wider cursor-pointer"
                          >
                            <Cpu className="w-3.5 h-3.5" />
                            <span>Switch to Physical Chamber 01 (Solenoid)</span>
                          </button>
                        )}
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
              <div className={`${isFlowStarted ? 'mt-5' : 'mt-8'} flex items-center justify-center gap-4 px-5 py-2 rounded-full bg-panel/40 border border-line backdrop-blur-xl shadow-lg w-fit mx-auto`}>
                <button 
                  onClick={() => navigateLocker(-1)} 
                  className="p-1 rounded-full hover:bg-accent/10 text-text-muted hover:text-accent transition-all"
                  aria-label="Previous Locker"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                <div className="flex items-center gap-2 px-2.5 py-0.5 border-x border-line/20">
                  <span className="text-[9px] font-black uppercase tracking-widest text-accent/60">SAFE</span>
                  <span className="text-base md:text-lg font-black text-text tabular-nums">
                    {(currentLockerIndex + 1).toString().padStart(2, '0')}
                  </span>
                  <span className="text-xs font-bold text-text-muted opacity-40">/</span>
                  <span className="text-xs font-bold text-text-muted opacity-40">
                    {state.lockers.length.toString().padStart(2, '0')}
                  </span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isHardwareChamber ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                    {isHardwareChamber ? "Hardware" : "Sim"}
                  </span>
                </div>

                <button 
                  onClick={() => navigateLocker(1)} 
                  className="p-1 rounded-full hover:bg-accent/10 text-text-muted hover:text-accent transition-all"
                  aria-label="Next Locker"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </ScrollReveal>
          </section>
        </div>
      </ScrollReveal>

      {/* Footer Info */}
      <div className="mt-6 flex items-center gap-4 opacity-40">
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

