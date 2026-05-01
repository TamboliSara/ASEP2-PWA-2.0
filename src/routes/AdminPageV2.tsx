import { Link } from "react-router-dom";
import { StatusPill } from "../components/StatusPill";
import { SurfaceCard } from "../components/layout/SurfaceCard";
import { useLockerController } from "../features/useLockerController";
import { useTranslation } from "../store/useTranslation";
import { buildFleetSummaries } from "../utils/fleet";
import { formatDateTime } from "../utils/format";
import { sampleFleetLockers } from "../utils/mockData";

export function AdminPageV2() {
  const { t } = useTranslation();
  const { state, currentLocker, clearFault, syncNow, reconnectLocker, resetDonations, signOut } = useLockerController();
  const fleet = sampleFleetLockers;

  if (!state.isAdminAuthenticated) {
    return (
      <section className="hero-panel glass-panel compact">
        <p className="eyebrow">{t("adminAuthRequired")}</p>
        <h2>{t("signIn")}</h2>
        <p>{t("adminSignInBody")}</p>
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
        <div className="hero-actions" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <Link className="secondary-button" to="/connect">
            {t("connectNav") || "Device Setup"}
          </Link>
          <button className="danger-button mini-action" type="button" onClick={signOut}>
            {t("signOut") || "Sign Out"}
          </button>
        </div>
      </section>

      <section className="admin-stats-bar">
        <SurfaceCard className="stat-card-luxe">
          <div className="stat-header">
            <span className="stat-label">Total Donations</span>
            <div className="stat-icon-box accent-green">📈</div>
          </div>
          <div className="stat-body">
            <strong>142</strong>
            <div className="stat-trend positive">↑ 12%</div>
          </div>
          <small className="stat-timestamp">as of {new Date().toLocaleTimeString()}</small>
        </SurfaceCard>

        <SurfaceCard className="stat-card-luxe">
          <div className="stat-header">
            <span className="stat-label">Active Lockers</span>
            <div className="stat-icon-box accent-blue">🏢</div>
          </div>
          <div className="stat-body">
            <strong>8 / 12</strong>
            <div className="stat-trend neutral">→ 0%</div>
          </div>
          <small className="stat-timestamp">as of {new Date().toLocaleTimeString()}</small>
        </SurfaceCard>

        <SurfaceCard className="stat-card-luxe">
          <div className="stat-header">
            <span className="stat-label">Meals Served Today</span>
            <div className="stat-icon-box accent-orange">🍛</div>
          </div>
          <div className="stat-body">
            <strong>24</strong>
            <div className="stat-trend positive">↑ 8%</div>
          </div>
          <small className="stat-timestamp">as of {new Date().toLocaleTimeString()}</small>
        </SurfaceCard>
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
              title={`Zone: ${locker.zoneLabel} — Unit ${locker.lockerLabel}`}
            >
              <strong>{locker.lockerLabel}</strong>
              <span>{locker.activeDonationName ?? t("ready")}</span>
            </button>
          ))}
        </div>
      </SurfaceCard>

      <div className="details-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <SurfaceCard>
          <p className="card-label">{t("lockerSummaries")}</p>
          <div className="locker-summary-list">
            {fleet.map((locker) => (
              <article key={locker.lockerId} className="locker-summary-card">
                <div>
                  <strong>{locker.lockerLabel}</strong>
                  <p>{locker.zoneLabel}</p>
                </div>
                <StatusPill
                  value={locker.occupancyState}
                  tone={locker.faultState !== "none" ? "danger" : locker.occupancyState === "occupied" ? "warning" : "success"}
                />
                <p>{locker.activeDonationName ?? t("noDonation")}</p>
                <span>{locker.deadlineEstimate ? formatDateTime(locker.deadlineEstimate.absoluteIso) : t("waitingForDeposit")}</span>
              </article>
            ))}
          </div>
        </SurfaceCard>

        <div style={{ display: 'grid', gap: '1.5rem' }}>
          <SurfaceCard>
            <p className="card-label">{t("currentKiosk")}</p>
            <div className="metric-list">
              <div><span>{t("bleStatus")}</span><strong>{currentLocker.bleConnected ? t("connected") : t("disconnected")}</strong></div>
              <div><span>{t("sensorHealth")}</span><strong>{currentLocker.telemetry.sensorHealth}</strong></div>
              <div><span>{t("sanitization")}</span><strong>{currentLocker.sanitizationState}</strong></div>
              <div><span>{t("lastSync")}</span><strong>{formatDateTime(currentLocker.lastSyncedAt)}</strong></div>
            </div>
          </SurfaceCard>
          <SurfaceCard>
            <p className="card-label">{t("systemActions")}</p>
            <div className="button-stack">
              <button className="primary-button" type="button" onClick={syncNow}>{t("forceCloudSync")}</button>
              <button className="secondary-button" type="button" onClick={reconnectLocker}>{t("bleReconnect")}</button>
              <button className="danger-button" type="button" onClick={clearFault}>{t("clearFault")}</button>
              <button className="danger-button" type="button" onClick={resetDonations} style={{ marginTop: '0.5rem', background: '#991B1B' }}>Full System Reset (Clear Dashboard)</button>
            </div>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}
