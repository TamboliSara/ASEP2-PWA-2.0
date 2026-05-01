import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FoodHeroV2 } from "../components/FoodHeroV2";
import { SlideConfirm } from "../components/SlideConfirm";
import { SurfaceCard } from "../components/layout/SurfaceCard";
import { useAppContext } from "../store/AppContext";
import { useTranslation } from "../store/useTranslation";
import { useLockerController } from "../features/useLockerController";

export function ModeSelectPage() {
  const navigate = useNavigate();
  const { state, dispatch } = useAppContext();
  const { currentLocker } = useLockerController();
  const { t } = useTranslation();
  const modeHighlights = useMemo(
    () => [
      {
        title: t("modeFeatureDonor"),
        body: t("modeFeatureDonorBody"),
        icon: "🖋️"
      },
      {
        title: t("modeFeatureReceiver"),
        body: t("modeFeatureReceiverBody"),
        icon: "🛡️"
      },
      {
        title: t("modeFeatureTelemetry"),
        body: t("modeFeatureTelemetryBody"),
        icon: "📈"
      },
      {
        title: t("modeFeatureOffline"),
        body: t("modeFeatureOfflineBody"),
        icon: "📦"
      }
    ],
    [t]
  );

  return (
    <div className="page-grid mode-select-grid">
      <section className="hero-panel botanical-hero">
        <div className="hero-copy">
          <p className="eyebrow">{t("modeEyebrow")}</p>
          <h2>{t("modeTitle")}</h2>
          <p>{t("modeBody")}</p>
          {state.syncMessage ? <div className="status-banner">{state.syncMessage}</div> : null}
        </div>
        <FoodHeroV2 donation={currentLocker.activeDonation} />
      </section>

      <div className="mode-selection-stack-luxe">
        <div className={`mode-card-luxe stagger-1 ${!currentLocker.activeDonation ? "is-available" : "is-busy"}`}>
          <div className="mode-card-visual donor-visual">
            <div className="mode-icon-luxe">🎁</div>
          </div>
          <div className="mode-card-info">
            <h3>{t("donorModeTitle")}</h3>
            <p>{t("donorModeTagline")}</p>
            <div className="availability-indicator">
              <span className="dot" /> {currentLocker.activeDonation ? t("lockerOccupied") : t("lockerAvailable")}
            </div>
          </div>
          <div className="mode-card-action">
            <SlideConfirm
              label={t("slideToDonor")}
              completedLabel={t("donorModeReady")}
              disabled={!!currentLocker.activeDonation}
              onConfirm={() => {
                dispatch({ type: "set-sync-message", message: t("modeArmedDonor") });
                navigate("/donate");
              }}
            />
          </div>
        </div>

        <div className={`mode-card-luxe stagger-2 ${currentLocker.activeDonation ? "is-available" : "is-locked"}`}>
          <div className="mode-card-visual receiver-visual">
            <div className="mode-icon-luxe">🍴</div>
          </div>
          <div className="mode-card-info">
            <h3>{t("receiverModeTitle")}</h3>
            <p>{t("receiverModeTagline")}</p>
            <div className="availability-indicator">
              <span className="dot" /> {currentLocker.activeDonation ? t("donationReady") : t("noActiveDonations")}
            </div>
          </div>
          <div className="mode-card-action">
            <SlideConfirm
              label={t("slideToReceiver")}
              completedLabel={t("receiverModeReady")}
              disabled={!currentLocker.activeDonation}
              onConfirm={() => {
                dispatch({
                  type: "set-sync-message",
                  message: currentLocker.activeDonation
                    ? t("modeArmedReceiver")
                    : t("modeReceiverLocked")
                });
                if (currentLocker.activeDonation) {
                  navigate("/receive");
                }
              }}
            />
          </div>
        </div>
      </div>

      <section className="feature-ribbon">
        <header className="feature-header">
          <h2>{t("modeFeatureRibbonTitle")}</h2>
          <p>{t("modeFeatureRibbonSubtitle")}</p>
        </header>

        <div className="feature-grid">
          {modeHighlights.map((highlight) => (
            <article key={highlight.title} className="feature-pill">
              <div className="feature-icon">{highlight.icon}</div>
              <div className="feature-pill-content">
                <h3>{highlight.title}</h3>
                <p>{highlight.body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="botanical-grid">
        <SurfaceCard className="stagger-3">
          <p className="card-label">{t("currentDonation")}</p>
          <h3>
            {currentLocker.activeDonation 
              ? (currentLocker.activeDonation.foodName.charAt(0).toUpperCase() + currentLocker.activeDonation.foodName.slice(1)) 
              : t("noDonation")}
          </h3>
          <p>
            {currentLocker.activeDonation 
              ? (currentLocker.activeDonation.allergensNotes.toLowerCase().trim() === "none" 
                  ? "Allergy : none" 
                  : currentLocker.activeDonation.allergensNotes.charAt(0).toUpperCase() + currentLocker.activeDonation.allergensNotes.slice(1)) 
              : t("modeWaitingDonation")}
          </p>
        </SurfaceCard>
        <SurfaceCard className="stagger-4">
          <p className="card-label">{t("lockerState")}</p>
          <h3>{currentLocker.occupancyState}</h3>
          <p>{currentLocker.pairedDeviceName ?? t("modePairingRequired")}</p>
        </SurfaceCard>
        <SurfaceCard className="stagger-5">
          <p className="card-label">{t("fleetRecords")}</p>
          <h3>{t("firebaseReady")}</h3>
          <p>{t("firebaseReadyBody")}</p>
        </SurfaceCard>
      </section>
    </div>
  );
}
