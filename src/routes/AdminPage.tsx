/**
 * @deprecated
 * PRESERVED FOR FUTURE USE / REFERENCE
 * Superseded by AdminPageV2.tsx (canonical enterprise admin dashboard).
 * DO NOT DELETE — Can be reactivated if requested.
 */
import { Link } from "react-router-dom";
import { StatusPill } from "../components/StatusPill";
import { SurfaceCard } from "../components/layout/SurfaceCard";
import { useLockerController } from "../features/useLockerController";
import { useTranslation } from "../store/useTranslation";
import { buildFleetSummaries } from "../utils/fleet";
import { formatDateTime } from "../utils/format";

export function AdminPage() {
  const { t } = useTranslation();
  const { state, clearFault, syncNow, reconnectLocker, resetDonations, currentLocker } = useLockerController();
  const fleet = buildFleetSummaries(state.lockers);

  if (!state.isAdminAuthenticated) {
    return (
      <section className="hero-panel glass-panel compact">
        <p className="eyebrow">{t("adminAuthRequired")}</p>
        <h2>{t("signIn")}</h2>
        
        <Link className="primary-button inline-link" to="/admin/sign-in">
          {t("continueSignIn")}
        </Link>
      </section>
    );
  }

  return (
    <div className="page-grid admin-grid">
      <section className="hero-panel glass-panel compact">
        <div className="hero-copy">
          <p className="eyebrow">{t("fleetOverview")}</p>
          <h2>{t("adminTitle")}</h2>
          <p>{t("adminBody")}</p>
        </div>
      </section>
      <SurfaceCard>
        <p className="card-label">{t("fleetMap")}</p>
        <div className="fleet-map">
          {fleet.map((locker) => (
            <button
              key={locker.lockerId}
              className={`fleet-node is-${locker.occupancyState}`}
              type="button"
              style={{ left: `${locker.coordinates.x}%`, top: `${locker.coordinates.y}%` }}
              title={`${locker.lockerLabel} • ${locker.zoneLabel}`}
            >
              <strong>{locker.lockerLabel}</strong>
              <span>{locker.activeDonationName ?? "Ready"}</span>
            </button>
          ))}
        </div>
      </SurfaceCard>
      <div className="luxe-admin-grid">
        <section className="luxe-card-premium">
          <div className="luxe-card-header">
            <div className="luxe-card-title-stack">
              <p className="card-label">Locker summaries</p>
              <h3>System Inventory</h3>
            </div>
            <div className="luxe-card-icon-box">📦</div>
          </div>
          <div className="locker-summary-list">
            {fleet.map((locker) => (
              <article key={locker.lockerId} className="luxe-summary-item">
                <div className="luxe-summary-info">
                  <h4>{locker.lockerLabel}</h4>
                  <p>{locker.zoneLabel}</p>
                </div>
                <StatusPill
                  value={locker.occupancyState}
                  tone={locker.faultState !== "none" ? "danger" : locker.occupancyState === "occupied" ? "warning" : "success"}
                />
                <div className="luxe-summary-meta">
                  <span>{locker.activeDonationName ?? "No active donation"}</span>
                  <span style={{ opacity: 0.6 }}>{locker.deadlineEstimate ? formatDateTime(locker.deadlineEstimate.absoluteIso) : "Waiting for deposit"}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <div style={{ display: 'grid', gap: '2rem', alignContent: 'start' }}>
          <section className="luxe-card-premium">
            <div className="luxe-card-header">
              <div className="luxe-card-title-stack">
                <p className="card-label">Current kiosk</p>
                <h3>Kiosk Health</h3>
              </div>
              <div className="luxe-card-icon-box">🛡️</div>
            </div>
            <div className="luxe-metric-grid">
              <div className="luxe-metric-card">
                <span className="luxe-metric-label">BLE</span>
                <strong className="luxe-metric-value">{currentLocker.bleConnected ? "Connected" : "Disconnected"}</strong>
                <div className="luxe-metric-status">
                  <div 
                    className="luxe-metric-status-fill" 
                    style={{ 
                      width: currentLocker.bleConnected ? '100%' : '10%', 
                      background: currentLocker.bleConnected ? 'var(--success)' : 'var(--danger)' 
                    }}
                  ></div>
                </div>
              </div>
              <div className="luxe-metric-card">
                <span className="luxe-metric-label">Sensor Health</span>
                <strong className="luxe-metric-value">{currentLocker.telemetry.sensorHealth}</strong>
                <div className="luxe-metric-status">
                  <div 
                    className="luxe-metric-status-fill" 
                    style={{ 
                      width: currentLocker.telemetry.sensorHealth === 'healthy' ? '100%' : '50%',
                      background: currentLocker.telemetry.sensorHealth === 'healthy' ? 'var(--accent)' : 'var(--warning)'
                    }}
                  ></div>
                </div>
              </div>
              <div className="luxe-metric-card">
                <span className="luxe-metric-label">Sanitization</span>
                <strong className="luxe-metric-value">{currentLocker.sanitizationState}</strong>
                <div className="luxe-metric-status">
                  <div 
                    className="luxe-metric-status-fill" 
                    style={{ 
                      width: currentLocker.sanitizationState === 'idle' ? '100%' : '40%',
                      background: 'var(--accent)'
                    }}
                  ></div>
                </div>
              </div>
              <div className="luxe-metric-card">
                <span className="luxe-metric-label">Last Sync</span>
                <strong className="luxe-metric-value" style={{ fontSize: '0.85rem' }}>{formatDateTime(currentLocker.lastSyncedAt)}</strong>
              </div>
            </div>
          </section>

          <section className="luxe-card-premium">
            <div className="luxe-card-header">
              <div className="luxe-card-title-stack">
                <p className="card-label">Actions</p>
                <h3>Control Center</h3>
              </div>
              <div className="luxe-card-icon-box">⚙️</div>
            </div>
            <div className="luxe-action-stack">
              <button className="luxe-action-button" onClick={syncNow}>
                <i>☁️</i>
                <strong>Force Sync</strong>
                <span>Update records</span>
              </button>
              <button className="luxe-action-button" onClick={reconnectLocker}>
                <i>📡</i>
                <strong>Reconnect</strong>
                <span>Reset BLE bridge</span>
              </button>
              <button className="luxe-action-button danger" onClick={clearFault}>
                <i>⚠️</i>
                <strong>Clear Fault</strong>
                <span>Acknowledge alerts</span>
              </button>
              <button className="luxe-action-button danger" onClick={resetDonations} style={{ background: 'rgba(153, 27, 27, 0.1)' }}>
                <i>♻️</i>
                <strong>Hard Reset</strong>
                <span>Full system wipe</span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
