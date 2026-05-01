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
      <SurfaceCard>
        <p className="card-label">Locker summaries</p>
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
              <p>{locker.activeDonationName ?? "No active donation"}</p>
              <span>{locker.deadlineEstimate ? formatDateTime(locker.deadlineEstimate.absoluteIso) : "Waiting for deposit"}</span>
            </article>
          ))}
        </div>
      </SurfaceCard>
      <SurfaceCard>
        <p className="card-label">Current kiosk</p>
        <div className="metric-list">
          <div><span>BLE</span><strong>{currentLocker.bleConnected ? "Connected" : "Disconnected"}</strong></div>
          <div><span>Sensor Health</span><strong>{currentLocker.telemetry.sensorHealth}</strong></div>
          <div><span>Sanitization</span><strong>{currentLocker.sanitizationState}</strong></div>
          <div><span>Last Sync</span><strong>{formatDateTime(currentLocker.lastSyncedAt)}</strong></div>
        </div>
      </SurfaceCard>
      <SurfaceCard>
        <p className="card-label">Actions</p>
        <div className="button-stack">
          <button className="primary-button" type="button" onClick={syncNow}>Force Cloud Sync</button>
          <button className="secondary-button" type="button" onClick={reconnectLocker}>BLE Reconnect</button>
          <button className="danger-button" type="button" onClick={clearFault}>Acknowledge and Clear Fault</button>
          <button className="danger-button" type="button" onClick={resetDonations} style={{ marginTop: '0.5rem', background: '#991B1B' }}>Full System Reset (Clear Dashboard)</button>
        </div>
      </SurfaceCard>
    </div>
  );
}
