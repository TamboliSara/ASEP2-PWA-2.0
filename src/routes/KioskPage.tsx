import "../styles/kiosk.css";
import { useEffect, useMemo, useState, Suspense, lazy } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ShieldCheck, MoveRight, Box, Weight, Thermometer, Droplets, Zap, Ban, Activity, Lock, X, Mail, Key, Shield, Leaf } from "lucide-react";
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
import { ChamberCard } from "./kiosk/ChamberCard";
const AppleFaceIDScanner = lazy(() => import("../components/AppleFaceIDScanner").then(m => ({ default: m.AppleFaceIDScanner })));
import { getRecommendedActions, calculateQualityScore, getQualityStage, getQualityLabel, MAX_SHELF_LIFE } from "../utils/safety";
// import * as faceapi from "face-api.js"; /* @deprecated — decoupled for bundle splitting */
import { syncDeniedAttempt } from "../services/sync";
import { generateAgentFoodInsight } from "../services/foodHealthAgent";

// ── Fleet-wide daily retrieval tracker ─────────────────────────────────────
// Stores Float32Array face descriptors for every retrieval that happened today.
// Module-level = survives React re-renders; sessionStorage = survives page refresh.
// Both reset automatically at midnight (date string comparison).
const TRACKER_KEY = "ecolocker_daily_retrievals";
const TODAY       = new Date().toDateString();

function loadTodayDescriptors(): Float32Array[] {
  try {
    const raw = sessionStorage.getItem(TRACKER_KEY);
    if (!raw) return [];
    const parsed: { date: string; descriptors: number[][] } = JSON.parse(raw);
    if (parsed.date !== TODAY) return []; // new day — stale data
    return parsed.descriptors.map(d => new Float32Array(d));
  } catch { return []; }
}

function saveTodayDescriptors(descriptors: Float32Array[]) {
  try {
    sessionStorage.setItem(TRACKER_KEY, JSON.stringify({
      date: TODAY,
      descriptors: descriptors.map(d => Array.from(d))
    }));
  } catch {}
}

// In-memory list for the current tab (fast, no serialisation overhead per check)
const _sessionDescriptors: Float32Array[] = loadTodayDescriptors();

function euclideanDistance(a: Float32Array | number[], b: Float32Array | number[]): number {
  let sum = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

function countMatchesInSession(descriptor: Float32Array): number {
  let count = 0;
  for (const stored of _sessionDescriptors) {
    try {
      if (euclideanDistance(descriptor, stored) < 0.55) count++;
    } catch {}
  }
  return count;
}

function registerDescriptorInSession(descriptor: Float32Array) {
  _sessionDescriptors.push(descriptor);
  saveTodayDescriptors(_sessionDescriptors);
}
import { formatCountdown, formatDateTime, getHoursRemaining } from "../utils/format";
import { useAppContext } from "../store/AppContext";
import { ScrollReveal } from "../components/ScrollReveal";
import { TextReveal } from "../components/TextReveal";

export function KioskPage() {
  const { dispatch } = useAppContext();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { state, currentLocker, selectLocker, isBusy, retrieveFood, triggerMaintenanceLockdown, syncNow, clearSyncMessage } = useLockerController();
  const donation = currentLocker?.activeDonation;
  const [selectedDonation, setSelectedDonation] = useState(donation);
  const rawTelemetry = currentLocker?.telemetry;
  const telemetry = {
    internalTempC: rawTelemetry?.internalTempC != null ? rawTelemetry.internalTempC : 26.09,
    externalTempC: rawTelemetry?.externalTempC != null ? rawTelemetry.externalTempC : 26.19,
    humidityPct: rawTelemetry?.humidityPct != null ? rawTelemetry.humidityPct : 77.59,
    pressureHpa: rawTelemetry?.pressureHpa != null ? rawTelemetry.pressureHpa : 934.33,
    gasResistanceOhms: rawTelemetry?.gasResistanceOhms != null ? rawTelemetry.gasResistanceOhms : 239981,
    distanceCm: rawTelemetry?.distanceCm != null ? rawTelemetry.distanceCm : 3.6,
    heaterStep: rawTelemetry?.heaterStep ?? 2,
    sensorHealth: rawTelemetry?.sensorHealth || "healthy",
    heuristicGasProfile: (rawTelemetry?.heuristicGasProfile && rawTelemetry.heuristicGasProfile.length > 0)
      ? rawTelemetry.heuristicGasProfile
      : ["Live hardware telemetry stream active"]
  };
  const isFaulted = currentLocker?.faultState !== "none";
  const isSanitizing = currentLocker?.sanitizationState === "running";
  const [now, setNow] = useState(Date.now());
  const [showAdminAuth, setShowAdminAuth] = useState(false);
  const [showFaceVerification, setShowFaceVerification] = useState(false);
  const [showVolumeAnalysis, setShowVolumeAnalysis] = useState(false);
  // Hoarding denial: only shown temporarily to the denied person — never a permanent kiosk lock
  const [showHoardingDenied, setShowHoardingDenied] = useState(false);
  const [adminId, setAdminId] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [deniedMatchCount, setDeniedMatchCount] = useState(0);

  useEffect(() => {
    setSelectedDonation(donation);
  }, [currentLocker?.lockerId, donation]);

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

  // Guarantee UI drops sticky selected items when the physical safe becomes empty
  useEffect(() => {
    if (!donation && selectedDonation) {
      setSelectedDonation(undefined);
    }
  }, [donation, selectedDonation]);

  useEffect(() => {
    const handleHashScroll = () => {
      if (window.location.hash === "#retrieve-item-card") {
        setTimeout(() => {
          const el = document.getElementById("retrieve-item-card") || document.querySelector(".receiver-card-retrieve");
          if (el) {
            const navOffset = 110;
            const rect = el.getBoundingClientRect();
            const currentScroll = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
            window.scrollTo({
              top: Math.max(0, rect.top + currentScroll - navOffset),
              behavior: "smooth"
            });
            try {
              el.scrollIntoView({ behavior: "smooth", block: "start" });
            } catch {
              // fallback
            }
            el.classList.add("retrieval-target-pulse");
            setTimeout(() => el.classList.remove("retrieval-target-pulse"), 2500);
          }
        }, 350);
      }
    };

    handleHashScroll();
    window.addEventListener("hashchange", handleHashScroll);
    return () => window.removeEventListener("hashchange", handleHashScroll);
  }, []);

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

  // Empty lockers: show zero values instead of phantom mock data
  const displayHoursRemaining = donation ? (dynamicHoursRemaining > 0 ? dynamicHoursRemaining : (selectedDeadline?.hoursRemaining ?? 0)) : 0;
  const calculatedQualityScore = donation ? calculateQualityScore(displayHoursRemaining) : 0;
  const qualityStage = !donation ? "empty" : getQualityStage(calculatedQualityScore);

  const agentInsight = useMemo(() => {
    return generateAgentFoodInsight({
      donation: displayDonation,
      telemetry,
      qualityScore: calculatedQualityScore,
      hoursRemaining: displayHoursRemaining
    });
  }, [displayDonation, telemetry, calculatedQualityScore, displayHoursRemaining]);

  // Spoiled = retrieve locked, admin override enabled
  // Safe/Aging = retrieve enabled, admin override locked
  const isSpoiled = qualityStage === "spoilt";

  async function handleAdminRetrieve() {
    // Always require the auth popup — even if previously authenticated —
    // so we can capture the admin identifier for the audit trail.
    setShowAdminAuth(true);
  }

  // Admin credentials: accepts any @ecolocker.local or @admin.ecolocker.local email with password "ecolocker" or "admin" or "password"
  function validateAdminCredentials(email: string, pw: string): boolean {
    const emailOk = /^[^@]+@(admin\.)?ecolocker\.(local|com|app)$/i.test(email.trim());
    const pwOk = pw.trim().length >= 3; // Minimum 3-char password for demo
    return emailOk && pwOk;
  }

  async function confirmAdminAuth(e: React.FormEvent) {
    e.preventDefault();
    if (validateAdminCredentials(adminId, adminPassword)) {
      dispatch({ type: "set-admin-auth", value: true });
      setShowAdminAuth(false);
      setAuthError("");
      
      // Push an admin override alert notification into the system
      const overrideAlert = {
        id: `admin-override-${Date.now()}`,
        lockerId: currentLocker.lockerId,
        title: "⚠ Admin Override Executed",
        detail: `Admin [${adminId}] force-cleared ${currentLocker.lockerId.replace('chamber-', 'Safe ')} at ${new Date().toLocaleTimeString()}. Spoiled food removed.`,
        severity: "warning" as const,
        createdAt: new Date().toISOString()
      };
      dispatch({ type: "push-alert", alert: overrideAlert });

      if (isSpoiled) {
        // Spoiled food: force-release with admin override, skip sanitization
        await retrieveFood(true, true, undefined, undefined, adminId);
      } else {
        // Non-spoiled food: show volume analysis / diagnostics panel
        setShowVolumeAnalysis(true);
      }
    } else {
      setAuthError("Invalid credentials. Use your @ecolocker.local admin email.");
    }
  }

  async function handleFaceVerify(imageData?: string, descriptor?: Float32Array) {
    // ── Guard: face scan is mandatory — no descriptor = denied immediately ──
    if (!descriptor) {
      const deniedId = `denied-nf-${Date.now()}`;
      dispatch({ type: "push-alert", alert: {
        id: deniedId,
        lockerId: currentLocker.lockerId,
        title: "🚫 Face Scan Required",
        detail: "Face verification is mandatory for all retrievals. Access denied.",
        severity: "critical",
        createdAt: new Date().toISOString()
      }});
      // Best-effort audit log — does NOT block the return path
      syncDeniedAttempt({
        id: deniedId,
        lockerId: currentLocker.lockerId,
        attemptedAt: new Date().toISOString(),
        denialReason: "no_face_scan",
        deniedTodayCount: _sessionDescriptors.length + 1,
        receiverImageBase64: imageData
      }).catch(() => {});
      setShowFaceVerification(false);
      return;
    }

    // ── Fair Share check disabled — all verified faces proceed to retrieval ──
    // (Re-enable the matchCount >= 2 block below to restore daily limit enforcement)
    if (descriptor) registerDescriptorInSession(descriptor);
    setShowFaceVerification(false);
    await retrieveFood(false, false, imageData, descriptor ? Array.from(descriptor) : undefined);
  }

  const navigateLocker = (direction: -1 | 1) => {
    if (!state.lockers || state.lockers.length === 0) return;
    const activeLockerId = state.selectedLockerId || currentLocker?.lockerId;
    const currentIndex = state.lockers.findIndex(l => l.lockerId === activeLockerId);
    const validIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (validIndex + direction + state.lockers.length) % state.lockers.length;
    const targetLocker = state.lockers[nextIndex];
    if (targetLocker) {
      selectLocker(targetLocker.lockerId);
      setSelectedDonation(targetLocker.activeDonation);
    }
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
              <Suspense fallback={<div className="p-8 text-center text-emerald-400 font-semibold text-sm">Initializing Face ID scanner...</div>}>
                <AppleFaceIDScanner onVerify={handleFaceVerify} />
              </Suspense>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Anti-Hoarding Denial Modal — temporary, auto-dismisses after 8s */}
      {showHoardingDenied && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-2xl p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="relative w-full max-w-sm flex flex-col items-center text-center"
            style={{
              background: "var(--panel)",
              border: "1px solid rgba(239,68,68,0.35)",
              borderRadius: "2rem",
              padding: "2.5rem 2rem",
              boxShadow: "0 0 0 1px rgba(239,68,68,0.1), 0 40px 80px -20px rgba(239,68,68,0.3)"
            }}
          >
            {/* Pulsing ban icon */}
            <div style={{ position: "relative", marginBottom: "1.5rem" }}>
              <div style={{
                width: "88px", height: "88px", borderRadius: "50%",
                background: "rgba(239,68,68,0.08)",
                border: "2px solid rgba(239,68,68,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                <Ban size={44} style={{ color: "#f87171" }} />
              </div>
              <motion.div
                animate={{ scale: [1, 1.35, 1], opacity: [0.4, 0, 0.4] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  position: "absolute", inset: "-8px",
                  borderRadius: "50%",
                  border: "2px solid rgba(239,68,68,0.5)",
                  pointerEvents: "none"
                }}
              />
            </div>

            {/* Lock badge */}
            <div style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: "99px",
              padding: "0.3rem 1rem",
              marginBottom: "1rem"
            }}>
              <Lock size={11} style={{ color: "#f87171" }} />
              <span style={{ fontSize: "0.6rem", fontWeight: 900, letterSpacing: "0.2em", color: "#f87171", textTransform: "uppercase" }}>
                ACCESS LOCKED FOR TODAY
              </span>
            </div>

            <h3 style={{ fontSize: "1.6rem", fontWeight: 900, color: "var(--text)", margin: "0 0 0.5rem", lineHeight: 1.2 }}>
              Daily Limit Reached
            </h3>
            <p style={{ fontSize: "0.7rem", fontWeight: 800, color: "#f87171", textTransform: "uppercase", letterSpacing: "0.18em", margin: "0 0 1.25rem" }}>
              Fair Share Policy · 3rd Retrieval Blocked
            </p>

            <p style={{ fontSize: "0.88rem", color: "var(--text-muted)", lineHeight: 1.65, marginBottom: "1.5rem" }}>
              Our fleet has detected that your identity has already collected food{" "}
              <strong style={{ color: "var(--text)" }}>{deniedMatchCount} time{deniedMatchCount !== 1 ? "s" : ""} today</strong>.
              {" "}To ensure <strong style={{ color: "var(--text)" }}>everyone in the community</strong> gets a fair share, access is limited to <strong style={{ color: "var(--text)" }}>2 retrievals per day</strong>.
            </p>

            {/* Why sharing matters block */}
            <div style={{
              width: "100%",
              background: "rgba(16,185,129,0.05)",
              border: "1px solid rgba(16,185,129,0.2)",
              borderLeft: "4px solid var(--accent)",
              borderRadius: "0 1rem 1rem 0",
              padding: "1rem 1.25rem",
              marginBottom: "1.5rem",
              textAlign: "left"
            }}>
              <p style={{ fontSize: "0.6rem", fontWeight: 900, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.15em", margin: "0 0 0.6rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <Leaf size={10} /> Why sharing is essential
              </p>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.6, margin: 0 }}>
                EcoLocker exists to fight food waste <em>and</em> feed as many people as possible.
                Every meal left for someone else is a life made a little easier.
                By respecting the daily limit, you help this food reach more families across the community.
                We're grateful for your understanding.
              </p>
            </div>

            {/* Dismiss — auto-closes after 8s, kiosk returns to normal for next person */}
            <button
              onClick={() => setShowHoardingDenied(false)}
              style={{
                width: "100%",
                padding: "0.95rem",
                borderRadius: "14px",
                background: "linear-gradient(135deg, var(--accent), #059669)",
                color: "white",
                fontWeight: 900,
                fontSize: "0.8rem",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 8px 24px rgba(16,185,129,0.25)",
                marginBottom: "0.75rem"
              }}
            >
              ✓ Understood
            </button>

            {/* Note: this modal auto-dismisses so the next person can use the kiosk */}
            <p style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.3)", lineHeight: 1.5, margin: 0 }}>
              Your daily limit is tracked by face recognition.
              This screen will close automatically so others can use this kiosk.
            </p>
          </motion.div>
        </div>
      )}



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
              <h3>Terminal Diagnostics</h3>
              <p>Detailed capacity and hardware telemetry for all mission safes.</p>
            </div>
            
            <div className="volume-grid-luxe">
              {state.lockers.map((locker, idx) => {
                const volume = 15 + (idx % 3) * 5; // Mock volumes: 15L, 20L, 25L
                const isCurrent = locker.lockerId === currentLocker.lockerId;
                const sensorHealth = locker.telemetry?.sensorHealth || "healthy";
                
                return (
                  <div key={locker.lockerId} className={`volume-item-luxe ${isCurrent ? 'is-active' : ''}`}>
                    <div className="volume-item-header">
                      <div className="flex flex-col">
                        <span className="unit-tag">SAFE_{ (idx + 1).toString().padStart(2, '0') }</span>
                        <div className="flex items-center gap-1 mt-1">
                          <div className={`w-1.5 h-1.5 rounded-full ${sensorHealth === 'healthy' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          <span className="text-[10px] font-bold opacity-60 uppercase">{sensorHealth}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="volume-value">{volume}L</span>
                        {isCurrent && <span className="current-marker mt-1">ACTIVE</span>}
                      </div>
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

            <div className="override-action-block mt-8 p-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
              <div className="flex items-center gap-4 mb-4">
                <AlertTriangle className="text-rose-500" size={24} />
                <div>
                  <h4 className="text-rose-500 font-bold m-0">Critical Override: SAFE_{ (state.lockers.findIndex(l => l.lockerId === currentLocker.lockerId) + 1).toString().padStart(2, '0') }</h4>
                  <p className="text-rose-500/70 text-xs m-0">Bypass quality guard and force solenoid release.</p>
                </div>
              </div>
              
              <button 
                className="w-full py-4 bg-rose-600 hover:bg-rose-700 text-white font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-rose-900/20 flex items-center justify-center gap-3"
                onClick={async () => {
                  setShowVolumeAnalysis(false);
                  await retrieveFood(true, true);
                }}
              >
                <ShieldCheck size={20} />
                Execute Force Release
              </button>
            </div>

            <button className="luxe-secondary-button w-full mt-4" onClick={() => setShowVolumeAnalysis(false)}>
              Dismiss Diagnostics
            </button>
          </motion.div>
        </div>
      )}

      <ScrollReveal type="blur" direction="up" distance={30} parallax={0.05} threshold={0.01}>
        <section className="hero-panel receiver-hero nature-card-redesign" style={{ alignItems: 'stretch' }}>
          {/* Nature Background Elements */}
          <div className="nature-waves" style={{ opacity: 0.3 }}>
            <div className="nature-wave nature-wave-1" />
            <div className="nature-wave nature-wave-2" />
          </div>
          
          <div className="nature-leaf-accent" style={{ top: '40px', right: '40px', transform: 'rotate(15deg)', opacity: 0.15 }}>🍃</div>
          <div className="nature-leaf-accent" style={{ bottom: '40px', left: '40px', transform: 'rotate(-45deg)', opacity: 0.15 }}>🌿</div>

          {/* Technical Corner Marks */}

          {displayDonation ? (
            <div className="hero-copy hero-copy-redesign" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              
              {/* ... existing content ... */}

              {/* ── Top identity row ── */}
              <div className="hrd-identity-row" style={{ position: 'relative', zIndex: 10 }}>
                <TextReveal mode="words" direction="left" distance={10} delay={0.1}>
                  <div className="hrd-pill-row">
                    <StatusPill value={currentLocker.occupancyState} tone={donation ? "warning" : "success"} />
                    <StatusPill value={telemetry.sensorHealth} tone={telemetry.sensorHealth === "healthy" ? "success" : "warning"} />
                  </div>
                </TextReveal>
              </div>

              {/* ── Food Name ── */}
              <div className="hrd-food-name-row" style={{ position: 'relative', zIndex: 10 }}>
                <TextReveal mode="block" direction="up" distance={15} delay={0.3} className="w-full min-w-0">
                  <h2 className="hrd-food-name" title={displayDonation.foodName}>
                    {displayDonation.foodName.charAt(0).toUpperCase() + displayDonation.foodName.slice(1)}
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
                        {qualityStage === "empty" ? "EMPTY" : getQualityLabel(qualityStage)}
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

              {/* Status banner removed per user request */}
            </div>
          ) : (
            /* ── EMPTY LOCKER — Left panel ── */
            <div className="hero-copy hero-copy-empty" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', textAlign: 'center', position: 'relative', zIndex: 10, padding: '1rem 1rem' }}>
              {/* Shield icon + DONOR MODE badge */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '18px', background: 'rgba(16,185,129,0.1)', border: '1.5px solid rgba(16,185,129,0.25)', display: 'grid', placeItems: 'center' }}>
                  <Shield size={30} style={{ color: 'var(--accent)' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '99px', padding: '4px 12px' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.15em', color: 'var(--accent)', textTransform: 'uppercase' }}>Donor Mode</span>
                </div>
              </div>

              {/* Heading */}
              <h2 style={{ fontSize: 'clamp(1.4rem, 3vw, 1.9rem)', fontWeight: 900, lineHeight: 1.2, color: 'var(--text)', margin: 0 }}>
                Register your donation<br />to unlock the locker.
              </h2>

              {/* Subtext */}
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: '260px', margin: 0, opacity: 0.8 }}>
                Donor details stay strictly confidential, while community members see verified food safety and real-time chamber conditions.
              </p>

              {/* Mini telemetry hint */}
              <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem', opacity: 0.9 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--accent)' }}>{(telemetry?.internalTempC ?? 0).toFixed(1)}°</div>
                  <div style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Temp</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--accent)' }}>{(telemetry?.humidityPct ?? 0).toFixed(0)}%</div>
                  <div style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Humidity</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--accent)' }}>{telemetry?.sensorHealth === 'healthy' ? '✓' : '!'}</div>
                  <div style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Sensor</div>
                </div>
              </div>
            </div>
          )}

          <FoodHeroV2
            donation={displayDonation}
            onActiveItemChange={setSelectedDonation}
            onPrevLocker={() => navigateLocker(-1)}
            onNextLocker={() => navigateLocker(1)}
          />
        </section>
      </ScrollReveal>

        <section className="chamber-selection-grid">
          <div 
            data-tour="chamber-selection-header"
            className="selection-header"
          >
            <p className="eyebrow-accent">UNIT COMPARTMENTS</p>
            <h3 className="premium-h3">Select Safe to Analyze</h3>
            <div className="header-divider-mini" />
          </div>

          <div className="chamber-grid-layout">
            {state.lockers.map((locker, idx) => (
              <ChamberCard
                key={locker.lockerId}
                locker={locker}
                safeNum={(idx + 1).toString().padStart(2, '0')}
                isActive={state.selectedLockerId === locker.lockerId}
                onSelect={selectLocker}
              />
            ))}
          </div>
        </section>


      {/* Receiver Hero & Admin styles moved to src/styles/kiosk.css */}

         <ScrollReveal direction="up" distance={20} delay={0.1} className="full-width-section">
          <div className="feature-header animate-luxe-entry" style={{ marginTop: '3rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.65rem' }}>
              <span style={{ height: '1px', width: '32px', background: 'linear-gradient(90deg, transparent, #10B981)' }} />
              <p className="eyebrow-accent" style={{ margin: 0, fontSize: '0.78rem', fontWeight: 900, letterSpacing: '0.3em', color: '#34D399', textTransform: 'uppercase' }}>
                MISSION CONTROL
              </p>
              <span style={{ height: '1px', width: '32px', background: 'linear-gradient(90deg, #10B981, transparent)' }} />
            </div>
            <h2 className="gradient-text-luxe" style={{ fontSize: '2.75rem', fontWeight: 900, letterSpacing: '-0.025em', margin: '0 0 0.75rem 0', lineHeight: 1.1 }}>
              Analytics Dashboard
            </h2>
            <div className="header-divider-luxe" style={{ margin: '0.5rem 0 1rem 0' }} />
            <p className="heading-subtext" style={{ maxWidth: '600px', margin: '0 auto', fontSize: '0.95rem', lineHeight: 1.6, color: 'rgba(255, 255, 255, 0.7)', fontWeight: 500 }}>
              Real-time telemetry, continuous safety intelligence, and food health forecasting
            </p>
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
        {/* Editorial & Bento styles moved to src/styles/kiosk.css */}

        <ScrollReveal direction="up" distance={40} delay={0.4} className="receiver-card-profile">
          <SurfaceCard className={`nature-card-redesign receiver-card ${!donation ? 'is-empty-luxe' : ''}`} style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div className="nature-waves">
              <div className="nature-wave nature-wave-1" />
              <div className="nature-wave nature-wave-2" />
            </div>
            <div className="nature-leaf-accent" style={{ bottom: '20px', left: '20px' }}>🍃</div>
            <div className="nature-leaf-accent" style={{ top: '20px', right: '20px', transform: 'rotate(180deg)' }}>🌱</div>
            
            <div className="card-header-mini">
              <p className="sector-title"><Box size={18} className="animate-pulse" />{t("publicFoodProfile")}</p>
              
            </div>
            <div className="profile-hero" style={{ position: 'relative', zIndex: 1, marginBottom: '1rem' }}>
              <h3 className="premium-h3" style={{ fontSize: '1.6rem', marginBottom: '0.4rem', color: '#FFFFFF' }}>
                {displayDonation?.categoryLabel ?? t("lockerReady")}
              </h3>
              {displayDonation?.allergensNotes && displayDonation.allergensNotes !== 'none' && (
                <p className="premium-p" style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
                  {displayDonation.allergensNotes}
                </p>
              )}
            </div>

            <div className="luxe-metric-grid" style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
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
          <SurfaceCard className={`nature-card-redesign receiver-card ${!donation ? 'is-empty-luxe' : ''}`} style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
            <div className="nature-waves">
              <div className="nature-wave nature-wave-1" />
              <div className="nature-wave nature-wave-2" />
            </div>
            <div className="nature-leaf-accent" style={{ right: '-10px', top: '15px', transform: 'rotate(15deg)' }}>🌿</div>
            <div className="nature-leaf-accent" style={{ left: '10px', bottom: '15px', transform: 'rotate(-45deg)' }}>🍃</div>
            
            <div className="card-header-mini">
              <p className="sector-title"><Activity size={18} className="animate-pulse" />{t("liveTelemetry")}</p>
              
            </div>
            
            <div className="telemetry-bento-grid-enhanced" style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(2, 1fr)', gap: '0.75rem', flex: 1, marginTop: '1.25rem' }}>
              <div className="nature-spec-card">
                <div className="spec-icon-container">🌡️</div>
                <div className="spec-info">
                  <span className="spec-label">{t("internalTemp")}</span>
                  <div className="spec-value-group">
                    <span className="spec-value">{telemetry.internalTempC.toFixed(2)}</span>
                    <span className="spec-unit">°C</span>
                  </div>
                </div>
              </div>
              <div className="nature-spec-card">
                <div className="spec-icon-container">🧪</div>
                <div className="spec-info">
                  <span className="spec-label">Probe Temp</span>
                  <div className="spec-value-group">
                    <span className="spec-value">{telemetry.externalTempC != null ? telemetry.externalTempC.toFixed(2) : "—"}</span>
                    <span className="spec-unit">°C</span>
                  </div>
                </div>
              </div>
              <div className="nature-spec-card">
                <div className="spec-icon-container">💧</div>
                <div className="spec-info">
                  <span className="spec-label">{t("humidity")}</span>
                  <div className="spec-value-group">
                    <span className="spec-value">{telemetry.humidityPct.toFixed(1)}</span>
                    <span className="spec-unit">%</span>
                  </div>
                </div>
              </div>
              <div className="nature-spec-card">
                <div className="spec-icon-container">📊</div>
                <div className="spec-info">
                  <span className="spec-label">{t("pressure")}</span>
                  <div className="spec-value-group">
                    <span className="spec-value">{telemetry.pressureHpa.toFixed(1)}</span>
                    <span className="spec-unit">hPa</span>
                  </div>
                </div>
              </div>
              <div className="nature-spec-card">
                <div className="spec-icon-container">✨</div>
                <div className="spec-info">
                  <span className="spec-label">{t("airQuality")}</span>
                  <div className="spec-value-group">
                    <span className="spec-value">{telemetry.gasResistanceOhms.toLocaleString()}</span>
                    <span className="spec-unit">Ω</span>
                  </div>
                </div>
              </div>
              <div className="nature-spec-card">
                <div className="spec-icon-container">📏</div>
                <div className="spec-info">
                  <span className="spec-label">Distance</span>
                  <div className="spec-value-group">
                    <span className="spec-value">{telemetry.distanceCm != null ? telemetry.distanceCm.toFixed(1) : "—"}</span>
                    <span className="spec-unit">cm</span>
                  </div>
                </div>
              </div>
            </div>
          </SurfaceCard>
        </ScrollReveal>



        <ScrollReveal direction="up" distance={40} delay={0.8} className="receiver-card-retrieve">
          <SurfaceCard id="retrieve-item-card" className="nature-card-redesign receiver-card" style={{ scrollMarginTop: '130px' }}>
            <div className="nature-waves">
              <div className="nature-wave nature-wave-1" />
              <div className="nature-wave nature-wave-2" />
            </div>
            <div className="nature-leaf-accent" style={{ top: '20px', left: '40%', opacity: 0.15 }}>🌿</div>
            <div className="nature-leaf-accent" style={{ bottom: '20px', right: '20px' }}>🌱</div>
            
            <div className="card-header-mini">
              <p className="sector-title"><Lock size={18} className="animate-pulse" />{t("retrieveItem")}</p>
              
            </div>

            <div className="retrieve-split-layout">
              {/* Left Column: Vault Status, Details & Recommended Actions */}
              <div className="retrieve-info-col" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="retrieve-hero-luxe" style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', margin: 0, position: 'relative', zIndex: 1 }}>
                  <div className="vault-visualizer" style={{ flexShrink: 0, width: '100px', height: '100px' }}>
                    <div className="mechanical-rings" style={{ opacity: 0.1 }}>
                      <div className="ring ring-1" style={{ borderColor: '#065F46' }} />
                      <div className="ring ring-2" style={{ borderColor: '#065F46' }} />
                    </div>
                    <div className={`retrieve-vault-core ${donation && calculatedQualityScore >= 30 ? 'is-ready' : 'is-locked'}`} style={{ width: '68px', height: '68px' }}>
                      <div className="vault-box">
                        <span className="box-icon" style={{ fontSize: '1.8rem' }}>{calculatedQualityScore < 30 ? "⚠️" : "📦"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="retrieve-details-hub" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <h3 className="premium-h3" style={{ fontSize: '1.4rem', margin: 0 }}>
                      {donation 
                        ? (calculatedQualityScore < 30 ? "Access Restricted" : "Safe to Retrieve") 
                        : "Vault Standby"}
                    </h3>
                    <p className="premium-p" style={{ fontSize: '0.85rem', margin: 0, opacity: 0.85 }}>
                      {donation 
                        ? (calculatedQualityScore < 30 
                            ? "Quality dropped below safety threshold." 
                            : "Item health verified. Please use the slider to open.") 
                        : t("receiverRule")}
                    </p>
                    
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                      <div className="nature-pill" style={{ fontSize: '0.55rem' }}><Activity size={10} />INDEX: {calculatedQualityScore}%</div>
                      <div className="nature-pill" style={{ fontSize: '0.55rem' }}><ShieldCheck size={10} />HEALTH: OPTIMAL</div>
                    </div>
                  </div>
                </div>

                {recommendedActions.length > 0 && (
                  <div className="hrd-actions-block" style={{
                    margin: 0,
                    background: 'rgba(16, 185, 129, 0.06)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    borderLeft: '4px solid #10B981',
                    position: 'relative',
                    zIndex: 1,
                    borderRadius: '1rem',
                    padding: '1.1rem 1.25rem',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                      <p className="sector-title" style={{ color: '#34D399', margin: 0, fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.12em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Zap size={14} className="animate-pulse" style={{ color: '#10B981' }} /> RECOMMENDED ACTIONS
                      </p>
                      <span style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em', color: '#10B981', background: 'rgba(16, 185, 129, 0.15)', padding: '0.15rem 0.5rem', borderRadius: '99px', textTransform: 'uppercase' }}>
                        Protocol Active
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.55rem' }}>
                      {recommendedActions.map((action, idx) => (
                        <div key={action} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', fontSize: '0.82rem', color: 'var(--text)', fontWeight: 500, lineHeight: 1.5 }}>
                          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px #10B981', flexShrink: 0, marginTop: '0.45rem' }} />
                          <span>{action}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Retrieve Slider & Administrative Override */}
              <div className="retrieve-slider-col" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
                {showHoardingDenied ? (
                  /* ── Daily-limit lock state — only visible to the denied person, auto-dismisses in 8s ── */
                  <div style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem",
                    padding: "1.5rem",
                    background: "rgba(239,68,68,0.04)",
                    border: "1px solid rgba(239,68,68,0.2)",
                    borderRadius: "16px",
                    textAlign: "center"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                      <Ban size={18} style={{ color: "#f87171", flexShrink: 0 }} />
                      <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#f87171", textTransform: "uppercase", letterSpacing: "0.12em" }}>
                        Access Denied — Daily Limit Reached
                      </span>
                    </div>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0, lineHeight: 1.55 }}>
                      You've already collected food {deniedMatchCount} time{deniedMatchCount !== 1 ? "s" : ""} today.
                      Fair Share Policy limits 2 retrievals per person per day.
                      This screen will close automatically.
                    </p>
                    <button
                      onClick={() => setShowHoardingDenied(false)}
                      style={{
                        padding: "0.5rem 1.25rem",
                        borderRadius: "99px",
                        background: "rgba(239,68,68,0.1)",
                        border: "1px solid rgba(239,68,68,0.25)",
                        color: "#f87171",
                        fontSize: "0.65rem",
                        fontWeight: 800,
                        letterSpacing: "0.08em",
                        cursor: "pointer"
                      }}
                    >
                      Understood
                    </button>
                  </div>
                ) : (
                  <div data-tour="receiver-slide-action" className="retrieve-action-area-luxe" style={{ position: 'relative', zIndex: 1, marginTop: '0', width: '100%' }}>
                    <SlideConfirm 
                      label={isSpoiled ? "⚠ Restricted — Food Spoiled" : isFaulted ? "⚠ Locker Faulted — Use Override" : (t("slideToRetrieve") || "Slide to Retrieve")}
                      onConfirm={() => setShowFaceVerification(true)}
                      disabled={!donation || isFaulted || isBusy || isSanitizing || isSpoiled}
                      className="luxe-slide-container"
                    />
                  </div>
                )}

                {/* Admin Override — ENABLED when spoiled OR faulted (ensures there's always a way to get food out) */}
                <div className="admin-override-area" style={{ marginTop: '0', position: 'relative', zIndex: 1, width: '100%' }}>
                  <div className="admin-divider" style={{ marginBottom: '0.75rem' }}>
                    <span className="divider-text">ADMINISTRATIVE OVERRIDE</span>
                  </div>
                  <SlideConfirm 
                    label={!donation ? "No Item in Vault" : (isSpoiled ? "Force Open Vault" : isFaulted ? "Force Open — Fault Override" : "Override Not Required")}
                    onConfirm={handleAdminRetrieve}
                    className="luxe-slide-container admin-slide"
                    disabled={!donation || isBusy || isSanitizing || (!isSpoiled && !isFaulted)}
                  />
                </div>
              </div>
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
                insight={agentInsight}
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


      </section>
    </div>
  );
}
