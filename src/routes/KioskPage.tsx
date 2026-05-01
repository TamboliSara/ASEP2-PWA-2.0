import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";
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
import { getRecommendedActions } from "../utils/safety";
import { formatCountdown, formatDateTime, getHoursRemaining } from "../utils/format";
import { useAppContext } from "../store/AppContext";

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
  const selectedDeadline = displayDonation?.deadlineEstimate ?? currentLocker.deadlineEstimate;
  const dashboardLocker = {
    ...currentLocker,
    foodQualityScore: selectedQualityScore,
    deadlineEstimate: selectedDeadline
  };
  const recommendedActions = getRecommendedActions(dashboardLocker);

  const dynamicHoursRemaining = useMemo(() => {
    void now;
    if (!selectedDeadline) return 0;
    const hrs = getHoursRemaining(selectedDeadline.absoluteIso);
    return isNaN(hrs) ? (selectedDeadline.hoursRemaining || 0) : hrs;
  }, [now, selectedDeadline?.absoluteIso, selectedDeadline?.hoursRemaining]);

  const MAX_SHELF_LIFE = 48; // Standard normalization hours

  const calculatedQualityScore = useMemo(() => {
    if (dynamicHoursRemaining <= 0) return 0;
    const score = Math.min(100, Math.round((dynamicHoursRemaining / MAX_SHELF_LIFE) * 100));
    return score;
  }, [dynamicHoursRemaining]);

  const qualityStage = dynamicHoursRemaining <= 0 ? "spoiled" : dynamicHoursRemaining <= 4 ? "warning" : "fresh";
  const qualityProgress = 100 - calculatedQualityScore; // For progress bars where 100% is 'full life used'
  const displayHoursRemaining = dynamicHoursRemaining > 0 ? dynamicHoursRemaining : (selectedDeadline?.hoursRemaining ?? 0);

  async function handleAdminRetrieve() {
    if (state.isAdminAuthenticated) {
      await retrieveFood(true); // Skip sanitization for admin
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
      await retrieveFood(true);
    } else {
      setAuthError("Invalid credentials");
    }
  }

  const navigateLocker = (direction: -1 | 1) => {
    const currentIndex = state.lockers.findIndex(l => l.lockerId === currentLocker.lockerId);
    const nextIndex = (currentIndex + direction + state.lockers.length) % state.lockers.length;
    selectLocker(state.lockers[nextIndex].lockerId);
  };

  return (
    <div className="page-grid receiver-grid">
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
          <div className="auth-modal glass-panel animate-reveal">
            <div className="modal-header">
              <span className="mini-icon">🔐</span>
              <h3>Admin Authorization</h3>
              <p>Please verify your identity to proceed with override.</p>
            </div>
            <form onSubmit={confirmAdminAuth} className="auth-form">
              <label>
                <span>Email Address</span>
                <input 
                  type="email" 
                  value={adminId} 
                  onChange={(e) => setAdminId(e.target.value)} 
                  placeholder="admin@ecolocker.local"
                  required 
                />
              </label>
              <label>
                <span>Access Key</span>
                <input 
                  type="password" 
                  value={adminPassword} 
                  onChange={(e) => setAdminPassword(e.target.value)} 
                  placeholder="••••••••"
                  required 
                />
              </label>
              {authError && <p className="auth-error-msg">{authError}</p>}
              <div className="modal-actions">
                <button type="button" className="ghost-button" onClick={() => setShowAdminAuth(false)}>Cancel</button>
                <button type="submit" className="primary-button">Verify & Clear Unit</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="page-navigation-top">
        <Link to="/" className="ghost-button">
          ← {t("backToHome") || "Back to Home"}
        </Link>
      </div>

      <section className="hero-panel receiver-hero glass-panel">
        <div className="hero-copy">
          <p className="eyebrow">{t("receiverEyebrow")}</p>
          <h2>
            {displayDonation 
              ? (displayDonation.foodName.charAt(0).toUpperCase() + displayDonation.foodName.slice(1)) 
              : t("noDonation")}
          </h2>
          <p>{t("receiverBody")}</p>
          <div className="hero-actions-row" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div className="metric-chip-row">
              <StatusPill value={currentLocker.occupancyState} tone={donation ? "warning" : "success"} />
              <StatusPill value={calculatedQualityScore} tone={isFaulted ? "danger" : (calculatedQualityScore < 30 ? "danger" : "success")} />
              <StatusPill value={telemetry.sensorHealth} tone={telemetry.sensorHealth === "healthy" ? "success" : "warning"} />
            </div>
            {state.isAdminAuthenticated && (
              <button 
                className="secondary-button mini-action" 
                onClick={() => dispatch({ type: "set-admin-auth", value: false })}
                style={{ fontSize: '0.65rem', padding: '0.4rem 0.8rem' }}
              >
                ADMIN SIGN OUT
              </button>
            )}
          </div>
          {state.syncMessage ? <div className="status-banner">{state.syncMessage}</div> : null}
        </div>
        <FoodHeroV2 
          donation={donation} 
          items={state.donationHistory} 
          onActiveItemChange={setSelectedDonation} 
          onPrevLocker={() => navigateLocker(-1)}
          onNextLocker={() => navigateLocker(1)}
        />
      </section>

      <section className="chamber-selection-grid">
        <motion.div 
          className="selection-header"
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >

          <p className="eyebrow-accent">UNIT COMPARTMENTS</p>
          <h3 className="premium-h3">Select Safe to Analyze</h3>
          <div className="header-divider-mini" />
        </motion.div>

        <motion.div 
          className="chamber-grid-layout"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: {
                staggerChildren: 0.05
              }
            }
          }}
        >
          {state.lockers.map((locker, idx) => {
            const safeNum = (idx + 1).toString().padStart(2, '0');
            const isActive = state.selectedLockerId === locker.lockerId;
            
            return (
              <motion.button
                key={locker.lockerId}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  show: { opacity: 1, y: 0 }
                }}
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
                            <span className="dot"></span>
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
            );
          })}
        </motion.div>
      </section>

      <style>{`
        .admin-auth-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.8);
          backdrop-filter: blur(10px);
          display: grid;
          place-items: center;
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
      `}</style>

        <div className="feature-header animate-luxe-entry" style={{ gridColumn: '1 / -1', marginTop: '3rem', marginBottom: '1.5rem' }}>
          <div className="live-status-indicator">
            <span className="pulsing-dot" />
            <span className="live-text">SYSTEM LIVE</span>
          </div>
          <p className="eyebrow-accent">MISSION CONTROL</p>
          <h2 className="gradient-text-luxe">Analytics Dashboard</h2>
          <div className="header-divider-luxe" />
          <p className="heading-subtext">Real-time telemetry and food health forecasting</p>
        </div>

      <section style={{ gridColumn: '1 / -1', marginBottom: '2rem' }}>
        <FleetMap />
      </section>

      <section className="receiver-editorial-layout" style={{ gridColumn: '1 / -1' }}>
        <SurfaceCard className="receiver-card receiver-card-deadline luxe-quality-card">
          <header className="card-header-premium">
            <div className="header-title-group">
              <p className="card-label">{t("qualityScore")}</p>
              <div className="live-indicator">
                <span className="live-dot" />
                LIVE
              </div>
            </div>
            <div className="safety-badge">
              <span className="shield-icon">🛡️</span>
              <span className="safety-text">SAFETY VERIFIED</span>
            </div>
          </header>

          <div className="gauge-hero-layout">
            <div className="gauge-side">
              <QualityGauge hoursRemaining={displayHoursRemaining} totalDuration={MAX_SHELF_LIFE} />
            </div>
            
            <div className="gauge-hero-copy">
              <div className="time-stack">
                <h3 className="quality-hours">
                  {displayHoursRemaining.toFixed(1)}
                  <span className="hours-label">
                    {t("hoursRemaining") || " hours remaining"}
                  </span>
                </h3>
                <div className="countdown-ribbon">
                  <span className="ribbon-icon">⏳</span>
                  <strong className="quality-countdown">
                    {formatCountdown(selectedDeadline.absoluteIso)}
                  </strong>
                </div>
              </div>

              <div className="expiry-details">
                <span className="expiry-icon">📅</span>
                <p className="quality-expiry">
                  {formatDateTime(selectedDeadline.absoluteIso)}
                </p>
              </div>

              <div className="action-tag-cloud">
                <p className="cloud-label">{t("recommendedActions") || "Recommended Actions"}</p>
                <div className="tag-list-enhanced">
                  {recommendedActions.map((action, idx) => (
                    <span key={action} className="info-tag-luxe" style={{ animationDelay: `${idx * 0.1}s` }}>
                      <span className="tag-dot" />
                      {action}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

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
              box-shadow: 0 0 30px rgba(var(--accent-rgb), 0.15);
              background: rgba(var(--accent-rgb), 0.05);
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
              background: rgba(0,0,0,0.1);
              padding: 1rem;
              border-radius: 16px;
              border: 1px solid var(--glass-border);
              display: flex;
              flex-direction: column;
              gap: 0.25rem;
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
              gap: 1.5rem;
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
              font-weight: 700;
              color: var(--accent) !important;
              font-family: var(--font-mono);
            }

            .retrieve-action-area-luxe {
              margin-top: 2rem;
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
              font-size: 0.6rem;
              font-weight: 900;
              color: var(--accent);
              letter-spacing: 0.2em;
              margin-bottom: 1rem;
              display: flex;
              align-items: center;
              gap: 0.6rem;
              opacity: 0.8;
              text-transform: uppercase;
            }
            .sector-title::before {
              content: "[";
              font-weight: 400;
              opacity: 0.5;
            }
            .sector-title::after {
              content: "]";
              font-weight: 400;
              opacity: 0.5;
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
        </SurfaceCard>

        <SurfaceCard className={`receiver-card receiver-card-profile luxe-profile-card ${!donation ? 'is-empty-luxe' : ''}`}>
          <div className="card-header-mini">
            <p className="card-label">{t("publicFoodProfile")}</p>
            <span className="mini-icon">🌿</span>
          </div>
          <div className="profile-hero">
            <h3 className="premium-h3">{displayDonation?.categoryLabel ?? t("lockerReady")}</h3>
            <p className="premium-p">{displayDonation?.allergensNotes ?? t("lockerReadyBody")}</p>
          </div>
          <div className="luxe-metric-grid">
            <div className="luxe-metric-item">
              <span className="item-label">{t("preference")}</span>
              <div className="item-value">
                {displayDonation?.dietTag === 'veg' && <span className="diet-icon">🟢</span>}
                {displayDonation?.dietTag === 'non_veg' && <span className="diet-icon">🔴</span>}
                {displayDonation?.dietTag === 'vegan' && <span className="diet-icon">🍃</span>}
                <span className="diet-text">{displayDonation?.dietTag?.replace("_", " ") ?? "-"}</span>
              </div>
            </div>
            <div className="luxe-metric-item">
              <span className="item-label">{t("registered")}</span>
              <div className="item-value date-value">
                {displayDonation ? formatDateTime(displayDonation.createdAt) : "-"}
              </div>
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard className={`receiver-card receiver-card-telemetry luxe-telemetry-card ${!donation ? 'is-empty-luxe' : ''}`}>
          <div className="card-header-mini">
            <p className="card-label">{t("liveTelemetry")}</p>
            <div className="telemetry-meta-group">
              <div className="signal-strength">
                <span className="signal-bar active" />
                <span className="signal-bar active" />
                <span className="signal-bar active" />
                <span className="signal-bar" />
              </div>
              <div className="sensor-status">
                <span className="pulse-dot green" />
                SENSORS ACTIVE
              </div>
            </div>
          </div>
          <div className="telemetry-bento-grid-enhanced">
            <div className="bento-item-luxe">
              <div className="mini-gauge">
                <svg viewBox="0 0 36 36" className="circular-chart green">
                  <path className="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path className="circle" strokeDasharray={`${(telemetry.internalTempC / 50) * 100}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                </svg>
                <span className="gauge-icon">🌡️</span>
              </div>
              <div className="bento-copy">
                <span className="bento-label">{t("internalTemp")}</span>
                <div className="value-group">
                  <span className="bento-value">{telemetry.internalTempC}</span>
                  <span className="bento-unit">°C</span>
                </div>
              </div>
            </div>
            <div className="bento-item-luxe">
              <div className="mini-gauge">
                <svg viewBox="0 0 36 36" className="circular-chart blue">
                  <path className="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path className="circle" strokeDasharray={`${telemetry.humidityPct}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                </svg>
                <span className="gauge-icon">💧</span>
              </div>
              <div className="bento-copy">
                <span className="bento-label">{t("humidity")}</span>
                <div className="value-group">
                  <span className="bento-value">{telemetry.humidityPct}</span>
                  <span className="bento-unit">%</span>
                </div>
              </div>
            </div>
            <div className="bento-item-luxe">
              <div className="bento-icon-bg">📊</div>
              <div className="bento-copy">
                <span className="bento-label">{t("pressure")}</span>
                <div className="value-group">
                  <span className="bento-value">{telemetry.pressureHpa}</span>
                  <span className="bento-unit">hPa</span>
                </div>
              </div>
            </div>
            <div className="bento-item-luxe">
              <div className="bento-icon-bg">✨</div>
              <div className="bento-copy">
                <span className="bento-label">{t("airQuality")}</span>
                <div className="value-group">
                  <span className="bento-value">{telemetry.gasResistanceOhms}</span>
                  <span className="bento-unit">Ω</span>
                </div>
              </div>
            </div>
          </div>
          <div className="botanical-corner-accent top-right">🌿</div>
        </SurfaceCard>

        <SurfaceCard className={`receiver-card receiver-card-gas luxe-gas-card ${!donation ? 'is-empty-luxe' : ''}`}>
          <div className="vapor-ambient-effect" />
          <div className="vapor-waveform-container">
            <div className="wave wave-1" />
            <div className="wave wave-2" />
            <div className="wave wave-3" />
          </div>
          
          <div className="card-header-mini">
            <p className="card-label">{t("gasProfile")}</p>
            <div className="aqi-badge">
              <span className="aqi-dot" />
              SENSORY ANALYZER
            </div>
          </div>
          
          <div className="gas-analysis-copy">
            <h3 className="premium-h3">Vapor Signature</h3>
            <p className="premium-p mb-1">Detected volatile organic compounds (VOCs)</p>
            
            <div className="gas-spectrum-visualizer">
              <div className="spectrum-track">
                <div className="spectrum-fill" style={{ width: '65%', background: 'linear-gradient(90deg, var(--accent) 0%, var(--warning) 100%)' }} />
              </div>
              <div className="spectrum-labels">
                <span>Neutral</span>
                <span>Active</span>
              </div>
            </div>

            <div className="luxe-tag-cloud-enhanced">
              {telemetry.heuristicGasProfile.map((entry, idx) => (
                <div key={entry} className="luxe-vapor-tag" style={{ animationDelay: `${idx * 0.1}s` }}>
                  <div className="tag-glow-dot" />
                  <span className="tag-text">{entry}</span>
                  <div className="tag-intensity-bar">
                    <div className="intensity-fill" style={{ width: `${80 - (idx * 15)}%` }} />
                  </div>
                </div>
              ))}
              {telemetry.heuristicGasProfile.length === 0 && (
                <div className="luxe-vapor-tag muted">
                  <span className="tag-text">NO ACTIVE SIGNATURES DETECTED</span>
                </div>
              )}
            </div>
          </div>
          <div className="botanical-corner-accent bottom-right">🍃</div>
        </SurfaceCard>

        <SurfaceCard className="receiver-card receiver-card-retrieve luxe-retrieve-card">
          <div className="vapor-ambient-effect" />
          <div className="retrieve-accent-glow" />
          <div className="vault-chamber-bg" />
          
          <div className="card-header-mini">
            <p className="card-label">{t("retrieveItem")}</p>
            {donation && (
              <div className="security-verified-badge">
                <span className="verify-dot" />
                SIGNATURE VERIFIED
              </div>
            )}
          </div>

          <div className="retrieve-hero-luxe" style={{ gridTemplateColumns: '150px 1fr', gap: '2rem' }}>
            <div className="vault-visualizer">
              <div className="mechanical-rings">
                <div className="ring ring-1" />
                <div className="ring ring-2" />
                <div className="ring ring-3" />
              </div>
              <div className={`retrieve-vault-core ${donation && calculatedQualityScore >= 30 ? 'is-ready' : 'is-locked'}`}>
                <div className="scanner-line" />
                <div className="vault-box">
                  <span className="box-icon">{calculatedQualityScore < 30 ? "⚠️" : "📦"}</span>
                  <div className="core-glow" />
                </div>
              </div>
            </div>

            <div className="retrieve-details-hub">
              <h3 className="premium-h3" style={{ color: calculatedQualityScore < 30 ? "#EF4444" : "inherit" }}>
                {donation 
                  ? (calculatedQualityScore < 30 ? "Hazard: Access Denied" : "Secure Access Ready") 
                  : "Vault Locked"}
              </h3>
              <p className="premium-p">
                {donation 
                  ? (calculatedQualityScore < 30 
                      ? "Food quality has dropped below safe consumption threshold (30%). Retrieval is restricted for your safety." 
                      : "Item signature matched. Safety protocols cleared.") 
                  : t("receiverRule")}
              </p>
              
              <div className="vault-tech-specs">
                <div className="tech-specs-grid">
                  <div className="spec-pill-enhanced">
                    <span className="spec-dot pulsing" />
                    <div className="spec-copy">
                      <span className="spec-label">UV-C</span>
                      <span className="spec-status">ACTIVE</span>
                    </div>
                  </div>
                  <div className="spec-pill-enhanced">
                    <span className="spec-dot pulsing blue" />
                    <div className="spec-copy">
                      <span className="spec-label">ION</span>
                      <span className="spec-status">STABLE</span>
                    </div>
                  </div>
                  <div className="spec-pill-enhanced">
                    <span className="spec-dot green" />
                    <div className="spec-copy">
                      <span className="spec-label">OZONE</span>
                      <span className="spec-status">0.01ppm</span>
                    </div>
                  </div>
                </div>
                
                <div className="access-meta-enhanced">
                  <div className="meta-card">
                    <span className="meta-label">CREATED AT</span>
                    <span className="meta-val">{displayDonation?.createdAt ? formatDateTime(displayDonation.createdAt) : "—"}</span>
                  </div>
                  <div className="meta-card">
                    <span className="meta-label">HEALTH INDEX</span>
                    <span className="meta-val pulse">{calculatedQualityScore}%</span>
                  </div>
                </div>
              </div>

              {donation && (
                <div className="access-meta">
                  <div className="meta-item">
                    <span className="meta-label">ID</span>
                    <span className="meta-val">#{donation?.id?.slice(0, 8)}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">LOCK</span>
                    <span className="meta-val">BIO-SYNC</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">AUTH</span>
                    <span className="meta-val pulse">PASS</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="retrieve-action-area-luxe">
            <SlideConfirm 
              label={calculatedQualityScore < 30 ? "Retrieval Restricted (Low Quality)" : (t("slideToRetrieve") || "Slide to Retrieve")}
              onConfirm={retrieveFood}
              disabled={!donation || isFaulted || isBusy || isSanitizing || calculatedQualityScore < 30}
            />
            
            <div className="admin-override-area">
              <div className="admin-divider">
                <span className="divider-text">ADMINISTRATIVE OVERRIDE</span>
              </div>
              <SlideConfirm 
                className="admin-slide"
                label={calculatedQualityScore >= 30 ? "Standard Access Only" : (t("adminSlideToRetrieve") || "Admin: Remove Spoiled Item")}
                completedLabel="Admin Cleared"
                onConfirm={handleAdminRetrieve}
                disabled={!donation || isBusy || isSanitizing || calculatedQualityScore >= 30}
              />
            </div>

            <p className="safety-footer-text">
              <span className="lock-icon">{calculatedQualityScore < 30 ? "🚫" : "🔒"}</span> 
              {calculatedQualityScore < 30 ? "Health hazard detected. Contact support." : t("receiverRule")}
            </p>
          </div>
        </SurfaceCard>

        <SurfaceCard className="receiver-card receiver-card-actions luxe-actions-card">
          <div className="vapor-ambient-effect" />
          <div className="security-shield-bg" />
          <div className="mission-scanline" />
          <div className="technical-corner-mark top-right" />
          <div className="technical-corner-mark bottom-left" />
          
          <div className="card-header-mini" style={{ marginBottom: '2rem' }}>
            <div className="header-title-stack">
              <span className="sector-title" style={{ marginBottom: '0.25rem', opacity: 0.6 }}>COMMAND_NODE_01 // SEC_ALPHA</span>
              <p className="card-label" style={{ fontSize: '1.75rem', fontWeight: 950, letterSpacing: '-0.02em', color: 'var(--text)' }}>SYSTEM_CONTROLS</p>
            </div>
            <div className="system-status-badge-premium">
              <span className="pulse-dot" />
              AUTH_LEVEL_01: SECURE
            </div>
          </div>
          
          <div className="mission-control-layout">
            <div className="status-display-sector">
              <div className="sector-header-stack" style={{ marginBottom: '1rem' }}>
                <span className="sector-title">DIAGNOSTIC_TELEMETRY</span>
              </div>
              
              <div className="cyber-stats-grid">
                <div className="cyber-box">
                  <div className="stat-info">
                    <span className="stat-label-luxe">🌐 NETWORK_INTEGRITY</span>
                    <div className="stat-sub-label" style={{ fontSize: '0.45rem', opacity: 0.4, marginTop: '2px' }}>SIGNAL: 98.4dBm</div>
                  </div>
                  <span className="stat-value-luxe mono">0.9984_STABLE</span>
                </div>
                
                <div className="cyber-box">
                  <div className="stat-info">
                    <span className="stat-label-luxe">🔒 LOCKER_SESSION</span>
                    <div className="stat-sub-label" style={{ fontSize: '0.45rem', opacity: 0.4, marginTop: '2px' }}>KEY: RSA_4096</div>
                  </div>
                  <span className="stat-value-luxe mono">
                    {displayDonation?.lockerId ? `SAFE_${displayDonation.lockerId.padStart(2, '0')}` : "NULL_STATE"}
                  </span>
                </div>
                
                <div className="cyber-box">
                  <div className="stat-info">
                    <span className="stat-label-luxe">⏱️ SYSTEM_UPTIME</span>
                    <div className="stat-sub-label" style={{ fontSize: '0.45rem', opacity: 0.4, marginTop: '2px' }}>BOOT: 2026-04-20</div>
                  </div>
                  <span className="stat-value-luxe mono">142:31:05</span>
                </div>
              </div>
            </div>

            <div className="action-sector">
              <div className="override-header" style={{ marginBottom: '1.5rem' }}>
                <span className="sector-title">OVERRIDE_PROTOCOLS</span>
                <p className="premium-p" style={{ fontSize: '0.8rem', opacity: 0.6, lineHeight: 1.6, marginTop: '0.5rem', maxWidth: '300px' }}>
                  Administrative terminal for manual cloud synchronization and emergency container containment.
                </p>
              </div>
              
              <div className="glass-button-stack">
                <button className="glass-action-btn sync" type="button" onClick={syncNow} disabled={isBusy}>
                  <div className="btn-shine" />
                  <span className="btn-text">EXECUTE_SYNC</span>
                </button>
                <button className="glass-action-btn lockdown" type="button" onClick={triggerMaintenanceLockdown}>
                  <div className="btn-shine" />
                  <span className="btn-text">INITIATE_LOCKDOWN</span>
                </button>
              </div>
              
              <div className="action-footer-telemetry" style={{ marginTop: '3rem', borderTop: '1px solid rgba(var(--accent-rgb), 0.1)', paddingTop: '1rem' }}>
                <div className="micro-telemetry-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.55rem', fontFamily: 'var(--font-mono)', fontWeight: 900, opacity: 0.4, letterSpacing: '0.1em' }}>
                  <span>ENC_MODE: AES_256</span>
                  <span>SYNC_INT: 15S</span>
                  <span>NODE: G7_X9</span>
                </div>
              </div>
            </div>
          </div>
        </SurfaceCard>

        <div className="receiver-card-chart bento-chart-container">
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
        </div>

        <SurfaceCard className="receiver-card receiver-card-logs luxe-logs-card">
          <div className="vapor-ambient-effect" />
          <div className="card-header-mini">
            <div className="header-title-stack">
              <span className="sector-title" style={{ marginBottom: '0.25rem' }}>EVENT_PROTOCOL_04</span>
              <p className="card-label" style={{ fontSize: '1.25rem', fontWeight: 900 }}>{t("logs").toUpperCase()}</p>
            </div>
            <div className="log-status-badge">
              <span className="pulse-dot green" />
              RECORDING_LIVE
            </div>
          </div>

          <div className="log-list-enhanced">
            {state.logs.slice(0, 8).map((event, idx) => {
              const getEventIcon = (type: string) => {
                if (type.includes('lock')) return '🔒';
                if (type.includes('door')) return '🚪';
                if (type.includes('sync')) return '☁️';
                if (type.includes('fault')) return '⚠️';
                if (type.includes('sanit')) return '✨';
                if (type.includes('deposit') || type.includes('regis')) return '🥗';
                if (type.includes('retriev')) return '📦';
                return '🔹';
              };

              const getEventTone = (type: string) => {
                if (type.includes('fault')) return 'danger';
                if (type.includes('lock') || type.includes('door')) return 'accent';
                if (type.includes('sanit')) return 'success';
                return 'neutral';
              };

              return (
                <article 
                  key={event.id} 
                  className={`log-item-luxe is-${getEventTone(event.type)}`}
                  style={{ animationDelay: `${idx * 0.1}s` }}
                >
                  <div className="log-icon-box">{getEventIcon(event.type)}</div>
                  <div className="log-content-luxe">
                    <div className="log-header-luxe">
                      <strong className="log-type">{event.type.replace(/_/g, ' ').toUpperCase()}</strong>
                      <span className="log-time">{formatDateTime(event.createdAt)}</span>
                    </div>
                    <p className="log-detail">{event.detail}</p>
                  </div>
                  <div className="log-indicator-line" />
                </article>
              );
            })}
          </div>
          <div className="botanical-corner-accent bottom-left">📜</div>
        </SurfaceCard>
      </section>
    </div>
  );
}
