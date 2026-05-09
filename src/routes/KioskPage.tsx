import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ShieldCheck, MoveRight, Box, Weight, Thermometer, Droplets, Zap, Ban, Wind, Activity, Lock, X, Mail, Key, Shield } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { FoodHeroV2 } from "../components/FoodHeroV2";
import { SlideConfirm } from "../components/SlideConfirm";
import { StatusPill } from "../components/StatusPill";
import { TelemetryChart } from "../components/TelemetryChart";
import { FoodHealthCardPremium } from "../components/FoodHealthCardPremium";
import { SurfaceCard } from "../components/layout/SurfaceCard";
import { FleetMap } from "../components/FleetMap";
import { useLockerController } from "../features/useLockerController";
import { useTranslation } from "../store/useTranslation";
import { QualityGauge } from "../components/QualityGauge";
import { AppleFaceIDScanner } from "../components/AppleFaceIDScanner";
import { getRecommendedActions } from "../utils/safety";
import { formatCountdown, formatDateTime, getHoursRemaining } from "../utils/format";
import { useAppContext } from "../store/AppContext";
import { ScrollReveal } from "../components/ScrollReveal";
import { TextReveal } from "../components/TextReveal";

export function KioskPage() {
  const { dispatch } = useAppContext();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { state, currentLocker, selectLocker, isBusy, retrieveFood, triggerMaintenanceLockdown, syncNow, clearSyncMessage } = useLockerController();
  const donation = currentLocker.activeDonation;
  const [selectedDonation, setSelectedDonation] = useState(donation);
  const telemetry = currentLocker.telemetry;
  const isFaulted = currentLocker.faultState !== "none";
  const isSanitizing = currentLocker.sanitizationState === "running";
  const [now, setNow] = useState(Date.now());
  const [showAdminAuth, setShowAdminAuth] = useState(false);
  const [showFaceVerification, setShowFaceVerification] = useState(false);
  const [showVolumeAnalysis, setShowVolumeAnalysis] = useState(false);
  const [adminId, setAdminId] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    setSelectedDonation(donation);
  }, [donation?.id]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (state.syncMessage) {
      const timer = window.setTimeout(() => {
        clearSyncMessage();
      }, 6000);
      return () => window.clearTimeout(timer);
    }
  }, [state.syncMessage, clearSyncMessage]);

  const displayDonation = selectedDonation ?? donation;
  const selectedQualityScore = displayDonation?.latestQualityScore ?? currentLocker.foodQualityScore;
  // Only use deadline from donation — empty lockers should not show phantom telemetry
  const selectedDeadline = displayDonation?.deadlineEstimate ?? (donation ? currentLocker.deadlineEstimate : undefined);
  const dashboardLocker = {
    ...currentLocker,
    foodQualityScore: selectedQualityScore,
    deadlineEstimate: selectedDeadline ?? currentLocker.deadlineEstimate
  };
  const recommendedActions = getRecommendedActions(dashboardLocker);

  const dynamicHoursRemaining = useMemo(() => {
    void now;
    if (!donation || !selectedDeadline) return 0;
    const hrs = getHoursRemaining(selectedDeadline.absoluteIso);
    return isNaN(hrs) ? (selectedDeadline.hoursRemaining || 0) : hrs;
  }, [now, donation, selectedDeadline?.absoluteIso, selectedDeadline?.hoursRemaining]);

  const MAX_SHELF_LIFE = 48; // Standard normalization hours

  // Empty lockers: show zero values instead of phantom mock data
  const displayHoursRemaining = donation ? (dynamicHoursRemaining > 0 ? dynamicHoursRemaining : (selectedDeadline?.hoursRemaining ?? 0)) : 0;
  const calculatedQualityScore = donation ? Math.min(100, Math.round((Math.max(0, displayHoursRemaining) / MAX_SHELF_LIFE) * 100)) : 0;
  const qualityStage = !donation ? "empty" : displayHoursRemaining <= 0 ? "spoiled" : displayHoursRemaining <= 4 ? "warning" : "fresh";

  // Spoiled = retrieve locked, admin override enabled
  // Fresh   = retrieve enabled, admin override locked
  const isSpoiled = calculatedQualityScore < 30;

  async function handleAdminRetrieve() {
    if (state.isAdminAuthenticated) {
      await retrieveFood(true, true); // Skip sanitization, mark as admin override
    } else {
      setShowAdminAuth(true);
    }
  }

  async function confirmAdminAuth(e: React.FormEvent) {
    e.preventDefault();
    if (adminId === "admin@ecolocker.local" && adminPassword === "password") {
      dispatch({ type: "set-admin-auth", value: true });
      setShowAdminAuth(false);
      setAuthError("");
      await retrieveFood(true, true); // Skip sanitization, mark as admin override
    } else {
      setAuthError("Invalid credentials");
    }
  }

  async function handleFaceVerify(imageData?: string) {
    // In a real app, you would send imageData to a server for verification
    if (imageData) {
      console.log("Face verification image captured:", imageData.substring(0, 50) + "...");
    } else {
      console.log("Face verification successful (simulated).");
    }
    setShowFaceVerification(false);
    await retrieveFood(false, false, imageData);
  }

  const navigateLocker = (direction: -1 | 1) => {
    const currentIndex = state.lockers.findIndex(l => l.lockerId === currentLocker.lockerId);
    const nextIndex = (currentIndex + direction + state.lockers.length) % state.lockers.length;
    selectLocker(state.lockers[nextIndex].lockerId);
  };

  return (
    <div className="page-grid receiver-grid">
      <AnimatePresence>
        {showFaceVerification && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md flex flex-col items-center"
            >
              <button 
                onClick={() => setShowFaceVerification(false)}
                className="absolute -top-12 right-0 md:-right-12 p-2 rounded-full bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors z-20"
              >
                <X size={18} />
              </button>
              <AppleFaceIDScanner onVerify={handleFaceVerify} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
      {isSanitizing && (
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="sanitization-overlay" 
        >
          <div className="overlay-content glass-panel">
            <div className="spinner" />
            <h2>Sanitization in Progress</h2>
            <p>Locker is being cleaned for your safety. Please wait a moment.</p>
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      {showAdminAuth && (
        <div className="admin-auth-overlay">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            className="auth-modal-luxe glass-panel-premium"
          >
            {/* Nature Decorations */}
            <div className="auth-nature-bg">
              <div className="auth-leaf leaf-1">🍃</div>
              <div className="auth-leaf leaf-2">🌿</div>
              <div className="auth-orb" />
            </div>

            <button className="auth-close-btn" onClick={() => setShowAdminAuth(false)}>
              <X size={20} />
            </button>

            <div className="modal-header-luxe">
              <div className="auth-icon-container">
                <div className="auth-icon-ring">
                  <Lock className="w-6 h-6 text-accent" />
                </div>
                <div className="auth-icon-pulse" />
              </div>
              <p className="auth-eyebrow">SECURITY OVERRIDE</p>
              <h3 className="auth-title">Admin Authorization</h3>
              <p className="auth-subtitle">Elevated privileges required for this operation.</p>
            </div>

            <form onSubmit={confirmAdminAuth} className="auth-form-luxe">
              <div className="auth-field-group">
                <label className="auth-field">
                  <div className="field-label-row">
                    <Mail size={12} className="text-accent" />
                    <span>ADMIN IDENTIFIER</span>
                  </div>
                  <div className="input-wrapper-luxe">
                    <input 
                      type="email" 
                      value={adminId} 
                      onChange={(e) => setAdminId(e.target.value)} 
                      placeholder="admin@ecolocker.local"
                      required 
                    />
                    <div className="input-focus-border" />
                  </div>
                </label>

                <label className="auth-field">
                  <div className="field-label-row">
                    <Key size={12} className="text-accent" />
                    <span>ACCESS TOKEN</span>
                  </div>
                  <div className="input-wrapper-luxe">
                    <input 
                      type="password" 
                      value={adminPassword} 
                      onChange={(e) => setAdminPassword(e.target.value)} 
                      placeholder="••••••••"
                      required 
                    />
                    <div className="input-focus-border" />
                  </div>
                </label>
              </div>

              {authError && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="auth-error-luxe"
                >
                  <AlertTriangle size={14} />
                  <span>{authError}</span>
                </motion.div>
              )}

              <div className="auth-actions-luxe">
                <button type="button" className="auth-btn-secondary" onClick={() => setShowAdminAuth(false)}>
                  Dismiss
                </button>
                <button type="submit" className="auth-btn-primary">
                  <span>Verify Authorization</span>
                  <ShieldCheck size={18} />
                </button>
              </div>
            </form>

            <div className="auth-footer">
              <Shield size={10} />
              <span>ENCRYPTED END-TO-END SESSION</span>
            </div>
          </motion.div>
        </div>
      )}

      {showVolumeAnalysis && (
        <div className="admin-auth-overlay" onClick={() => setShowVolumeAnalysis(false)}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="volume-analysis-modal glass-panel animate-reveal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="header-icon-ring">
                <Box className="w-6 h-6 text-accent" />
              </div>
              <h3>Unit Volume Analysis</h3>
              <p>Detailed capacity telemetry for all mission safes.</p>
            </div>
            
            <div className="volume-grid-luxe">
              {state.lockers.map((locker, idx) => {
                const volume = 15 + (idx % 3) * 5; // Mock volumes: 15L, 20L, 25L
                return (
                  <div key={locker.lockerId} className="volume-item-luxe">
                    <div className="volume-item-header">
                      <span className="unit-tag">SAFE_{ (idx + 1).toString().padStart(2, '0') }</span>
                      <span className="volume-value">{volume}L</span>
                    </div>
                    <div className="volume-progress-track">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: locker.occupancyState === 'occupied' ? '85%' : '0%' }}
                        className={`volume-progress-fill ${locker.occupancyState}`}
                      />
                    </div>
                    <div className="volume-footer">
                      <span className="status-label">{locker.occupancyState.toUpperCase()}</span>
                      <span className="capacity-label">{locker.occupancyState === 'occupied' ? 'High Utilization' : 'Available'}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <button className="primary-button w-full mt-6" onClick={() => setShowVolumeAnalysis(false)}>
              Close Analysis
            </button>
          </motion.div>
        </div>
      )}

      <ScrollReveal type="blur" direction="up" distance={30} parallax={0.05} threshold={0.01}>
        <section className="hero-panel receiver-hero nature-card-redesign">
          {/* Nature Background Elements */}
          <div className="nature-waves" style={{ opacity: 0.3 }}>
            <div className="nature-wave nature-wave-1" />
            <div className="nature-wave nature-wave-2" />
          </div>
          
          <div className="nature-leaf-accent" style={{ top: '40px', right: '40px', transform: 'rotate(15deg)', opacity: 0.15 }}>🍃</div>
          <div className="nature-leaf-accent" style={{ bottom: '40px', left: '40px', transform: 'rotate(-45deg)', opacity: 0.15 }}>🌿</div>

          {/* Technical Corner Marks */}

          <div className="hero-copy hero-copy-redesign">
            
            {/* ... existing content ... */}

            {/* ── Top identity row ── */}
            <div className="hrd-identity-row" style={{ position: 'relative', zIndex: 10 }}>
              <TextReveal mode="words" direction="left" distance={10} delay={0.1}>
                  <div className="hrd-eyebrow-stack">
                    <span className="hrd-system-label">RECEIVER DASHBOARD</span>
                    <div className="hrd-live-chip"><span className="hrd-live-dot" />LIVE</div>
                  </div>
              </TextReveal>
              <TextReveal mode="words" direction="right" distance={10} delay={0.2}>
                <div className="hrd-pill-row">
                  <StatusPill value={currentLocker.occupancyState} tone={donation ? "warning" : "success"} />
                  <StatusPill value={telemetry.sensorHealth} tone={telemetry.sensorHealth === "healthy" ? "success" : "warning"} />
                  {/* SIGN OUT button removed per request */}
                </div>
              </TextReveal>
            </div>

            {/* ── Food Name ── */}
            <div className="hrd-food-name-row" style={{ position: 'relative', zIndex: 10 }}>
              <TextReveal mode="words" direction="up" distance={15} delay={0.3}>
                <h2 className="hrd-food-name">
                  {displayDonation
                    ? displayDonation.foodName.charAt(0).toUpperCase() + displayDonation.foodName.slice(1)
                    : "No Item"}
                </h2>
              </TextReveal>

            </div>

            {/* ── QUALITY INDEX — Prominent Hero Block ── */}
            <div className="hrd-qi-hero prominent-hero" style={{ position: 'relative', zIndex: 10 }}>
              {/* Massive centered gauge */}
              <div className="hrd-gauge-master">
                <div className="hrd-score-ring-wrap">
                  <QualityGauge hoursRemaining={displayHoursRemaining} totalDuration={MAX_SHELF_LIFE} />
                </div>
              </div>

              {/* Streamlined data row beneath gauge */}
              <div className="hrd-qi-data-refined">
                <div className="hrd-data-grid">
                  <div className="hrd-data-cell">
                    <span className="hrd-cell-label">TIME REMAINING</span>
                    <div className="hrd-hours-block">
                      <span className="hrd-hours-num">{displayHoursRemaining > 0 ? displayHoursRemaining.toFixed(1) : "—"}</span>
                      <span className="hrd-hours-unit">hrs</span>
                    </div>
                  </div>

                  <div className="hrd-data-cell">
                    <span className="hrd-cell-label">FRESHNESS STATE</span>
                    <div className={`hrd-status-badge-new ${qualityStage}`}>
                      {qualityStage === "fresh" ? <ShieldCheck size={10} /> : <Activity size={10} />}
                      {qualityStage === "spoiled" ? "Expired" : qualityStage === "warning" ? "Expiring Soon" : "Fresh"}
                    </div>
                  </div>

                  <div className="hrd-data-cell">
                    <span className="hrd-cell-label">EXPIRY DATE</span>
                    <span className="hrd-expiry-text-new">
                      {selectedDeadline ? formatDateTime(selectedDeadline.absoluteIso) : "N/A"}
                    </span>
                  </div>
                </div>

                {/* Progress bar integrated at the bottom of the hero */}
                <div className="hrd-freshness-bar-wrap">
                  <div className="hrd-freshness-bar-track">
                    <div
                      className="hrd-freshness-bar-fill"
                      style={{
                        width: `${calculatedQualityScore}%`,
                        background: calculatedQualityScore < 30
                          ? "linear-gradient(90deg,#ef4444,#dc2626)"
                          : calculatedQualityScore < 60
                          ? "linear-gradient(90deg,#f59e0b,#d97706)"
                          : "linear-gradient(90deg,#22c55e,#16a34a)"
                      }}
                    />
                  </div>
                  <div className="hrd-bar-labels">
                    <span>SPOILED</span>
                    <span>OPTIMAL</span>
                    <span>FRESH</span>
                  </div>
                </div>
              </div>
            </div>

            {state.syncMessage && <div className="status-banner">{state.syncMessage}</div>}
          </div>
          <FoodHeroV2
            donation={donation}
            onActiveItemChange={setSelectedDonation}
            onPrevLocker={() => navigateLocker(-1)}
            onNextLocker={() => navigateLocker(1)}
          />
        </section>
      </ScrollReveal>

      <ScrollReveal type="blur" direction="up" distance={40} delay={0.2} staggerChildren={0.02} threshold={0.05}>
        <section className="chamber-selection-grid">
          <motion.div 
            className="selection-header"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: false }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <TextReveal mode="words" direction="left" distance={10} delay={0.1}>
              <p className="eyebrow-accent">UNIT COMPARTMENTS</p>
            </TextReveal>
            <TextReveal mode="words" direction="left" distance={15} delay={0.2}>
              <h3 className="premium-h3">Select Safe to Analyze</h3>
            </TextReveal>
            <div className="header-divider-mini" />
          </motion.div>

          <div className="chamber-grid-layout">
            {state.lockers.map((locker, idx) => {
              const safeNum = (idx + 1).toString().padStart(2, '0');
              const isActive = state.selectedLockerId === locker.lockerId;
              
              return (
                <ScrollReveal key={locker.lockerId} type="zoom" direction="up" distance={20} threshold={0.01}>
                  <motion.button
                    whileHover={{ y: -5, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`chamber-node-luxe ${isActive ? 'active' : ''} is-${locker.occupancyState}`}
                    onClick={() => selectLocker(locker.lockerId)}
                  >
                    <div className="chamber-node-inner">
                      <div className="chamber-node-number">{safeNum}</div>
                      <div className="chamber-node-info">
                        <div className="chamber-header-row">
                          <span className="chamber-label">SAFE</span>
                          <div className="chamber-node-tag">UNIT_{locker.lockerId.split('-')[1] || '00'}</div>
                        </div>
                        <strong className="chamber-id">{safeNum}</strong>
                        
                        <div className="chamber-status-stack">
                          <StatusPill 
                            value={locker.occupancyState} 
                            tone={
                              locker.occupancyState === 'occupied' ? 'warning' : 
                              locker.occupancyState === 'empty' ? 'success' : 
                              locker.occupancyState === 'spoiled' ? 'spoiled' : 
                              'danger'
                            } 
                          />
                          
                          <AnimatePresence>
                            {locker.occupancyState !== 'empty' && locker.occupancyState !== 'maintenance' && (
                              <motion.div 
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                className={`quality-mini-pill ${locker.foodQualityScore}`}
                              >
                                <Activity size={8} />
                                {locker.foodQualityScore}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>
                    
                    {isActive && (
                      <motion.div 
                        layoutId="active-ring"
                        className="chamber-active-ring"
                        initial={false}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                    
                    <div className="chamber-node-glow" />
                    <div className="scanline-effect" />
                    <div className="corner-decor top-right" />
                    <div className="corner-decor bottom-left" />
                  </motion.button>
                </ScrollReveal>
              );
            })}
          </div>
        </section>
      </ScrollReveal>


      <style>{`
        /* ══════════════════════════════════════════════════
           RECEIVER HERO — REDESIGNED LEFT PANEL
           ══════════════════════════════════════════════════ */
        .hero-copy-redesign {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          padding-right: 0.5rem;
        }

        /* Identity Row */
        .hrd-identity-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: nowrap;
          gap: 0.75rem;
          min-height: 28px;
        }
        .hrd-eyebrow-stack {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .hrd-system-label {
          font-size: 0.6rem;
          font-weight: 900;
          letter-spacing: 0.18em;
          color: var(--accent);
          text-transform: uppercase;
        }
        .hrd-live-chip {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          background: rgba(244,63,94,0.12);
          color: #f43f5e;
          border: 1px solid rgba(244,63,94,0.25);
          padding: 0.2rem 0.55rem;
          border-radius: 6px;
          font-size: 0.55rem;
          font-weight: 900;
          letter-spacing: 0.1em;
        }
        .hrd-live-dot {
          width: 5px; height: 5px;
          background: #f43f5e;
          border-radius: 50%;
          animation: blink 1s infinite;
        }
        .hrd-pill-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: nowrap;
          overflow: hidden;
          flex-shrink: 1;
        }


        /* Food name */
        .hrd-food-name-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1.5rem;
          flex-wrap: nowrap;
          min-height: 4rem;
          width: 100%;
        }
        .hrd-food-name {
          font-size: clamp(1.8rem, 4vw, 3.2rem);
          font-weight: 950;
          letter-spacing: -0.04em;
          line-height: 1.1;
          margin: 0;
          color: var(--text);
          background: linear-gradient(135deg, var(--text) 50%, var(--accent));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex: 1;
          min-width: 0;
        }
        .hrd-safety-chip {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          background: rgba(var(--accent-rgb),0.08);
          border: 1px solid rgba(var(--accent-rgb),0.25);
          padding: 0.35rem 0.85rem;
          border-radius: 99px;
          font-size: 0.6rem;
          font-weight: 800;
          color: var(--accent);
          letter-spacing: 0.08em;
          white-space: nowrap;
        }

        /* ── QUALITY INDEX PROMINENT HERO ── */
        .hrd-qi-hero.prominent-hero {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0;
          padding: 2.5rem 2rem 2rem;
          background: rgba(var(--accent-rgb), 0.05);
          border: 1px solid rgba(var(--accent-rgb), 0.15);
          border-radius: 32px;
          backdrop-filter: blur(20px);
          position: relative;
          overflow: hidden;
          box-shadow: 
            0 20px 50px rgba(0,0,0,0.1),
            inset 0 0 100px rgba(var(--accent-rgb), 0.05);
        }

        .hrd-qi-hero.prominent-hero::after {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle at center, rgba(var(--accent-rgb), 0.1) 0%, transparent 50%);
          pointer-events: none;
          z-index: 0;
        }

        .hrd-gauge-master {
          position: relative;
          z-index: 1;
          width: 100%;
          display: flex;
          justify-content: center;
          margin-bottom: 1rem;
          filter: drop-shadow(0 0 30px rgba(var(--accent-rgb), 0.2));
        }

        .hrd-score-ring-wrap {
          width: 280px; /* Massive Gauge */
          display: flex;
          justify-content: center;
          align-items: center;
        }

        /* Scale internals for prominence */
        .hrd-score-ring-wrap .quality-gauge-premium {
          max-width: 280px;
          margin: 0;
        }
        .hrd-score-ring-wrap .score-value-premium {
          font-size: 3.5rem !important;
          font-weight: 950 !important;
        }
        .hrd-score-ring-wrap .score-label-premium {
          font-size: 0.5rem !important;
          letter-spacing: 0.4em !important;
          margin-top: 8px !important;
        }
        .hrd-score-ring-wrap .gauge-score-overlay-luxe {
          /* Centering is handled by top: 78.5% in base component */
        }

        /* Data Row Refined */
        .hrd-qi-data-refined {
          width: 100%;
          z-index: 1;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          margin-top: 1rem;
        }

        .hrd-data-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 1rem;
          border-top: 1px solid rgba(255,255,255,0.06);
          padding-top: 1.5rem;
        }

        .hrd-data-cell {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          align-items: center;
          text-align: center;
        }

        .hrd-cell-label {
          font-size: 0.5rem;
          font-weight: 900;
          letter-spacing: 0.15em;
          color: var(--text-muted);
          text-transform: uppercase;
        }

        .hrd-hours-block {
          display: flex;
          align-items: baseline;
          gap: 0.25rem;
        }
        .hrd-hours-num {
          font-size: 1.75rem;
          font-weight: 900;
          line-height: 1;
          color: var(--text);
          font-family: var(--font-mono, monospace);
        }
        .hrd-hours-unit {
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--text-muted);
        }

        .hrd-status-badge-new {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.35rem 0.75rem;
          border-radius: 8px;
          font-size: 0.6rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border: 1px solid;
        }
        .hrd-status-badge-new.fresh { background: rgba(34,197,94,0.1); color: #22c55e; border-color: rgba(34,197,94,0.2); }
        .hrd-status-badge-new.warning { background: rgba(245,158,11,0.1); color: #f59e0b; border-color: rgba(245,158,11,0.2); }
        .hrd-status-badge-new.spoiled { background: rgba(239,68,68,0.1); color: #ef4444; border-color: rgba(239,68,68,0.2); }

        .hrd-expiry-text-new {
          font-size: 0.7rem;
          font-weight: 800;
          color: var(--text);
          font-family: var(--font-mono, monospace);
        }

        /* Freshness bar at bottom */
        .hrd-freshness-bar-wrap {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          background: rgba(255,255,255,0.03);
          padding: 0.75rem 1rem;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.05);
        }
        .hrd-freshness-bar-track {
          height: 6px;
          background: rgba(255,255,255,0.07);
          border-radius: 99px;
          overflow: hidden;
        }
        .hrd-freshness-bar-fill {
          height: 100%;
          border-radius: 99px;
          transition: width 1.5s cubic-bezier(0.16,1,0.3,1);
          box-shadow: 0 0 15px currentColor;
        }
        .hrd-bar-labels {
          display: flex;
          justify-content: space-between;
          font-size: 0.45rem;
          font-weight: 900;
          letter-spacing: 0.1em;
          color: var(--text-muted);
        }

        @media (max-width: 700px) {
          .hrd-score-ring-wrap { width: 220px; }
          .hrd-data-grid { grid-template-columns: 1fr; gap: 1.5rem; }
        }

        /* ── Actions Block ── */
        .hrd-actions-block {
          background: linear-gradient(135deg, rgba(var(--accent-rgb), 0.04) 0%, rgba(var(--accent-rgb), 0.01) 100%);
          border: 1px solid rgba(var(--accent-rgb), 0.15);
          border-left: 4px solid var(--accent);
          border-radius: 12px 24px 24px 12px;
          padding: 1.25rem 1.5rem;
          position: relative;
          overflow: hidden;
        }
        .hrd-actions-block::after {
          content: "";
          position: absolute;
          top: 0; right: 0; width: 40px; height: 40px;
          background: linear-gradient(45deg, transparent 50%, rgba(var(--accent-rgb), 0.1) 50%);
        }
        .hrd-actions-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.58rem;
          font-weight: 900;
          letter-spacing: 0.15em;
          color: var(--accent);
          text-transform: uppercase;
          margin: 0 0 0.75rem;
        }
        .hrd-actions-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .hrd-action-item {
          display: flex;
          align-items: flex-start;
          gap: 0.6rem;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text);
          line-height: 1.45;
          padding: 0.4rem 0.6rem;
          border-radius: 8px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.04);
          animation: slideInUp 0.4s ease-out both;
          transition: background 0.2s ease;
        }
        .hrd-action-item:hover { background: rgba(var(--accent-rgb),0.06); }
        .hrd-action-bullet {
          flex-shrink: 0;
          width: 6px;
          height: 6px;
          margin-top: 5px;
          border-radius: 50%;
          background: var(--accent);
          opacity: 0.75;
          box-shadow: 0 0 6px var(--accent);
        }

        @media (max-width: 700px) {
          .hrd-qi-hero { flex-direction: column; align-items: flex-start; }
          .hrd-food-name { font-size: 2rem; }
        }

        /* ── LEGACY hqe styles (kept for compatibility) ── */
        .hqe-wrap { display: none; }
        .hqe-divider {
          height: 1px;
          background: var(--glass-border);
          margin-bottom: 1.25rem;
          opacity: 0.5;
        }
        .hqe-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        .hqe-label-group {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .hqe-label {
          font-size: 0.6rem;
          font-weight: 900;
          letter-spacing: 0.15em;
          color: var(--accent);
          margin: 0;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .hqe-label::before {
          content: '';
          width: 12px; height: 2px;
          background: var(--accent);
          border-radius: 99px;
        }
        .hqe-live-badge {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          background: rgba(244,63,94,0.1);
          color: var(--status-red, #f43f5e);
          padding: 0.2rem 0.5rem;
          border-radius: 6px;
          font-size: 0.55rem;
          font-weight: 900;
          letter-spacing: 0.1em;
          border: 1px solid var(--glass-border);
        }
        .hqe-dot {
          width: 5px; height: 5px;
          background: var(--status-red, #f43f5e);
          border-radius: 50%;
          animation: blink 1s infinite;
        }
        .hqe-safety-chip {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          background: rgba(var(--accent-rgb), 0.08);
          border: 1px solid rgba(var(--accent-rgb), 0.25);
          padding: 0.3rem 0.75rem;
          border-radius: 99px;
          font-size: 0.6rem;
          font-weight: 800;
          color: var(--accent);
          letter-spacing: 0.08em;
        }
        .hqe-body {
          display: flex;
          align-items: flex-start;
          gap: 1.5rem;
        }
        .hqe-gauge-col {
          flex-shrink: 0;
          width: 150px;
        }
        .hqe-data-col {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          min-width: 0;
        }
        .hqe-time-block {
          display: flex;
          align-items: baseline;
          gap: 0.5rem;
        }
        .hqe-hours {
          font-size: 2rem;
          font-weight: 900;
          letter-spacing: -0.04em;
          color: var(--text);
          line-height: 1;
        }
        .hqe-hrs-unit {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-muted);
        }
        .hqe-countdown-row {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.4rem 0.85rem;
          background: rgba(var(--accent-rgb), 0.08);
          border-radius: 10px;
          border: 1px solid var(--glass-border);
          width: fit-content;
        }
        .hqe-countdown-val {
          font-family: var(--font-mono);
          font-size: 1rem;
          color: var(--accent);
          font-weight: 700;
        }
        .hqe-expiry-row {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          color: var(--text-muted);
        }
        .hqe-expiry-val {
          font-size: 0.85rem;
          font-weight: 700;
        }
        .hqe-actions {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }
        .hqe-actions-label {
          font-size: 0.6rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: var(--accent);
          margin: 0;
        }
        .hqe-action-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
        }
        .hqe-action-tag {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.35rem 0.75rem;
          background: rgba(var(--accent-rgb), 0.06);
          border: 1px solid var(--glass-border);
          border-radius: 99px;
          font-size: 0.68rem;
          font-weight: 700;
          color: var(--text);
          text-transform: uppercase;
          letter-spacing: 0.03em;
          animation: slideInUp 0.5s ease-out both;
        }
        .hqe-tag-dot {
          width: 5px; height: 5px;
          background: var(--accent);
          border-radius: 50%;
          opacity: 0.7;
          flex-shrink: 0;
        }
        @media (max-width: 700px) {
          .hqe-body { flex-direction: column; }
          .hqe-gauge-col { width: 100%; display: flex; justify-content: center; }
        }
        /* ─────────────────────────────────────────── */
        .admin-auth-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.8);
          backdrop-filter: blur(10px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          padding: 6rem 1rem 3rem;
          overflow-y: auto;
          z-index: 10000;
        }
        .auth-modal {
          width: 100%;
          max-width: 400px;
          padding: 2.5rem;
          text-align: center;
          border-color: rgba(var(--accent-rgb), 0.3);
          background: var(--panel-elevated);
          border-radius: 24px;
        }
        .modal-header h3 {
          margin: 1rem 0 0.5rem;
          font-size: 1.5rem;
          font-weight: 800;
        }
        .modal-header p {
          font-size: 0.9rem;
          opacity: 0.7;
          margin-bottom: 2rem;
        }
        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .auth-form label {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          text-align: left;
        }
        .auth-form label span {
          font-size: 0.7rem;
          font-weight: 900;
          letter-spacing: 0.1em;
          color: var(--accent);
        }
        .auth-form input {
          width: 100%;
          background: rgba(255,255,255,0.05);
          border: 1px solid var(--glass-border);
          border-radius: 12px;
          padding: 0.75rem 1rem;
          color: var(--text);
        }
        .modal-actions {
          display: flex;
          gap: 1rem;
          margin-top: 1rem;
        }
        .modal-actions button {
          flex: 1;
        }
        .auth-error-msg {
          color: #EF4444;
          font-size: 0.8rem;
          font-weight: 700;
          margin: 0;
        }

        /* Volume Analysis Modal Styles */
        .volume-analysis-modal {
          width: 100%;
          max-width: 600px;
          padding: 3rem;
          background: var(--panel-elevated);
          border-radius: 32px;
          border: 1px solid var(--glass-border);
          box-shadow: 0 30px 60px rgba(0,0,0,0.5);
        }
        .header-icon-ring {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: rgba(var(--accent-rgb), 0.1);
          display: grid;
          place-items: center;
          margin: 0 auto 1.5rem;
          border: 1px solid rgba(var(--accent-rgb), 0.2);
        }
        .volume-grid-luxe {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 1.5rem;
          margin-top: 2rem;
          max-height: 400px;
          overflow-y: auto;
          padding-right: 1rem;
          scrollbar-width: thin;
          scrollbar-color: var(--accent) transparent;
        }
        .volume-item-luxe {
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--glass-border);
          border-radius: 20px;
          padding: 1.25rem;
          transition: all 0.3s ease;
        }
        .volume-item-luxe:hover {
          border-color: var(--accent);
          background: rgba(var(--accent-rgb), 0.05);
        }
        .volume-item-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }
        .unit-tag {
          font-size: 0.65rem;
          font-weight: 900;
          letter-spacing: 0.1em;
          color: var(--text-muted);
        }
        .volume-value {
          font-size: 1.1rem;
          font-weight: 900;
          color: var(--accent);
        }
        .volume-progress-track {
          height: 6px;
          background: var(--bg);
          border-radius: 99px;
          overflow: hidden;
          margin-bottom: 0.75rem;
        }
        .volume-progress-fill {
          height: 100%;
          border-radius: inherit;
        }
        .volume-progress-fill.occupied { background: var(--accent); }
        .volume-progress-fill.empty { background: var(--line); opacity: 0.3; }
        .volume-footer {
          display: flex;
          justify-content: space-between;
          font-size: 0.55rem;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .status-label { color: var(--text-muted); }
        .capacity-label { color: var(--accent); opacity: 0.8; }

        /* Hero Button Styles */
        .hero-top-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
          flex-wrap: wrap;
          gap: 1.5rem;
        }
        .explore-safety-btn {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1.5rem;
          background: rgba(255,255,255,0.05);
          border: 1px solid var(--glass-border);
          border-radius: 99px;
          cursor: pointer;
          transition: all 0.4s cubic-bezier(0.2, 1, 0.3, 1);
          backdrop-filter: blur(10px);
        }
        .explore-safety-btn:hover {
          background: rgba(255,255,255,0.1);
          border-color: var(--accent);
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(var(--accent-rgb), 0.1);
        }
        .explore-safety-btn .btn-label {
          font-size: 0.65rem;
          font-weight: 900;
          letter-spacing: 0.15em;
          color: var(--text);
          opacity: 0.8;
        }

        /* ── Safety Guidelines Modal ── */
        .safety-guidelines-modal {
          width: 100%;
          max-width: 640px;
          padding: 2.5rem;
          background: var(--panel-elevated);
          border-radius: 32px;
          border: 1px solid var(--glass-border);
          box-shadow: 0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(var(--accent-rgb),0.08);
          display: flex;
          flex-direction: column;
          gap: 1.75rem;
        }
        .sg-header {
          display: flex;
          align-items: center;
          gap: 1.25rem;
        }
        .sg-icon-ring {
          flex-shrink: 0;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: rgba(var(--accent-rgb), 0.12);
          border: 1.5px solid rgba(var(--accent-rgb), 0.3);
          display: grid;
          place-items: center;
          animation: sg-pulse 2.5s ease-in-out infinite;
        }
        @keyframes sg-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(var(--accent-rgb), 0.25); }
          50%       { box-shadow: 0 0 0 10px rgba(var(--accent-rgb), 0); }
        }
        .sg-icon { color: var(--accent); width: 22px; height: 22px; }
        .sg-eyebrow {
          font-size: 0.6rem;
          font-weight: 900;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--accent);
          opacity: 0.9;
          margin: 0 0 0.25rem;
        }
        .sg-title {
          font-size: 1.4rem;
          font-weight: 900;
          margin: 0 0 0.35rem;
          color: var(--text);
          letter-spacing: -0.02em;
        }
        .sg-subtitle {
          font-size: 0.8rem;
          color: var(--text-muted);
          margin: 0;
          opacity: 0.75;
        }
        .sg-divider {
          height: 1px;
          background: var(--glass-border);
          opacity: 0.5;
        }
        /* Spec cards grid */
        .sg-specs-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1rem;
        }
        .sg-spec-card {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1.1rem 1.25rem;
          border-radius: 20px;
          background: linear-gradient(145deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%);
          border: 1px solid rgba(255, 255, 255, 0.12);
          transition: all 0.4s cubic-bezier(0.2, 1, 0.3, 1);
          backdrop-filter: blur(12px);
          position: relative;
          overflow: hidden;
        }
        .sg-spec-card::before {
          content: "";
          position: absolute;
          top: 0; left: 0; width: 100%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(var(--accent-rgb), 0.03), transparent);
          transform: translateX(-100%);
          transition: transform 0.8s ease;
        }
        .sg-spec-card:hover {
          background: rgba(var(--accent-rgb), 0.05);
          border-color: rgba(var(--accent-rgb), 0.3);
          transform: translateY(-4px) scale(1.02);
          box-shadow: 0 12px 30px rgba(0,0,0,0.1);
        }
        .sg-spec-card:hover::before {
          transform: translateX(100%);
        }
        .sg-spec-icon-wrap {
          width: 42px; height: 42px;
          border-radius: 14px;
          display: grid; place-items: center;
          flex-shrink: 0;
          transition: all 0.3s ease;
          box-shadow: inset 0 0 10px rgba(0,0,0,0.05);
        }
        .sg-spec-card:hover .sg-spec-icon-wrap {
          transform: rotate(10deg);
        }
        .sg-spec-icon-wrap.accent {
          background: rgba(var(--accent-rgb), 0.15);
          color: var(--accent);
          border: 1px solid rgba(var(--accent-rgb), 0.2);
        }
        .sg-spec-icon-wrap.blue {
          background: rgba(59, 130, 246, 0.15);
          color: #60a5fa;
          border: 1px solid rgba(59, 130, 246, 0.2);
        }
        .sg-spec-icon-wrap.purple {
          background: rgba(139, 92, 246, 0.15);
          color: #a78bfa;
          border: 1px solid rgba(139, 92, 246, 0.2);
        }
        .sg-spec-info {
          display: flex; flex-direction: column; gap: 0.15rem;
          min-width: 0;
          flex: 1;
        }
        .sg-spec-label {
          font-size: 0.62rem;
          font-weight: 950;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--accent);
          opacity: 1;
        }
        .sg-spec-value {
          font-size: 1.25rem;
          font-weight: 950;
          color: #FFFFFF;
          letter-spacing: -0.02em;
          line-height: 1;
          filter: drop-shadow(0 0 12px rgba(255,255,255,0.2));
        }
        .sg-spec-note {
          font-size: 0.65rem;
          color: var(--text);
          opacity: 0.95;
          line-height: 1.2;
          margin-top: 0.15rem;
        }
        /* Prohibited */
        .sg-prohibited-section {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding: 1.25rem;
          background: rgba(239, 68, 68, 0.08);
          border-radius: 20px;
          border: 1px solid rgba(239, 68, 68, 0.3);
          box-shadow: inset 0 0 30px rgba(239, 68, 68, 0.03);
        }
        .sg-prohibited-header {
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }
        .sg-ban-icon { color: #EF4444; filter: drop-shadow(0 0 5px rgba(239, 68, 68, 0.3)); }
        .sg-prohibited-label {
          font-size: 0.65rem;
          font-weight: 900;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: #EF4444;
          filter: brightness(1.2);
        }
        .sg-prohibited-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 0.65rem;
        }
        .sg-chip {
          font-size: 0.75rem;
          font-weight: 900;
          padding: 0.55rem 1.25rem;
          background: rgba(239, 68, 68, 0.22);
          border: 1px solid rgba(239, 68, 68, 0.5);
          border-radius: 14px;
          color: #FFD1D1;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          letter-spacing: 0.03em;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
        }
        .sg-chip:hover {
          background: #EF4444;
          color: white;
          border-color: #EF4444;
          transform: scale(1.05);
          box-shadow: 0 5px 15px rgba(239, 68, 68, 0.2);
        }
        /* Live row */
        .sg-live-row {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          flex-wrap: wrap;
          padding: 1.1rem 1.5rem;
          background: rgba(var(--accent-rgb), 0.04);
          border: 1px solid rgba(var(--accent-rgb), 0.12);
          border-radius: 18px;
          backdrop-filter: blur(8px);
          position: relative;
          overflow: hidden;
        }
        .sg-live-row::before {
          content: "";
          position: absolute;
          top: 0; left: 0; width: 4px; height: 100%;
          background: var(--accent);
          opacity: 0.6;
        }
        .sg-live-badge {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.65rem;
          font-weight: 950;
          letter-spacing: 0.15em;
          color: var(--accent);
          text-transform: uppercase;
        }
        .sg-live-dot {
          width: 8px; height: 8px;
          border-radius: 50%;
          background: var(--accent);
          box-shadow: 0 0 10px var(--accent);
          animation: sg-blink 1.5s infinite;
        }
        @keyframes sg-blink {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .sg-tele-item {
          font-size: 0.75rem;
          font-weight: 800;
          color: var(--text);
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding-left: 1.25rem;
          border-left: 1px solid rgba(var(--accent-rgb), 0.1);
        }
        .sg-tele-item:first-of-type {
          border-left: none;
          padding-left: 0.5rem;
        }
        .sg-close-btn {
          margin-top: 0.25rem;
          width: 100%;
        }


        /* ══════════════════════════════════════════════════
           ENHANCED ADMIN AUTH MODAL — CYBER-BOTANICAL
           ══════════════════════════════════════════════════ */
        .auth-modal-luxe {
          position: relative;
          width: 100%;
          max-width: 440px;
          padding: 2.5rem 2.5rem 2rem;
          background: rgba(var(--panel-rgb, 15, 23, 42), 0.85);
          backdrop-filter: blur(32px) saturate(160%);
          border: 1px solid rgba(var(--accent-rgb, 16, 185, 129), 0.2);
          border-radius: 40px;
          box-shadow: 
            0 30px 70px rgba(0, 0, 0, 0.5),
            inset 0 0 100px rgba(var(--accent-rgb), 0.05);
          overflow: hidden;
          z-index: 1000;
        }

        .auth-nature-bg {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 0;
        }
        .auth-leaf {
          position: absolute;
          font-size: 1.5rem;
          opacity: 0.15;
          filter: blur(1px);
        }
        .leaf-1 { top: 10%; left: 10%; transform: rotate(-15deg); }
        .leaf-2 { bottom: 15%; right: 10%; transform: rotate(45deg); }
        .auth-orb {
          position: absolute;
          top: -20%; right: -20%;
          width: 200px; height: 200px;
          background: radial-gradient(circle, rgba(var(--accent-rgb), 0.15) 0%, transparent 70%);
          filter: blur(40px);
        }

        .auth-close-btn {
          position: absolute;
          top: 1.5rem;
          right: 1.5rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: var(--text-muted);
          width: 36px; height: 36px;
          border-radius: 12px;
          display: grid; place-items: center;
          cursor: pointer;
          transition: all 0.3s var(--ease-spring);
          z-index: 10;
        }
        .auth-close-btn:hover {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          border-color: rgba(239, 68, 68, 0.2);
          transform: rotate(90deg);
        }

        .modal-header-luxe {
          position: relative;
          z-index: 1;
          text-align: center;
          margin-bottom: 1.75rem;
        }
        .auth-icon-container {
          position: relative;
          width: 64px; height: 64px;
          margin: 0 auto 1.25rem;
        }
        .auth-icon-ring {
          position: relative;
          width: 100%; height: 100%;
          background: rgba(var(--accent-rgb), 0.1);
          border: 1px solid rgba(var(--accent-rgb), 0.3);
          border-radius: 24px;
          display: grid; place-items: center;
          z-index: 2;
          backdrop-filter: blur(10px);
        }
        .auth-icon-pulse {
          position: absolute;
          inset: -8px;
          border-radius: 32px;
          border: 2px solid var(--accent);
          opacity: 0.2;
          animation: auth-pulse 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        @keyframes auth-pulse {
          0% { transform: scale(0.9); opacity: 0.5; }
          100% { transform: scale(1.2); opacity: 0; }
        }

        .auth-eyebrow {
          font-size: 0.65rem;
          font-weight: 900;
          letter-spacing: 0.25em;
          color: var(--accent);
          margin-bottom: 0.5rem;
          text-transform: uppercase;
        }
        .auth-title {
          font-size: 1.75rem;
          font-weight: 950;
          letter-spacing: -0.02em;
          color: var(--text);
          margin-bottom: 0.5rem;
        }
        .auth-subtitle {
          font-size: 0.85rem;
          color: var(--text-muted);
          line-height: 1.5;
          max-width: 280px;
          margin: 0 auto;
        }

        .auth-form-luxe {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          gap: 1.75rem;
        }
        .auth-field-group {
          display: flex;
          flex-direction: column;
          gap: 1.15rem;
        }
        .auth-field {
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }
        .field-label-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding-left: 0.25rem;
        }
        .field-label-row span {
          font-size: 0.6rem;
          font-weight: 900;
          letter-spacing: 0.1em;
          color: var(--text-muted);
        }

        .input-wrapper-luxe {
          position: relative;
          width: 100%;
        }
        .input-wrapper-luxe input {
          width: 100%;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 0.9rem 1.25rem;
          font-size: 1rem;
          color: var(--text);
          font-family: var(--font-mono, monospace);
          transition: all 0.3s ease;
        }
        .input-wrapper-luxe input:focus {
          outline: none;
          background: rgba(255, 255, 255, 0.05);
          border-color: transparent;
        }
        .input-focus-border {
          position: absolute;
          inset: 0;
          border-radius: 16px;
          border: 2px solid var(--accent);
          pointer-events: none;
          opacity: 0;
          transition: all 0.3s ease;
          transform: scale(0.98);
        }
        .input-wrapper-luxe input:focus + .input-focus-border {
          opacity: 1;
          transform: scale(1);
          box-shadow: 0 0 20px rgba(var(--accent-rgb), 0.2);
        }

        .auth-error-luxe {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.85rem 1rem;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 12px;
          color: #ef4444;
          font-size: 0.8rem;
          font-weight: 700;
        }

        .auth-actions-luxe {
          display: grid;
          grid-template-columns: 1fr 1.5fr;
          gap: 1rem;
        }
        .auth-btn-secondary {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: var(--text-muted);
          padding: 0.85rem;
          border-radius: 16px;
          font-weight: 800;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        .auth-btn-secondary:hover {
          background: rgba(255, 255, 255, 0.05);
          color: var(--text);
          border-color: rgba(255, 255, 255, 0.2);
        }
        .auth-btn-primary {
          background: linear-gradient(135deg, var(--accent) 0%, #10B981 100%);
          border: none;
          color: #000;
          padding: 0.85rem;
          border-radius: 16px;
          font-weight: 950;
          font-size: 0.85rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          cursor: pointer;
          transition: all 0.3s var(--ease-spring);
          box-shadow: 0 10px 25px rgba(var(--accent-rgb), 0.2);
        }
        .auth-btn-primary:hover {
          transform: translateY(-4px);
          box-shadow: 0 15px 35px rgba(var(--accent-rgb), 0.4);
          filter: brightness(1.1);
        }
        .auth-btn-primary:active { transform: translateY(-1px); }

        .auth-footer {
          margin-top: 1.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          font-size: 0.55rem;
          font-weight: 900;
          letter-spacing: 0.1em;
          color: var(--text-muted);
          opacity: 0.6;
        }

        [data-theme-mode="light"] .auth-modal-luxe {
          background: rgba(255, 255, 255, 0.95);
          border-color: rgba(16, 185, 129, 0.1);
        }
        [data-theme-mode="light"] .input-wrapper-luxe input {
          background: #f8fafc;
          border-color: #e2e8f0;
          color: #0f172a;
        }
        [data-theme-mode="light"] .auth-btn-secondary {
          border-color: #e2e8f0;
        }
        [data-theme-mode="light"] .auth-btn-primary {
          color: #fff;
        }

      `}</style>

         <ScrollReveal direction="up" distance={20} delay={0.1} className="full-width-section">
          <div className="feature-header animate-luxe-entry" style={{ marginTop: '3rem', marginBottom: '1.5rem' }}>
            <div className="live-status-indicator">
              <span className="pulsing-dot" />
              <span className="live-text">SYSTEM LIVE</span>
            </div>
            <p className="eyebrow-accent">MISSION CONTROL</p>
            <h2 className="gradient-text-luxe">Analytics Dashboard</h2>
            <div className="header-divider-luxe" />
            <div className="eco-pulse-indicator">
              <div className="eco-dot" />
              <span className="eco-label">SUSTAINABILITY INDEX: OPTIMAL</span>
            </div>
            <p className="heading-subtext">Real-time telemetry and food health forecasting</p>
          </div>
        </ScrollReveal>

        <div className="floating-leaf-system">
          <span className="leaf-particle" style={{ top: '15%', left: '10%', animationDelay: '0s' }}>🍃</span>
          <span className="leaf-particle" style={{ top: '65%', left: '80%', animationDelay: '4s' }}>🌿</span>
          <span className="leaf-particle" style={{ top: '35%', left: '45%', animationDelay: '8s' }}>🌱</span>
          <span className="leaf-particle" style={{ top: '80%', left: '20%', animationDelay: '2s' }}>🍃</span>
        </div>

      <ScrollReveal direction="up" distance={30} delay={0.2} className="full-width-section">
        <section style={{ gridColumn: '1 / -1', marginBottom: '2rem' }}>
          <FleetMap />
        </section>
      </ScrollReveal>

      <section className="receiver-editorial-layout" style={{ gridColumn: '1 / -1' }}>
        <style>{`
            .luxe-quality-card {
              grid-column: 1 / -1;
              background: linear-gradient(165deg, var(--panel) 0%, var(--bg) 100%);
              border: 1px solid var(--glass-border);
              position: relative;
              overflow: hidden;
              color: var(--text);
            }
            .card-header-premium {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 2rem;
            }
            .header-title-group {
              display: flex;
              align-items: center;
              gap: 1rem;
            }
            .card-label {
              color: var(--accent) !important;
              font-weight: 900;
              font-size: 0.65rem;
              text-transform: uppercase;
              letter-spacing: 0.15em;
              margin: 0;
              opacity: 0.9;
              display: flex;
              align-items: center;
              gap: 0.5rem;
            }
            .card-label::before {
              content: "";
              width: 12px;
              height: 2px;
              background: var(--accent);
              border-radius: 99px;
            }
            .live-indicator {
              display: flex;
              align-items: center;
              gap: 0.4rem;
              background: rgba(244, 63, 94, 0.1);
              color: var(--status-red);
              padding: 0.25rem 0.6rem;
              border-radius: 6px;
              font-size: 0.6rem;
              font-weight: 900;
              letter-spacing: 0.1em;
              border: 1px solid var(--glass-border);
            }
            .live-dot {
              width: 5px;
              height: 5px;
              background: var(--status-red);
              border-radius: 50%;
              animation: blink 1s infinite;
            }
            @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
            
            .safety-badge {
              display: flex;
              align-items: center;
              gap: 0.6rem;
              background: rgba(52, 211, 153, 0.1) !important;
              border: 1px solid var(--accent) !important;
              padding: 0.4rem 0.8rem;
              border-radius: 99px;
            }
            .safety-text {
              font-size: 0.65rem;
              font-weight: 800;
              color: var(--accent) !important;
              letter-spacing: 0.1em;
            }
            
            .gauge-hero-layout {
              display: grid;
              grid-template-columns: 1fr 1.2fr;
              gap: 3rem;
              align-items: center;
            }
            .gauge-hero-copy {
              display: flex;
              flex-direction: column;
              gap: 1.5rem;
            }
            .time-stack {
              display: flex;
              flex-direction: column;
              gap: 0.5rem;
            }
            .quality-hours {
              font-size: 2.5rem;
              font-weight: 900;
              letter-spacing: -0.05em;
              color: var(--text) !important;
              margin: 0;
              line-height: 1;
              display: flex;
              align-items: baseline;
              gap: 0.75rem;
            }
            .hours-label {
              font-size: 1rem;
              font-weight: 600;
              color: var(--text-muted) !important;
              text-transform: none;
              letter-spacing: 0;
              opacity: 1 !important;
            }
            .countdown-ribbon {
              display: flex;
              align-items: center;
              gap: 0.75rem;
              padding: 0.5rem 1rem;
              background: rgba(var(--accent-rgb, 16, 185, 129), 0.1) !important;
              border-radius: 12px;
              width: fit-content;
              border: 1px solid var(--line) !important;
            }
            .quality-countdown {
              font-family: var(--font-mono);
              font-size: 1.2rem;
              color: var(--accent) !important;
              font-weight: 700;
            }
            .expiry-details {
              display: flex;
              align-items: center;
              gap: 0.75rem;
              color: var(--text-muted) !important;
            }
            .quality-expiry {
              font-size: 0.9rem;
              font-weight: 700;
              margin: 0;
              color: var(--text-muted) !important;
            }
            .action-tag-cloud {
              display: flex;
              flex-direction: column;
              gap: 0.75rem;
            }
            .cloud-label {
              font-size: 0.65rem;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.15em;
              color: var(--accent) !important;
            }
            .tag-list-enhanced {
              display: flex;
              flex-wrap: wrap;
              gap: 0.6rem;
            }
            .info-tag-luxe {
              padding: 0.5rem 1rem;
              background: rgba(var(--accent-rgb, 16, 185, 129), 0.08) !important;
              border: 1px solid var(--line) !important;
              border-radius: 99px;
              font-size: 0.8rem;
              font-weight: 800;
              color: var(--text) !important;
              display: flex;
              align-items: center;
              gap: 0.6rem;
              animation: slideInUp 0.5s ease-out both;
              text-transform: uppercase;
              letter-spacing: 0.02em;
            }

            @keyframes slideInUp {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0); }
            }

            .card-header-mini {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 1.25rem;
            }
            .mini-icon {
              font-size: 1.2rem;
              opacity: 0.8;
            }
            .premium-h3 {
              font-size: 1.2rem !important;
              font-weight: 800 !important;
              letter-spacing: -0.03em !important;
              margin: 0.4rem 0 !important;
              color: var(--text) !important;
            }
            .premium-p {
              font-size: 0.85rem !important;
              line-height: 1.5 !important;
              color: var(--text-muted) !important;
              margin: 0 !important;
            }
            .mb-2 { margin-bottom: 1.25rem !important; }
            .mb-1 { margin-bottom: 1rem !important; }
            
            /* Profile Card Specifics */
            .luxe-metric-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 1rem;
              margin-top: 1.5rem;
            }
            .luxe-metric-item {
              display: flex;
              flex-direction: column;
              gap: 0.4rem;
              padding: 1rem;
              background: rgba(var(--accent-rgb, 16, 185, 129), 0.05);
              border-radius: 12px;
              border: 1px solid var(--line);
            }
            .item-label {
              font-size: 0.6rem;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.1em;
              color: var(--accent);
            }
            .item-value {
              font-size: 0.9rem;
              font-weight: 700;
              color: var(--text) !important;
              display: flex;
              align-items: center;
              gap: 0.5rem;
            }
            .date-value { font-size: 0.8rem; }
            
            /* Telemetry Enhanced Bento */
            .telemetry-meta-group {
              display: flex;
              align-items: center;
              gap: 1.5rem;
            }
            .signal-strength {
              display: flex;
              align-items: flex-end;
              gap: 2px;
              height: 12px;
            }
            .signal-bar {
              width: 3px;
              background: var(--line);
              border-radius: 1px;
            }
            .signal-bar:nth-child(1) { height: 4px; }
            .signal-bar:nth-child(2) { height: 7px; }
            .signal-bar:nth-child(3) { height: 10px; }
            .signal-bar:nth-child(4) { height: 12px; }
            .signal-bar.active { background: var(--accent); }

            .telemetry-bento-grid-enhanced {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 1.25rem;
            }
            .bento-item-luxe {
              padding: 1.5rem;
              background: var(--panel-elevated) !important;
              border: 1px solid var(--glass-border);
              border-radius: 24px;
              display: flex;
              align-items: center;
              gap: 1.5rem;
              position: relative;
              overflow: hidden;
              transition: all 0.4s var(--ease-spring);
              backdrop-filter: blur(10px);
            }
            .bento-item-luxe:hover {
              border-color: var(--accent);
              transform: translateY(-6px) scale(1.02);
              box-shadow: 0 20px 40px rgba(0,0,0,0.1);
              background: var(--panel-light) !important;
            }
            
            .bento-copy {
              display: flex;
              flex-direction: column;
              gap: 0.25rem;
            }
            .bento-label {
              font-size: 0.65rem;
              font-weight: 800;
              color: var(--text-muted);
              text-transform: uppercase;
              letter-spacing: 0.1em;
              opacity: 0.8;
            }
            .bento-value {
              font-size: 1.25rem;
              font-weight: 900;
              color: var(--text);
              letter-spacing: -0.02em;
            }
            .bento-unit {
              font-size: 0.7rem;
              font-weight: 700;
              color: var(--accent);
              margin-left: 0.15rem;
            }

            .mini-gauge {
              width: 54px; height: 54px;
              position: relative;
              flex-shrink: 0;
            }
            .circular-chart {
              width: 100%; height: 100%;
              transform: rotate(-90deg);
            }
            .circle-bg {
              fill: none;
              stroke: var(--line);
              stroke-width: 2.5;
              opacity: 0.3;
            }
            .circle {
              fill: none;
              stroke-width: 3.5;
              stroke-linecap: round;
              transition: stroke-dasharray 1s cubic-bezier(0.4, 0, 0.2, 1);
            }
            .circular-chart.green .circle { stroke: var(--accent); }
            .circular-chart.blue .circle { stroke: #3B82F6; }
            
            .gauge-icon {
              position: absolute;
              inset: 0;
              display: grid;
              place-items: center;
              font-size: 1.1rem;
              filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
            }

            .bento-icon-bg {
              width: 54px; height: 54px;
              background: rgba(var(--accent-rgb), 0.05);
              border-radius: 16px;
              display: grid; place-items: center;
              font-size: 1.4rem;
              flex-shrink: 0;
              border: 1px solid rgba(var(--accent-rgb), 0.1);
            }

            .value-group {
              display: flex;
              align-items: baseline;
              gap: 0.15rem;
            }
            
            /* Gas Analysis Enhancements */
            .luxe-gas-card {
              position: relative;
              overflow: hidden;
            }
            .vapor-ambient-effect {
              position: absolute;
              top: -50%; left: -50%; width: 200%; height: 200%;
              background: radial-gradient(circle at center, var(--accent-glow) 0%, transparent 40%);
              opacity: 0.1;
              animation: vaporDrift 20s linear infinite;
              pointer-events: none;
            }
            @keyframes vaporDrift {
              0% { transform: translate(0, 0) rotate(0deg); }
              100% { transform: translate(-10%, -10%) rotate(360deg); }
            }
            .aqi-badge {
              display: flex;
              align-items: center;
              gap: 0.5rem;
              font-size: 0.55rem;
              font-weight: 900;
              color: var(--text-muted);
              letter-spacing: 0.1em;
              padding: 0.3rem 0.6rem;
              background: var(--panel-elevated);
              border: 1px solid var(--glass-border);
              border-radius: 99px;
            }
            .aqi-dot {
              width: 5px; height: 5px; border-radius: 50%;
              background: var(--accent);
              box-shadow: 0 0 8px var(--accent);
            }
            
            .gas-spectrum-visualizer {
              margin-bottom: 2rem;
            }
            .spectrum-track {
              height: 6px;
              background: var(--panel-elevated);
              border-radius: 99px;
              overflow: hidden;
              border: 1px solid var(--glass-border);
            }
            .spectrum-fill {
              height: 100%;
              border-radius: inherit;
              transition: width 2s cubic-bezier(0.4, 0, 0.2, 1);
            }
            .spectrum-labels {
              display: flex;
              justify-content: space-between;
              margin-top: 0.5rem;
              font-size: 0.6rem;
              font-weight: 700;
              color: var(--text-muted);
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }
            
            .luxe-tag-cloud-enhanced {
              display: flex;
              flex-direction: column;
              gap: 0.75rem;
            }
            .luxe-vapor-tag {
              display: grid;
              grid-template-columns: auto 1fr auto;
              align-items: center;
              gap: 1.25rem;
              padding: 1rem 1.25rem;
              background: var(--panel-elevated);
              border: 1px solid var(--glass-border);
              border-radius: 16px;
              transition: all 0.3s ease;
              animation: slideInLeft 0.5s ease-out both;
            }
            .luxe-vapor-tag:hover {
              border-color: var(--accent);
              background: rgba(var(--accent-rgb, 16, 185, 129), 0.03);
              transform: translateX(5px);
            }
            .tag-glow-dot {
              width: 8px; height: 8px; border-radius: 50%;
              background: var(--accent);
              opacity: 0.6;
              box-shadow: 0 0 12px var(--accent);
            }
            .tag-text {
              font-size: 0.8rem;
              font-weight: 800;
              color: var(--text) !important;
              letter-spacing: 0.02em;
              text-transform: uppercase;
            }
            .tag-intensity-bar {
              width: 60px;
              height: 4px;
              background: var(--bg);
              border-radius: 99px;
              overflow: hidden;
            }
            .intensity-fill {
              height: 100%;
              background: var(--accent);
              border-radius: inherit;
              opacity: 0.7;
            }
            
            @keyframes slideInLeft {
              from { opacity: 0; transform: translateX(-20px); }
              to { opacity: 1; transform: translateX(0); }
            }

            /* Vapor Waveform */
            .vapor-waveform-container {
              position: absolute;
              bottom: 0; left: 0; width: 100%; height: 60px;
              pointer-events: none;
              opacity: 0.4;
              z-index: 0;
            }
            .wave {
              position: absolute;
              bottom: 0; left: 0; width: 200%; height: 100%;
              background: repeat-x url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 60'%3E%3Cpath d='M0,30 C150,10 350,50 500,30 C650,10 850,50 1000,30 L1000,60 L0,60 Z' fill='%2310B981' fill-opacity='0.2'/%3E%3C/svg%3E");
              animation: waveMove 10s linear infinite;
            }
            .wave-2 { animation-duration: 7s; opacity: 0.5; bottom: 5px; }
            .wave-3 { animation-duration: 13s; opacity: 0.3; bottom: 10px; }
            
            @keyframes waveMove {
              from { transform: translateX(0); }
              to { transform: translateX(-50%); }
            }

            /* Corner Accents */
            .botanical-corner-accent {
              position: absolute;
              font-size: 3rem;
              opacity: 0.05;
              pointer-events: none;
              transition: all 0.5s ease;
              z-index: 0;
            }
            .botanical-corner-accent.top-right { top: -10px; right: -10px; transform: rotate(15deg); }
            .botanical-corner-accent.bottom-right { bottom: -10px; right: -10px; transform: rotate(-15deg); }
            .receiver-card:hover .botanical-corner-accent { opacity: 0.1; transform: scale(1.2) rotate(0deg); }

            /* Retrieval Vault - Extreme Luxe */
            .luxe-retrieve-card {
              position: relative;
              overflow: hidden;
              background: var(--panel) !important;
              min-height: 600px;
            }
            .retrieve-accent-glow {
              position: absolute;
              top: -20%; right: -20%; width: 60%; height: 60%;
              background: radial-gradient(circle, rgba(var(--accent-rgb), 0.08) 0%, transparent 70%);
              pointer-events: none;
              z-index: 1;
            }
            .vault-chamber-bg {
              position: absolute;
              inset: 0;
              background-image: radial-gradient(circle at 20% 30%, rgba(255,255,255,0.02) 0%, transparent 40%);
              pointer-events: none;
            }
            
            .vault-visualizer {
              position: relative;
              width: 140px;
              height: 140px;
              display: grid;
              place-items: center;
              margin: 0 auto;
            }
            .mechanical-rings {
              position: absolute;
              inset: 0;
            }
            .ring {
              position: absolute;
              inset: 0;
              border-radius: 50%;
              border: 1px solid var(--glass-border);
              opacity: 0.3;
            }
            .ring-1 { border-style: dashed; animation: rotateCW 20s linear infinite; }
            .ring-2 { inset: 20px; border-width: 2px; border-color: rgba(var(--accent-rgb), 0.1); animation: rotateCCW 15s linear infinite; }
            .ring-3 { inset: 40px; border-style: dotted; animation: rotateCW 10s linear infinite; }
            
            @keyframes rotateCW { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            @keyframes rotateCCW { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }

            .retrieve-vault-core {
              width: 80px; height: 80px;
              background: var(--panel-elevated);
              border: 1px solid var(--glass-border);
              border-radius: 20px;
              display: grid;
              place-items: center;
              position: relative;
              z-index: 2;
              box-shadow: 0 10px 25px rgba(0,0,0,0.2);
              transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            .retrieve-vault-core.is-ready {
              border-color: var(--accent);
              box-shadow: 0 0 35px rgba(var(--accent-rgb), 0.2);
              background: radial-gradient(circle at center, rgba(var(--accent-rgb), 0.15) 0%, rgba(var(--accent-rgb), 0.05) 100%);
              animation: corePulsate 2s ease-in-out infinite;
            }
            @keyframes corePulsate {
              0%, 100% { transform: scale(1); box-shadow: 0 0 25px rgba(var(--accent-rgb), 0.15); }
              50% { transform: scale(1.03); box-shadow: 0 0 45px rgba(var(--accent-rgb), 0.3); }
            }
            .retrieve-vault-core.is-locked {
              opacity: 0.8;
            }
            .scanner-line {
              position: absolute;
              top: 0; left: 0; right: 0; height: 2px;
              background: var(--accent);
              box-shadow: 0 0 10px var(--accent);
              opacity: 0.4;
              animation: scanMove 3s ease-in-out infinite;
              z-index: 3;
            }
            @keyframes scanMove { 0%, 100% { top: 10%; } 50% { top: 90%; } }

            .vault-box {
              position: relative;
              z-index: 2;
            }
            .box-icon { font-size: 1.8rem; filter: drop-shadow(0 0 8px rgba(0,0,0,0.2)); }
            .core-glow {
              position: absolute;
              inset: -20px;
              background: radial-gradient(circle, var(--accent-glow) 0%, transparent 70%);
              opacity: 0;
              transition: opacity 0.5s ease;
            }
            .is-ready .core-glow { opacity: 0.3; }
            
            .vault-tech-specs {
              margin-top: 1.5rem;
            }
            .tech-specs-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 0.75rem;
            }
            .spec-pill-enhanced {
              background: var(--panel-elevated);
              border: 1px solid var(--glass-border);
              padding: 0.5rem 0.75rem;
              border-radius: 12px;
              display: flex;
              align-items: center;
              gap: 0.6rem;
              transition: all 0.3s ease;
            }
            .spec-pill-enhanced:hover { border-color: var(--accent); background: rgba(var(--accent-rgb), 0.03); }
            .spec-dot.pulsing { animation: pulseGlow 2s infinite; }
            .spec-copy { display: flex; flex-direction: column; gap: 0.1rem; }
            .spec-label { font-size: 0.5rem; font-weight: 800; color: var(--text-muted); letter-spacing: 0.05em; }
            .spec-status { font-size: 0.65rem; font-weight: 700; color: var(--text); }
            
            .access-meta-enhanced {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 1rem;
              margin-top: 1rem;
            }
            .meta-card {
              background: rgba(var(--accent-rgb), 0.03);
              padding: 0.85rem 1rem;
              border-radius: 16px;
              border: 1px solid rgba(var(--accent-rgb), 0.1);
              display: flex;
              flex-direction: column;
              gap: 0.35rem;
              transition: all 0.3s ease;
              position: relative;
              overflow: hidden;
            }
            .meta-card:hover {
              background: rgba(var(--accent-rgb), 0.06);
              border-color: rgba(var(--accent-rgb), 0.3);
              transform: translateY(-2px);
            }
            .meta-card::before {
              content: "";
              position: absolute;
              top: 0; left: 0; width: 2px; height: 100%;
              background: var(--accent);
              opacity: 0.5;
            }
            .meta-card .meta-label { margin: 0; }
            .meta-card .meta-val { font-size: 0.85rem; }
            
            .meta-val.pulse {
              animation: fastPulseGreen 1.5s infinite;
            }
            @keyframes fastPulseGreen {
              0%, 100% { opacity: 1; text-shadow: 0 0 5px var(--accent); }
              50% { opacity: 0.5; text-shadow: none; }
            }

            .security-verified-badge {
              display: flex;
              align-items: center;
              gap: 0.5rem;
              font-size: 0.55rem;
              font-weight: 900;
              color: var(--accent);
              letter-spacing: 0.1em;
              padding: 0.3rem 0.6rem;
              background: rgba(var(--accent-rgb), 0.1);
              border: 1px solid rgba(var(--accent-rgb), 0.2);
              border-radius: 99px;
            }
            .verify-dot {
              width: 5px; height: 5px; border-radius: 50%;
              background: var(--accent);
              animation: pulseGreen 1s infinite;
            }

            .retrieve-hero-luxe {
              display: grid;
              grid-template-columns: 220px 1fr;
              gap: 2.5rem;
              align-items: center;
              margin: 2rem 0;
            }

            .retrieve-details-hub {
              display: flex;
              flex-direction: column;
              gap: 0.5rem;
            }
            .luxe-retrieve-card .premium-p {
              color: var(--text) !important;
              opacity: 0.9;
            }
            .access-meta {
              display: flex;
              justify-content: center;
              gap: 2.5rem;
              margin-top: 1rem;
              padding-top: 1rem;
              border-top: 1px solid var(--line);
            }
            .meta-item {
              display: flex;
              flex-direction: column;
              gap: 0.2rem;
            }
            .meta-label {
              font-size: 0.55rem;
              font-weight: 800;
              color: var(--text-muted) !important;
              text-transform: uppercase;
              letter-spacing: 0.1em;
              opacity: 0.8;
            }
            .meta-val {
              font-size: 0.75rem;
              font-weight: 800;
              color: var(--accent) !important;
              font-family: var(--font-mono);
              text-shadow: 0 0 8px rgba(var(--accent-rgb), 0.3);
            }
            .meta-item {
              display: flex;
              flex-direction: column;
              gap: 0.2rem;
              position: relative;
            }
            .meta-item:not(:last-child)::after {
              content: "";
              position: absolute;
              right: -1.25rem;
              top: 20%;
              height: 60%;
              width: 1px;
              background: var(--line);
              opacity: 0.3;
            }

            .retrieve-action-area-luxe {
              margin-top: 1rem;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 1rem;
              width: 100%;
            }
            .retrieve-action-area-luxe .premium-slider-container {
              width: 100% !important;
              max-width: none !important;
              height: 64px !important;
              border-radius: 32px !important;
              padding: 4px !important;
            }
            .retrieve-action-area-luxe .slider-thumb-premium {
              width: 56px !important;
              height: 56px !important;
              border-radius: 28px !important;
            }
            .safety-footer-text {
              font-size: 0.7rem;
              color: var(--text-muted) !important;
              display: flex;
              align-items: center;
              gap: 0.5rem;
              opacity: 0.8;
            }
            .lock-icon { font-size: 0.8rem; }
            
            /* Luxe Buttons */
            .luxe-btn {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 0.75rem;
              padding: 1rem 2rem !important;
            }
            .btn-icon { font-size: 1.1rem; }
            
            @media (max-width: 800px) {
              .gauge-hero-layout {
                grid-template-columns: 1fr;
                gap: 2rem;
                text-align: center;
              }
              .gauge-hero-copy {
                align-items: center;
              }
              .quality-hours {
                justify-content: center;
              }
              .tag-list-enhanced {
                justify-content: center;
              }
              .card-header-premium {
                flex-direction: column;
                gap: 1rem;
                align-items: center;
              }
              .luxe-metric-grid, .telemetry-bento-grid-enhanced {
                grid-template-columns: 1fr;
              }
            }

            .system-status-badge-premium {
              display: flex;
              align-items: center;
              gap: 0.6rem;
              font-size: 0.55rem;
              font-weight: 900;
              color: var(--accent);
              letter-spacing: 0.2em;
              padding: 0.5rem 1rem;
              background: rgba(var(--accent-rgb), 0.05);
              border: 1px solid rgba(var(--accent-rgb), 0.15);
              border-radius: 99px;
              backdrop-filter: blur(10px);
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
            }
            .pulse-dot {
              width: 8px;
              height: 8px;
              border-radius: 50%;
              background: var(--accent);
              box-shadow: 0 0 12px var(--accent);
              animation: pulseGlow 2s infinite;
            }
            .luxe-actions-card {
              padding: 2rem !important;
              background: var(--panel) !important;
            }
            .mission-control-layout {
              display: grid;
              grid-template-columns: 180px 1fr;
              gap: 2rem;
              margin-top: 1.25rem;
              position: relative;
              z-index: 2;
            }
            .status-display-sector {
              display: flex;
              flex-direction: column;
              gap: 1.5rem;
            }
            .stat-row {
              display: flex;
              flex-direction: column;
              gap: 0.4rem;
            }
            .stat-label-luxe {
              font-size: 0.55rem;
              font-weight: 800;
              color: var(--text-muted);
              text-transform: uppercase;
              letter-spacing: 0.1em;
              display: flex;
              align-items: center;
              gap: 0.5rem;
            }
            .stat-value-luxe {
              font-size: 0.85rem;
              font-weight: 700;
              color: var(--text) !important;
            }
            .stat-value-luxe.mono {
              font-family: var(--font-mono);
              letter-spacing: 0.02em;
              color: var(--accent) !important;
              font-size: 0.9rem;
              background: rgba(var(--accent-rgb), 0.05);
              padding: 0.2rem 0.6rem;
              border-radius: 4px;
            }



            .action-sector {
              display: flex;
              flex-direction: column;
              gap: 1.25rem;
            }
            .glass-button-stack {
              display: flex;
              flex-direction: column;
              gap: 1rem;
            }
            .glass-action-btn {
              position: relative;
              overflow: hidden;
              background: rgba(var(--accent-rgb), 0.03);
              border: 1px solid var(--glass-border);
              padding: 0.85rem 1.25rem !important;
              border-radius: 12px !important;
              font-size: 0.75rem !important;
              font-weight: 900 !important;
              letter-spacing: 0.08em;
              color: var(--text) !important;
              transition: all 0.4s cubic-bezier(0.2, 1, 0.3, 1);
              backdrop-filter: blur(10px);
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .glass-action-btn::after {
              content: "→";
              font-size: 1.1rem;
              opacity: 0.5;
              transition: transform 0.3s ease;
            }
            .glass-action-btn:hover::after {
              transform: translateX(4px);
              opacity: 1;
            }
            .glass-action-btn.sync { border-color: rgba(var(--accent-rgb), 0.3); }
            .glass-action-btn.lockdown { border-color: rgba(239, 68, 68, 0.3); color: #EF4444 !important; background: rgba(239, 68, 68, 0.03); }
            
            .glass-action-btn:hover {
              transform: translateY(-2px);
            }
            .glass-action-btn.sync:hover { 
              background: var(--accent); 
              color: #fff !important; 
              border-color: var(--accent); 
              box-shadow: 0 10px 25px var(--accent-glow); 
            }
            .glass-action-btn.lockdown:hover { 
              background: #EF4444; 
              color: #fff !important; 
              border-color: #EF4444; 
              box-shadow: 0 10px 25px rgba(239, 68, 68, 0.3); 
            }

            .btn-shine {
              position: absolute;
              top: 0; left: -100%; width: 50%; height: 100%;
              background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
              transform: skewX(-25deg);
              transition: left 0.6s ease;
            }
            .glass-action-btn:hover .btn-shine { left: 150%; }

            .security-shield-bg {
              position: absolute;
              top: 50%; left: 50%; transform: translate(-50%, -50%);
              width: 150px; height: 150px;
              background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2310B981' fill-opacity='0.03'%3E%3Cpath d='M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z'/%3E%3C/svg%3E") no-repeat center;
              background-size: contain;
              pointer-events: none;
              z-index: 1;
            }
            
            .mission-scanline {
              position: absolute;
              inset: 0;
              background: linear-gradient(to bottom, transparent, rgba(var(--accent-rgb), 0.05) 50%, transparent);
              background-size: 100% 4px;
              animation: scanlineMove 8s linear infinite;
              pointer-events: none;
              z-index: 1;
              opacity: 0.3;
            }
            @keyframes scanlineMove { from { transform: translateY(-100%); } to { transform: translateY(100%); } }

            .sector-title {
              font-size: 1.1rem;
              font-weight: 950;
              color: #10B981;
              letter-spacing: -0.01em;
              margin-bottom: 1.25rem;
              display: flex;
              align-items: center;
              gap: 0.85rem;
              text-transform: uppercase;
              opacity: 1;
              text-shadow: 0 0 10px rgba(16, 185, 129, 0.1);
            }
            .sector-title svg {
              color: var(--accent);
              filter: drop-shadow(0 0 8px rgba(16, 185, 129, 0.4));
              flex-shrink: 0;
            }
            
            /* Cyber-Nature Card Redesign (Dark + Nature) */
            .nature-card-redesign {
              background: rgba(12, 14, 18, 0.85) !important;
              backdrop-filter: blur(40px) saturate(180%) !important;
              -webkit-backdrop-filter: blur(40px) saturate(180%) !important;
              border: 1px solid rgba(16, 185, 129, 0.2) !important;
              border-radius: 32px !important;
              box-shadow: 
                0 20px 40px rgba(0, 0, 0, 0.4),
                inset 0 0 40px rgba(16, 185, 129, 0.05) !important;
              color: #F0F6FC !important;
              padding: 2.5rem !important;
              position: relative !important;
              overflow: hidden !important;
              transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1) !important;
            }

            .nature-card-redesign::before {
              content: "";
              position: absolute;
              inset: 0;
              background: linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, transparent 100%);
              pointer-events: none;
            }

            /* Neon Glow Border Effect */
            .nature-card-redesign::after {
              content: "";
              position: absolute;
              inset: -1px;
              background: linear-gradient(90deg, #10B981, #34D399, #10B981);
              background-size: 200% auto;
              mask: 
                linear-gradient(#fff 0 0) content-box, 
                linear-gradient(#fff 0 0);
              -webkit-mask: 
                linear-gradient(#fff 0 0) content-box, 
                linear-gradient(#fff 0 0);
              -webkit-mask-composite: xor;
              mask-composite: exclude;
              padding: 1.5px;
              border-radius: inherit;
              opacity: 0.3;
              transition: opacity 0.5s ease;
              animation: shimmer 4s linear infinite;
            }

            @keyframes shimmer {
              to { background-position: 200% center; }
            }

            .nature-card-redesign:hover {
              transform: translateY(-10px) scale(1.01) !important;
              border-color: rgba(16, 185, 129, 0.6) !important;
              box-shadow: 
                0 40px 80px rgba(0, 0, 0, 0.6),
                0 0 30px rgba(16, 185, 129, 0.2) !important;
            }

            .nature-card-redesign:hover::after {
              opacity: 1;
            }

            /* Technical Corner Marks */
            .nature-corner {
              position: absolute;
              width: 20px;
              height: 20px;
              border: 2px solid #10B981;
              pointer-events: none;
              z-index: 2;
              opacity: 0.4;
              transition: all 0.5s ease;
            }
            .nature-corner-tl { top: 15px; left: 15px; border-right: 0; border-bottom: 0; }
            .nature-corner-tr { top: 15px; right: 15px; border-left: 0; border-bottom: 0; }
            .nature-corner-bl { bottom: 15px; left: 15px; border-right: 0; border-top: 0; }
            .nature-corner-br { bottom: 15px; right: 15px; border-left: 0; border-top: 0; }

            .nature-card-redesign:hover .nature-corner {
              opacity: 1;
              width: 30px;
              height: 30px;
            }

            .nature-card-redesign .premium-h3 {
              color: #FFFFFF !important;
            }

            .nature-card-redesign .premium-p {
              color: #94A3B8 !important;
            }

            /* Nature List Item - Dark Integration */
            .nature-list-item {
              background: rgba(255, 255, 255, 0.05) !important; /* Darker subcards */
              border: 1px solid rgba(255, 255, 255, 0.1) !important;
              color: #F0F6FC !important;
            }

            .nature-list-item:hover {
              background: rgba(255, 255, 255, 0.1) !important;
              border-color: rgba(16, 185, 129, 0.4) !important;
            }

            .nature-list-item .item-value {
              color: #FFFFFF !important;
            }
            
            .nature-list-item .item-unit {
              color: #94A3B8 !important;
            }
            
            .nature-list-item .item-sublabel {
              color: #94A3B8 !important;
            }

            /* Waveform Styles */
            .nature-waves {
              position: absolute;
              bottom: 0;
              left: 0;
              width: 100%;
              height: 80px;
              pointer-events: none;
              z-index: 0;
              opacity: 0.6;
            }

            .nature-wave {
              position: absolute;
              bottom: 0;
              left: 0;
              width: 200%;
              height: 100%;
              background-repeat: repeat-x;
              background-position: 0 bottom;
              transform: translate3d(0, 0, 0);
            }

            .nature-wave-1 {
              background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 80'%3E%3Cpath d='M0,40 C150,20 350,60 500,40 C650,20 850,60 1000,40 L1000,80 L0,80 Z' fill='%2310B981' fill-opacity='0.1'/%3E%3C/svg%3E");
              animation: waveMove 15s linear infinite;
              z-index: 3;
            }

            .nature-wave-2 {
              background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 80'%3E%3Cpath d='M0,40 C150,60 350,20 500,40 C650,60 850,20 1000,40 L1000,80 L0,80 Z' fill='%2334D399' fill-opacity='0.08'/%3E%3C/svg%3E");
              animation: waveMove 10s linear infinite;
              z-index: 2;
              bottom: 10px;
            }

            .nature-leaf-accent {
              position: absolute;
              bottom: -10px;
              left: -10px;
              font-size: 4rem;
              opacity: 0.15;
              pointer-events: none;
              z-index: 1;
              transform: rotate(-15deg);
              filter: saturate(0.5) contrast(1.2);
              transition: all 0.5s ease;
            }

            .nature-card-redesign:hover .nature-leaf-accent {
              opacity: 0.25;
              transform: rotate(0deg) scale(1.1);
            }

            /* Nature Pills */
            .nature-pill {
              background: #DCFCE7 !important;
              color: #065F46 !important;
              border: 1px solid rgba(5, 150, 105, 0.2) !important;
              padding: 0.4rem 1rem !important;
              border-radius: 99px !important;
              font-size: 0.65rem !important;
              font-weight: 900 !important;
              letter-spacing: 0.1em !important;
              display: flex !important;
              align-items: center !important;
              gap: 0.5rem !important;
            }

            /* Progress Bar Redesign */
            .nature-progress-track {
              height: 8px;
              background: rgba(0, 0, 0, 0.05);
              border-radius: 99px;
              overflow: hidden;
              margin: 1.5rem 0;
            }

            .nature-progress-fill {
              height: 100%;
              background: linear-gradient(90deg, #10B981 0%, #F59E0B 100%);
              border-radius: inherit;
              transition: width 1.5s cubic-bezier(0.16, 1, 0.3, 1);
            }

            /* Nature List Item - Premium Enhancement */
            .nature-list-item {
              background: rgba(255, 255, 255, 0.4) !important;
              backdrop-filter: blur(12px) !important;
              -webkit-backdrop-filter: blur(12px) !important;
              border: 1px solid rgba(255, 255, 255, 0.7) !important;
              border-radius: 24px !important;
              padding: 1.25rem 1.75rem !important;
              display: grid !important;
              grid-template-columns: auto 1fr auto !important;
              align-items: center !important;
              gap: 1.25rem !important;
              margin-bottom: 0.85rem !important;
              box-shadow: 
                0 4px 24px rgba(0, 0, 0, 0.02),
                inset 0 0 0 1px rgba(255, 255, 255, 0.4) !important;
              transition: all 0.4s var(--ease-spring) !important;
              position: relative !important;
              overflow: hidden !important;
            }

            .nature-list-item:hover {
              transform: translateY(-4px) scale(1.01) !important;
              background: rgba(255, 255, 255, 0.6) !important;
              box-shadow: 0 12px 32px rgba(16, 185, 129, 0.08) !important;
              border-color: rgba(16, 185, 129, 0.2) !important;
            }

            .nature-list-item::after {
              content: "";
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background: linear-gradient(135deg, rgba(255,255,255,0.4), transparent);
              pointer-events: none;
            }

            .nature-list-item .item-label-group {
              display: flex;
              flex-direction: column;
              gap: 0.1rem;
            }

            .nature-list-item .item-label {
              font-size: 0.75rem !important;
              font-weight: 800 !important;
              color: #10B981 !important;
              text-transform: uppercase !important;
              letter-spacing: 0.05em !important;
            }

            .nature-list-item .item-sublabel {
              font-size: 0.6rem !important;
              font-weight: 700 !important;
              color: #6B7280 !important;
              text-transform: uppercase !important;
              letter-spacing: 0.02em !important;
            }

            .nature-list-item .item-value-group {
              display: flex;
              align-items: baseline;
              gap: 0.25rem;
              justify-content: flex-end;
            }

            .nature-list-item .item-value {
              font-size: 1.4rem !important;
              font-weight: 900 !important;
              color: #1F2937 !important;
              letter-spacing: -0.02em !important;
            }

            .nature-list-item .item-unit {
              font-size: 0.75rem !important;
              font-weight: 800 !important;
              color: #6B7280 !important;
            }

            .sg-specs-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 1rem;
            }

            .nature-spec-card {
              background: rgba(255, 255, 255, 0.03) !important;
              backdrop-filter: blur(20px) !important;
              border: 1px solid rgba(16, 185, 129, 0.15) !important;
              border-radius: 28px !important;
              padding: 1.25rem !important;
              display: flex !important;
              align-items: center !important;
              gap: 1.25rem !important;
              transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1) !important;
              position: relative;
              overflow: hidden;
              margin: 0 !important;
            }

            .nature-spec-card:hover {
              transform: translateY(-5px) scale(1.02) !important;
              background: rgba(16, 185, 129, 0.08) !important;
              border-color: rgba(16, 185, 129, 0.4) !important;
              box-shadow: 0 15px 35px rgba(0, 0, 0, 0.3), 0 0 20px rgba(16, 185, 129, 0.1) !important;
            }

            .spec-icon-container {
              width: 44px;
              height: 44px;
              background: rgba(16, 185, 129, 0.1);
              border-radius: 14px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 1.25rem;
              position: relative;
              z-index: 1;
            }

            .spec-info {
              display: flex;
              flex-direction: column;
              gap: 0.1rem;
              z-index: 1;
            }

            .spec-label {
              font-size: 0.6rem !important;
              font-weight: 900 !important;
              color: #34D399 !important;
              text-transform: uppercase !important;
              letter-spacing: 0.12em !important;
              opacity: 0.9;
            }

            .spec-value-group {
              display: flex;
              align-items: baseline;
              gap: 0.3rem;
            }

            .spec-value {
              font-size: 1.4rem !important;
              font-weight: 900 !important;
              color: #FFFFFF !important;
              letter-spacing: -0.02em !important;
              text-shadow: 0 0 15px rgba(16, 185, 129, 0.3);
            }

            .spec-unit {
              font-size: 0.8rem !important;
              font-weight: 800 !important;
              color: #34D399 !important;
            }

            .sg-prohibited-section-luxe {
              background: rgba(239, 68, 68, 0.03) !important;
              backdrop-filter: blur(10px);
              border: 1px solid rgba(239, 68, 68, 0.15) !important;
              border-radius: 24px;
              padding: 1.5rem;
              position: relative;
              overflow: hidden;
              z-index: 1;
            }

            .sg-prohibited-section-luxe::before {
              content: "";
              position: absolute;
              top: 0; left: 0; width: 4px; height: 100%;
              background: #EF4444;
              opacity: 0.6;
            }

            .restriction-badge {
              background: rgba(239, 68, 68, 0.1) !important;
              color: #EF4444 !important;
              border: 1px solid rgba(239, 68, 68, 0.2) !important;
              padding: 0.5rem 1rem !important;
              border-radius: 99px !important;
              font-size: 0.6rem !important;
              font-weight: 900 !important;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              display: flex;
              align-items: center;
              gap: 0.5rem;
              transition: all 0.3s ease;
            }

            .restriction-badge:hover {
              background: rgba(239, 68, 68, 0.2) !important;
              transform: translateY(-2px);
            }

            .restriction-badge.highlight-restriction {
              border-color: #EF4444 !important;
              border-width: 2px !important;
              color: #EF4444 !important;
              font-weight: 950 !important;
              background: rgba(239, 68, 68, 0.15) !important;
              position: relative;
              z-index: 10;
            }
            .highlight-dot {
              position: absolute;
              top: -4px; right: -4px;
              width: 10px; height: 10px;
              background: #EF4444;
              border-radius: 50%;
              box-shadow: 0 0 15px #EF4444;
              animation: pulse-ring 1.5s infinite;
            }
            @keyframes pulse-ring {
              0% { transform: scale(0.8); opacity: 0.5; }
              100% { transform: scale(1.5); opacity: 0; }
            }

            .telemetry-bento-grid-enhanced {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 1rem;
            }
            
            .cyber-stats-grid {
              display: flex;
              flex-direction: column;
              gap: 0.6rem;
            }
            .cyber-box {
              padding: 0.75rem 1rem;
              background: rgba(var(--accent-rgb), 0.03);
              border: 1px solid rgba(var(--accent-rgb), 0.1);
              border-left: 3px solid var(--accent);
              border-radius: 4px 12px 12px 4px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
              backdrop-filter: blur(8px);
              position: relative;
              overflow: hidden;
            }
            .cyber-box::before {
              content: "";
              position: absolute;
              left: 0; top: 0; width: 100%; height: 100%;
              background: linear-gradient(90deg, rgba(var(--accent-rgb), 0.1), transparent);
              opacity: 0;
              transition: opacity 0.3s ease;
            }
            .cyber-box:hover {
              background: rgba(var(--accent-rgb), 0.06);
              border-color: rgba(var(--accent-rgb), 0.2);
              transform: translateX(6px);
              box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
            }

            .luxe-tag-cloud-enhanced {
              display: flex;
              flex-direction: column;
              gap: 0.5rem;
            }

            .nature-mini-bar {
              height: 4px;
              background: rgba(0, 0, 0, 0.2);
              border-radius: 99px;
              width: 80px;
              overflow: hidden;
            }

            .nature-mini-fill {
              height: 100%;
              background: #10B981;
              box-shadow: 0 0 12px rgba(16, 185, 129, 0.5);
              transition: width 1s ease-out;
            }

            :root[data-theme-mode="dark"] .nature-mini-bar {
              background: rgba(255, 255, 255, 0.05);
            }

            /* --- Theme Visibility Enhancements --- */

            /* Dark Mode Polish (Ensuring vividness) */
            :root[data-theme-mode="dark"] .nature-card-redesign {
              background: rgba(10, 15, 12, 0.92) !important;
              border-color: rgba(16, 185, 129, 0.3) !important;
              box-shadow: 0 25px 50px rgba(0, 0, 0, 0.6) !important;
            }

            :root[data-theme-mode="dark"] .nature-list-item {
              background: rgba(255, 255, 255, 0.04) !important;
              border-color: rgba(16, 185, 129, 0.15) !important;
              color: #34D399 !important;
              box-shadow: inset 0 0 20px rgba(16, 185, 129, 0.02) !important;
            }

            :root[data-theme-mode="dark"] .nature-list-item .item-label {
              color: #34D399 !important;
              text-shadow: 0 0 12px rgba(16, 185, 129, 0.3);
            }

            :root[data-theme-mode="dark"] .nature-list-item .item-value {
              color: #FFFFFF !important;
              text-shadow: 0 0 15px rgba(255, 255, 255, 0.2);
            }

            :root[data-theme-mode="dark"] .spec-value {
              color: #FFFFFF !important;
              text-shadow: 0 0 20px rgba(16, 185, 129, 0.5);
            }

            :root[data-theme-mode="dark"] .nature-pill {
              background: rgba(16, 185, 129, 0.15) !important;
              border-color: rgba(16, 185, 129, 0.3) !important;
              color: #34D399 !important;
            }

            /* Light Mode Overrides */
            :root[data-theme-mode="light"] .nature-card-redesign {
              background: rgba(255, 255, 255, 0.8) !important;
              backdrop-filter: blur(30px) saturate(150%) !important;
              border-color: rgba(16, 185, 129, 0.25) !important;
              box-shadow: 0 30px 60px rgba(0, 0, 0, 0.08), inset 0 0 0 1px rgba(255, 255, 255, 0.5) !important;
              color: #1F2937 !important;
            }

            :root[data-theme-mode="light"] .nature-card-redesign .sector-title {
              color: #065F46 !important;
              text-shadow: none;
            }

            :root[data-theme-mode="light"] .nature-card-redesign .premium-h3 {
              color: #064E3B !important;
            }

            :root[data-theme-mode="light"] .nature-card-redesign .premium-p {
              color: #4B5563 !important;
            }

            :root[data-theme-mode="light"] .nature-spec-card {
              background: rgba(255, 255, 255, 0.6) !important;
              border-color: rgba(16, 185, 129, 0.2) !important;
              box-shadow: 0 8px 24px rgba(16, 185, 129, 0.05) !important;
            }

            :root[data-theme-mode="light"] .nature-spec-card:hover {
              background: rgba(16, 185, 129, 0.08) !important;
              border-color: rgba(16, 185, 129, 0.4) !important;
            }

            :root[data-theme-mode="light"] .spec-value {
              color: #064E3B !important;
              text-shadow: none;
            }

            :root[data-theme-mode="light"] .spec-label,
            :root[data-theme-mode="light"] .spec-unit {
              color: #059669 !important;
              font-weight: 800;
            }

            :root[data-theme-mode="light"] .spec-icon-container {
              background: rgba(16, 185, 129, 0.08);
            }

            :root[data-theme-mode="light"] .nature-pill {
              background: #065F46 !important;
              color: #FFFFFF !important;
            }

            :root[data-theme-mode="light"] .nature-list-item {
              background: rgba(255, 255, 255, 0.8) !important;
              border-color: rgba(16, 185, 129, 0.15) !important;
              box-shadow: 0 4px 12px rgba(0,0,0,0.02) !important;
            }

            :root[data-theme-mode="light"] .nature-list-item .item-label {
              color: #059669 !important;
            }

            :root[data-theme-mode="light"] .nature-list-item .item-value {
              color: #1F2937 !important;
            }

            :root[data-theme-mode="light"] .nature-corner {
              border-color: #10B981 !important;
              opacity: 0.5;
            }

            :root[data-theme-mode="light"] .nature-waves {
              opacity: 0.7;
            }

            :root[data-theme-mode="light"] .nature-leaf-accent {
              opacity: 0.35;
              filter: saturate(1.5) brightness(0.8);
            }

            /* Light Mode Overrides for Admin Area */
            :root[data-theme-mode="light"] .admin-override-area {
              background: linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(245, 158, 11, 0.03) 100%) !important;
              border-style: solid !important;
              border-color: rgba(245, 158, 11, 0.3) !important;
              box-shadow: 0 10px 25px rgba(245, 158, 11, 0.05) !important;
            }
            
            :root[data-theme-mode="light"] .divider-text {
              color: #D97706 !important;
            }

            :root[data-theme-mode="light"] .admin-slide {
              background: rgba(245, 158, 11, 0.05) !important;
              border-color: rgba(245, 158, 11, 0.2) !important;
            }

            .retrieve-vault-core {
              background: #FFFFFF !important;
              border: 1px solid rgba(16, 185, 129, 0.1) !important;
              transition: all 0.3s ease;
            }

            :root[data-theme-mode="dark"] .retrieve-vault-core {
              background: rgba(255, 255, 255, 0.03) !important;
              border-color: rgba(16, 185, 129, 0.3) !important;
            }

            .luxe-slide-container {
              background: #FFFFFF !important;
              border: 1px solid rgba(16, 185, 129, 0.1) !important;
              border-radius: 99px;
              overflow: hidden;
            }

            :root[data-theme-mode="dark"] .luxe-slide-container {
              background: rgba(255, 255, 255, 0.05) !important;
              border-color: rgba(16, 185, 129, 0.3) !important;
            }

            .cyber-box:hover::before {
              opacity: 1;
            }
            .stat-label-luxe {
              font-size: 0.55rem;
              font-weight: 800;
              color: var(--text-muted);
              letter-spacing: 0.08em;
              z-index: 1;
            }
            .stat-value-luxe.mono {
              font-family: var(--font-mono);
              font-size: 0.75rem;
              font-weight: 800;
              color: var(--accent);
              z-index: 1;
              text-shadow: 0 0 10px rgba(var(--accent-rgb), 0.2);
            }

            
            .admin-override-area {
              margin-top: 2rem;
              padding: 1.5rem;
              background: linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, rgba(245, 158, 11, 0.02) 100%);
              border-radius: 24px;
              border: 1px dashed rgba(245, 158, 11, 0.4);
              box-shadow: inset 0 0 20px rgba(245, 158, 11, 0.03);
              position: relative;
              width: 100%;
            }
            .admin-override-area::before {
              content: "PROTECTED";
              position: absolute;
              top: -8px; right: 20px;
              background: #F59E0B;
              color: white;
              font-size: 0.5rem;
              font-weight: 900;
              padding: 2px 8px;
              border-radius: 4px;
              letter-spacing: 0.1em;
            }
            
            .admin-divider {
              display: flex;
              align-items: center;
              margin-bottom: 1rem;
              gap: 1rem;
            }
            .divider-text {
              font-size: 0.55rem;
              font-weight: 900;
              color: #F59E0B;
              letter-spacing: 0.15em;
              opacity: 0.8;
              white-space: nowrap;
            }
            .admin-divider::after {
              content: "";
              flex: 1;
              height: 1px;
              background: #F59E0B;
              opacity: 0.2;
            }
            .admin-slide {
              border-color: rgba(245, 158, 11, 0.3) !important;
              background: rgba(245, 158, 11, 0.03) !important;
            }
            .admin-slide .slider-thumb-premium {
              background: linear-gradient(180deg, #F59E0B, #D97706) !important;
              box-shadow: 0 8px 20px rgba(217, 119, 6, 0.35) !important;
            }
            .admin-slide .slider-label-text {
              color: #F59E0B !important;
              opacity: 0.8 !important;
              font-weight: 800;
            }
            
            .feature-header {
              text-align: center;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 0.5rem;
            }
            .live-status-indicator {
              display: flex;
              align-items: center;
              gap: 0.5rem;
              margin-bottom: 0.5rem;
            }
            .pulsing-dot {
              width: 6px; height: 6px; border-radius: 50%;
              background: #10B981;
              box-shadow: 0 0 12px #10B981;
              animation: pulseGlow 2s infinite;
            }
            @keyframes pulseGlow {
              0% { opacity: 0.4; transform: scale(0.8); }
              50% { opacity: 1; transform: scale(1.2); }
              100% { opacity: 0.4; transform: scale(0.8); }
            }
            .live-text {
              font-size: 0.55rem;
              font-weight: 900;
              color: var(--text-muted);
              letter-spacing: 0.15em;
            }
            .eyebrow-accent {
              font-size: 0.7rem;
              font-weight: 900;
              color: var(--accent);
              letter-spacing: 0.4em;
              text-transform: uppercase;
              opacity: 0.7;
              margin-bottom: 0.25rem;
            }
            .gradient-text-luxe {
              font-size: 2.25rem;
              font-weight: 900;
              letter-spacing: -0.03em;
              line-height: 1;
              margin: 0;
              background: linear-gradient(135deg, var(--text) 30%, var(--accent) 100%);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
            }
            .header-divider-luxe {
              width: 60px;
              height: 2px;
              background: var(--accent);
              margin: 1.5rem 0;
              border-radius: 99px;
              opacity: 0.3;
            }

            /* New Eco Elements */
            .eco-pulse-indicator {
              display: flex;
              align-items: center;
              gap: 0.75rem;
              background: rgba(16, 185, 129, 0.05);
              padding: 0.5rem 1.25rem;
              border-radius: 99px;
              border: 1px solid rgba(16, 185, 129, 0.2);
              margin-top: 1rem;
            }
            .eco-dot {
              width: 8px; height: 8px;
              background: #10B981;
              border-radius: 50%;
              box-shadow: 0 0 10px #10B981;
              animation: ecoPulse 2s infinite;
            }
            @keyframes ecoPulse {
              0% { transform: scale(1); opacity: 1; }
              50% { transform: scale(1.5); opacity: 0.5; }
              100% { transform: scale(1); opacity: 1; }
            }
            .eco-label {
              font-size: 0.6rem;
              font-weight: 900;
              color: #10B981;
              letter-spacing: 0.2em;
              text-transform: uppercase;
            }

            .floating-leaf-system {
              position: absolute;
              top: 0; left: 0; width: 100%; height: 100%;
              pointer-events: none;
              overflow: hidden;
              z-index: 0;
            }
            .leaf-particle {
              position: absolute;
              font-size: 1.2rem;
              opacity: 0.1;
              animation: leafDrift 12s linear infinite;
            }
            @keyframes leafDrift {
              0% { transform: translate(0, 0) rotate(0deg); opacity: 0; }
              10% { opacity: 0.15; }
              90% { opacity: 0.15; }
              100% { transform: translate(100px, 100px) rotate(360deg); opacity: 0; }
            }
            .heading-subtext {
              font-size: 1.1rem;
              font-weight: 500;
              color: var(--text-muted);
              max-width: 500px;
              margin: 0;
              line-height: 1.5;
            }

            .technical-corner-mark {
              position: absolute;
              width: 24px; height: 24px;
              border: 2px solid var(--accent);
              opacity: 0.3;
              pointer-events: none;
            }
            .technical-corner-mark.top-right { 
              top: 10px; right: 10px; 
              border-left: none; border-bottom: none; 
              border-radius: 0 8px 0 0;
            }
            .technical-corner-mark.bottom-left { 
              bottom: 10px; left: 10px; 
              border-right: none; border-top: none; 
              border-radius: 0 0 0 8px;
            }
            .technical-corner-mark::after {
              content: "";
              position: absolute;
              width: 4px; height: 4px;
              background: var(--accent);
              border-radius: 50%;
            }
            .technical-corner-mark.top-right::after { top: -3px; right: -3px; }
            .technical-corner-mark.bottom-left::after { bottom: -3px; left: -3px; }

            .glass-action-btn.lockdown { 
              border-color: rgba(239, 68, 68, 0.3); 
              color: #EF4444 !important; 
              background: rgba(239, 68, 68, 0.02);
            }
            
            @media (max-width: 800px) {
              .mission-control-layout {
                grid-template-columns: 1fr;
                gap: 2rem;
              }
              .status-display-sector {
                padding-bottom: 2rem;
                border-bottom: 1px solid var(--line);
              }
            }
          `}</style>

        <ScrollReveal direction="up" distance={40} delay={0.4} className="receiver-card-profile">
          <SurfaceCard className={`nature-card-redesign receiver-card ${!donation ? 'is-empty-luxe' : ''}`}>
            <div className="nature-waves">
              <div className="nature-wave nature-wave-1" />
              <div className="nature-wave nature-wave-2" />
            </div>
            <div className="nature-leaf-accent" style={{ bottom: '20px', left: '20px' }}>🍃</div>
            <div className="nature-leaf-accent" style={{ top: '20px', right: '20px', transform: 'rotate(180deg)' }}>🌱</div>
            
            <div className="card-header-mini">
              <p className="sector-title"><Box size={18} className="animate-pulse" />{t("publicFoodProfile")}</p>
              <div className="nature-pill"><Activity size={10} />SENSORY DATA</div>
            </div>
            <div className="profile-hero" style={{ position: 'relative', zIndex: 1, marginBottom: '1rem' }}>
              <h3 className="premium-h3" style={{ fontSize: '1.6rem', marginBottom: '0.4rem', color: '#FFFFFF' }}>
                {displayDonation?.categoryLabel ?? t("lockerReady")}
              </h3>
              <p className="premium-p" style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
                {displayDonation?.allergensNotes && displayDonation.allergensNotes !== 'none' 
                  ? displayDonation.allergensNotes 
                  : "Standard handling protocols active. No specific restrictions noted."}
              </p>
            </div>

            <div className="luxe-metric-grid" style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="nature-spec-card">
                <div className="spec-icon-container">
                  {displayDonation?.dietTag === 'veg' ? '🥗' : displayDonation?.dietTag === 'non_veg' ? '🥩' : '🍃'}
                </div>
                <div className="spec-info">
                  <span className="spec-label">{t("preference")}</span>
                  <span className="spec-value" style={{ fontSize: '1rem', textTransform: 'uppercase' }}>
                    {displayDonation?.dietTag?.replace("_", " ") ?? "-"}
                  </span>
                </div>
              </div>
              
              <div className="nature-spec-card">
                <div className="spec-icon-container">📅</div>
                <div className="spec-info">
                  <span className="spec-label">{t("registered")}</span>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="spec-value" style={{ fontSize: '0.9rem' }}>
                      {displayDonation ? formatDateTime(displayDonation.createdAt).split(',')[0] : "-"}
                    </span>
                    <span className="spec-unit" style={{ fontSize: '0.65rem', marginTop: '-2px', opacity: 0.8 }}>
                      {displayDonation ? formatDateTime(displayDonation.createdAt).split(',')[1] : ""}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </SurfaceCard>
        </ScrollReveal>

        <ScrollReveal direction="up" distance={40} delay={0.5} className="receiver-card-telemetry">
          <SurfaceCard className={`nature-card-redesign receiver-card ${!donation ? 'is-empty-luxe' : ''}`}>
            <div className="nature-waves">
              <div className="nature-wave nature-wave-1" />
              <div className="nature-wave nature-wave-2" />
            </div>
            <div className="nature-leaf-accent" style={{ right: '-10px', top: '15px', transform: 'rotate(15deg)' }}>🌿</div>
            <div className="nature-leaf-accent" style={{ left: '10px', bottom: '15px', transform: 'rotate(-45deg)' }}>🍃</div>
            
            <div className="card-header-mini">
              <p className="sector-title"><Activity size={18} className="animate-pulse" />{t("liveTelemetry")}</p>
              <div className="nature-pill"><Activity size={10} />ENVIRONMENTAL HARMONY</div>
            </div>
            
            <div className="telemetry-bento-grid-enhanced" style={{ position: 'relative', zIndex: 1 }}>
              <div className="nature-spec-card">
                <div className="spec-icon-container">🌡️</div>
                <div className="spec-info">
                  <span className="spec-label">{t("internalTemp")}</span>
                  <div className="spec-value-group">
                    <span className="spec-value">{telemetry.internalTempC}</span>
                    <span className="spec-unit">°C</span>
                  </div>
                </div>
              </div>
              <div className="nature-spec-card">
                <div className="spec-icon-container">💧</div>
                <div className="spec-info">
                  <span className="spec-label">{t("humidity")}</span>
                  <div className="spec-value-group">
                    <span className="spec-value">{telemetry.humidityPct}</span>
                    <span className="spec-unit">%</span>
                  </div>
                </div>
              </div>
              <div className="nature-spec-card">
                <div className="spec-icon-container">📊</div>
                <div className="spec-info">
                  <span className="spec-label">{t("pressure")}</span>
                  <div className="spec-value-group">
                    <span className="spec-value">{telemetry.pressureHpa}</span>
                    <span className="spec-unit">hPa</span>
                  </div>
                </div>
              </div>
              <div className="nature-spec-card">
                <div className="spec-icon-container">✨</div>
                <div className="spec-info">
                  <span className="spec-label">{t("airQuality")}</span>
                  <div className="spec-value-group">
                    <span className="spec-value">{telemetry.gasResistanceOhms}</span>
                    <span className="spec-unit">Ω</span>
                  </div>
                </div>
              </div>
            </div>
          </SurfaceCard>
        </ScrollReveal>

        <ScrollReveal direction="up" distance={40} delay={0.6} className="receiver-card-gas">
          <SurfaceCard className={`nature-card-redesign receiver-card ${!donation ? 'is-empty-luxe' : ''}`}>
            <div className="nature-waves">
              <div className="nature-wave nature-wave-1" />
              <div className="nature-wave nature-wave-2" />
            </div>
            <div className="nature-leaf-accent" style={{ top: '25px', left: '25px', transform: 'rotate(-45deg)' }}>🌿</div>
            <div className="nature-leaf-accent" style={{ bottom: '15px', right: '30px', transform: 'rotate(15deg)' }}>🍃</div>
            
            <div className="card-header-mini">
              <p className="sector-title"><Wind size={18} className="animate-pulse" />{t("gasProfile")}</p>
              <div className="nature-pill"><Activity size={10} />SENSORY ANALYZER</div>
            </div>
            
            <div className="gas-analysis-copy" style={{ position: 'relative', zIndex: 1 }}>
              <h3 className="premium-h3">Vapor Signature</h3>
              <p className="premium-p mb-1">Detected volatile organic compounds (VOCs)</p>
              
              <div className="nature-progress-track">
                <div className="nature-progress-fill" style={{ width: '65%' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '-1rem', marginBottom: '1.5rem', fontSize: '0.6rem', fontWeight: 900, color: '#065F46', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                <span>Neutral</span>
                <span>Active</span>
              </div>

              <div className="luxe-tag-cloud-enhanced">
                {telemetry.heuristicGasProfile.map((entry, idx) => (
                  <div key={entry} className="nature-list-item" style={{ animationDelay: `${idx * 0.1}s`, margin: 0, marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }} />
                      <span className="item-label" style={{ fontSize: '0.75rem' }}>{entry}</span>
                    </div>
                    <div className="nature-mini-bar">
                      <div className="nature-mini-fill" style={{ width: `${80 - (idx * 15)}%` }} />
                    </div>
                  </div>
                ))}
                {telemetry.heuristicGasProfile.length === 0 && (
                  <div className="nature-list-item muted">
                    <span className="item-label">NO ACTIVE SIGNATURES DETECTED</span>
                  </div>
                )}
              </div>
            </div>
          </SurfaceCard>
        </ScrollReveal>

        <ScrollReveal direction="up" distance={40} delay={0.7} className="receiver-card-actions">
          <SurfaceCard className="nature-card-redesign receiver-card sg-inline-card">
            <div className="nature-waves">
              <div className="nature-wave nature-wave-1" />
              <div className="nature-wave nature-wave-2" />
            </div>
            <div className="nature-leaf-accent" style={{ top: '30px', right: '30px', transform: 'rotate(90deg)' }}>🌱</div>
            <div className="nature-leaf-accent" style={{ bottom: '20px', left: '20px' }}>🌿</div>
            
            <div className="card-header-mini" style={{ marginBottom: '1.5rem' }}>
              <p className="sector-title"><Shield size={18} className="animate-pulse" />Safety & Capacity</p>
            </div>

            <div className="sg-specs-grid" style={{ marginBottom: '1.5rem', position: 'relative', zIndex: 1 }}>
              {[
                { label: "Max Weight", value: "12", unit: "kg", icon: "⚖️" },
                { label: "Volume", value: "20", unit: "L", icon: "📦" },
                { label: "Temp Zone", value: "2 – 8", unit: "°C", icon: "🌡️" },
                { label: "Humidity", value: "≤ 75", unit: "%", icon: "💧" }
              ].map(spec => (
                <div key={spec.label} className="nature-spec-card">
                  <div className="spec-icon-container">
                    {spec.icon}
                  </div>
                  <div className="spec-info">
                    <span className="spec-label">{spec.label}</span>
                    <div className="spec-value-group">
                      <span className="spec-value">{spec.value}</span>
                      <span className="spec-unit">{spec.unit}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="sg-prohibited-section-luxe">
              <p className="sector-title" style={{ color: '#EF4444', marginBottom: '1rem', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Ban size={14} className="animate-pulse" /> 
                <div className="flex flex-col">
                  <span style={{ lineHeight: '1' }}>RESTRICTIONS</span>
                  <span style={{ fontSize: '0.5rem', opacity: '0.6', marginTop: '0.2rem', letterSpacing: '0.05em' }}>AVOID AIRTIGHT SEALS FOR SENSOR ACCURACY</span>
                </div>
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.75rem' }}>
                {[
                  { label: "Raw Meat", icon: "🥩" },
                  { label: "Liquids", icon: "🥤" },
                  { label: "Airtight Seals", icon: "🌬️", highlight: true },
                  { label: "Allergens", icon: "🥜" }
                ].map(item => (
                  <motion.span 
                    key={item.label} 
                    className={`restriction-badge ${item.highlight ? 'highlight-restriction' : ''}`}
                    animate={item.highlight ? {
                      scale: [1, 1.1, 1],
                      backgroundColor: ['rgba(239, 68, 68, 0.1)', 'rgba(239, 68, 68, 0.25)', 'rgba(239, 68, 68, 0.1)'],
                      boxShadow: [
                        '0 0 0px rgba(239, 68, 68, 0)',
                        '0 0 20px rgba(239, 68, 68, 0.4)',
                        '0 0 0px rgba(239, 68, 68, 0)'
                      ]
                    } : {}}
                    transition={item.highlight ? {
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "easeInOut"
                    } : {}}
                  >
                    <span>{item.icon}</span>
                    {item.label}
                    {item.highlight && <span className="highlight-dot" />}
                  </motion.span>
                ))}
              </div>
            </div>
          </SurfaceCard>
        </ScrollReveal>

        <ScrollReveal direction="up" distance={40} delay={0.8} className="receiver-card-retrieve">
          <SurfaceCard className="nature-card-redesign receiver-card">
            <div className="nature-waves">
              <div className="nature-wave nature-wave-1" />
              <div className="nature-wave nature-wave-2" />
            </div>
            <div className="nature-leaf-accent" style={{ top: '20px', left: '40%', opacity: 0.15 }}>🌿</div>
            <div className="nature-leaf-accent" style={{ bottom: '20px', right: '20px' }}>🌱</div>
            
            <div className="card-header-mini">
              <p className="sector-title"><Lock size={18} className="animate-pulse" />{t("retrieveItem")}</p>
              {donation && <div className="nature-pill"><ShieldCheck size={10} />SIGNATURE MATCHED</div>}
            </div>

            <div className="retrieve-hero-luxe" style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', margin: '1rem 0', position: 'relative', zIndex: 1 }}>
              <div className="vault-visualizer" style={{ flexShrink: 0, width: '120px', height: '120px' }}>
                <div className="mechanical-rings" style={{ opacity: 0.1 }}>
                  <div className="ring ring-1" style={{ borderColor: '#065F46' }} />
                  <div className="ring ring-2" style={{ borderColor: '#065F46' }} />
                </div>
                <div className={`retrieve-vault-core ${donation && calculatedQualityScore >= 30 ? 'is-ready' : 'is-locked'}`}>
                  <div className="vault-box">
                    <span className="box-icon" style={{ fontSize: '2rem' }}>{calculatedQualityScore < 30 ? "⚠️" : "📦"}</span>
                  </div>
                </div>
              </div>

              <div className="retrieve-details-hub" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <h3 className="premium-h3" style={{ fontSize: '1.4rem' }}>
                  {donation 
                    ? (calculatedQualityScore < 30 ? "Access Restricted" : "Safe to Retrieve") 
                    : "Vault Standby"}
                </h3>
                <p className="premium-p" style={{ fontSize: '0.85rem' }}>
                  {donation 
                    ? (calculatedQualityScore < 30 
                        ? "Quality dropped below safety threshold." 
                        : "Item health verified. Please use the slider to open.") 
                    : t("receiverRule")}
                </p>
                
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <div className="nature-pill" style={{ fontSize: '0.55rem' }}><Activity size={10} />INDEX: {calculatedQualityScore}%</div>
                  <div className="nature-pill" style={{ fontSize: '0.55rem' }}><ShieldCheck size={10} />HEALTH: OPTIMAL</div>
                </div>
              </div>
            </div>

            {recommendedActions.length > 0 && (
              <div className="hrd-actions-block" style={{ marginBottom: '1.5rem', background: 'rgba(5, 150, 105, 0.05)', border: '1px solid rgba(5, 150, 105, 0.1)', borderLeft: '4px solid #10B981', position: 'relative', zIndex: 1 }}>
                <p className="sector-title" style={{ color: '#065F46', marginBottom: '0.75rem', fontSize: '0.55rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Zap size={12} className="animate-pulse" /> RECOMMENDED ACTIONS
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.4rem' }}>
                  {recommendedActions.map((action, idx) => (
                    <div key={action} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.75rem', color: '#064E3B', fontWeight: 700 }}>
                      <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#10B981' }} />
                      {action}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Retrieve Item — ENABLED when fresh & healthy, DISABLED when spoiled or faulted */}
            <div className="retrieve-action-area-luxe" style={{ position: 'relative', zIndex: 1, marginTop: '0' }}>
              <SlideConfirm 
                label={isSpoiled ? "⚠ Restricted — Food Spoiled" : isFaulted ? "⚠ Locker Faulted — Use Override" : (t("slideToRetrieve") || "Slide to Retrieve")}
                onConfirm={() => setShowFaceVerification(true)}
                disabled={!donation || isFaulted || isBusy || isSanitizing || isSpoiled}
                className="luxe-slide-container"
              />
            </div>

            {/* Admin Override — ENABLED when spoiled OR faulted (ensures there's always a way to get food out) */}
            <div className="admin-override-area" style={{ marginTop: '2rem', position: 'relative', zIndex: 1 }}>
              <div className="admin-divider">
                <span className="divider-text">ADMINISTRATIVE OVERRIDE</span>
              </div>
              <SlideConfirm 
                label={!donation ? "No Item in Vault" : (isSpoiled ? "Force Open Vault" : isFaulted ? "Force Open — Fault Override" : "Override Not Required")}
                onConfirm={handleAdminRetrieve}
                className="luxe-slide-container admin-slide"
                disabled={!donation || isBusy || isSanitizing || (!isSpoiled && !isFaulted)}
              />
            </div>
          </SurfaceCard>
        </ScrollReveal>

        <ScrollReveal direction="up" distance={40} delay={0.3} className="receiver-card-chart">
          <div className="bento-chart-container">
            {donation ? (
              <FoodHealthCardPremium 
                variant="compact"
                risk={100 - calculatedQualityScore}
                quality={calculatedQualityScore}
                temp={telemetry.internalTempC}
                shelfLifeHours={Math.round(displayHoursRemaining)}
                insight={calculatedQualityScore > 70 
                  ? "System Stable: Food freshness is currently peak. No biological hazards detected." 
                  : calculatedQualityScore > 30 
                  ? "Warning: Quality degradation detected. Consumption recommended within next 12 hours."
                  : "Critical Alert: Spoilage risk exceeds safety thresholds. Retrieval restricted."
                }
              />
            ) : (
              <div className="empty-chart-placeholder-luxe" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '350px', background: 'rgba(255,255,255,0.02)', borderRadius: '2rem', border: '1px dashed rgba(255,255,255,0.1)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: '48px', height: '48px', marginBottom: '1rem', color: 'var(--accent)', opacity: 0.5 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <p style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--text)', opacity: 0.8, margin: 0 }}>Awaiting Deposit</p>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', opacity: 0.7, marginTop: '0.5rem' }}>Analytics will appear once food is stored.</p>
              </div>
            )}
          </div>
        </ScrollReveal>

        <ScrollReveal direction="up" distance={40} delay={0.85} className="receiver-card-logs">
          <SurfaceCard className="nature-card-redesign receiver-card luxe-logs-card" style={{ height: '100%' }}>
            <div className="nature-waves">
              <div className="nature-wave nature-wave-1" />
              <div className="nature-wave nature-wave-2" />
            </div>
            <div className="nature-leaf-accent">📜</div>
            
            <div className="card-header-mini">
              <p className="sector-title"><Activity size={18} className="animate-pulse" />{t("logs")}</p>
              <div className="nature-pill"><Activity size={10} />SYSTEM EVENTS</div>
            </div>

            <div className="log-list-enhanced" style={{ position: 'relative', zIndex: 1, maxHeight: '450px', overflowY: 'auto', paddingRight: '0.5rem' }}>
              {state.logs.slice(0, 8).map((event, idx) => (
                <div key={event.id} className="nature-list-item" style={{ animationDelay: `${idx * 0.1}s`, margin: 0, marginBottom: '0.5rem', padding: '0.85rem 1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '32px', height: '32px', background: '#F0FDF4', borderRadius: '8px', display: 'grid', placeItems: 'center', fontSize: '1rem' }}>
                      {event.type.includes('fault') ? '⚠️' : '🔹'}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 900, color: '#064E3B' }}>{event.type.replace(/_/g, ' ').toUpperCase()}</span>
                      <span style={{ fontSize: '0.6rem', color: '#059669', fontWeight: 600 }}>{formatDateTime(event.createdAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SurfaceCard>
        </ScrollReveal>
      </section>
    </div>
  );
}
