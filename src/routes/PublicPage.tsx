import { StatusPill } from "../components/StatusPill";
import { TelemetryChart } from "../components/TelemetryChart";
import { SurfaceCard } from "../components/layout/SurfaceCard";
import { useAppContext } from "../store/AppContext";
import { useTranslation } from "../store/useTranslation";
import { useLockerController } from "../features/useLockerController";
import { formatDateTime } from "../utils/format";

export function PublicPage() {
  const { state } = useAppContext();
  const { currentLocker } = useLockerController();
  const { t } = useTranslation();
  const donation = currentLocker.activeDonation;

  return (
    <div className="page-grid public-grid">
      <section className="hero-panel glass-panel compact">
        <div className="hero-copy">
          <p className="eyebrow">Browse-only community view</p>
          <h2>{t("mobileTitle")}</h2>
          <p>Phone users can browse safety, freshness, and availability without any remote-unlock capability.</p>
        </div>
      </section>
      <SurfaceCard>
        <p className="card-label">Availability</p>
        <StatusPill value={currentLocker.occupancyState} tone={donation ? "warning" : "success"} />
        <h3>{donation?.foodName ?? t("noDonation")}</h3>
        <p>{donation ? donation.allergensNotes : "This locker is ready for a new community donation."}</p>
      </SurfaceCard>
      <SurfaceCard>
        <p className="card-label">Food Safety</p>
        <StatusPill value={currentLocker.foodQualityScore} tone={currentLocker.foodQualityScore === "fresh" ? "success" : "warning"} />
        <h3>{formatDateTime(currentLocker.deadlineEstimate.absoluteIso)}</h3>
        <p>Current internal temperature: {currentLocker.telemetry.internalTempC} C</p>
      </SurfaceCard>
      <SurfaceCard>
        <p className="card-label">Donation Details</p>
        <div className="metric-list">
          <div><span>Category</span><strong>{donation?.categoryLabel ?? "-"}</strong></div>
          <div><span>Preference</span><strong>{donation?.dietTag ?? "-"}</strong></div>
          <div><span>Added</span><strong>{donation ? formatDateTime(donation.createdAt) : "-"}</strong></div>
          <div><span>Last Sync</span><strong>{formatDateTime(currentLocker.lastSyncedAt)}</strong></div>
        </div>
      </SurfaceCard>
      <SurfaceCard>
        <p className="card-label">Spoilage Trend</p>
        <TelemetryChart />
      </SurfaceCard>
    </div>
  );
}