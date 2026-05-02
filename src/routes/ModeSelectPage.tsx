import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Hero } from "@/components/ui/animated-hero";
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

    const anyAvailable = state.lockers.some(l => !l.activeDonation);

  return (
    <div className="page-grid mode-select-grid">
      <Hero />

      <motion.div 
        className="mode-selection-stack-luxe"
        initial="hidden"
        animate="show"
        variants={{
          hidden: { opacity: 0 },
          show: {
            opacity: 1,
            transition: {
              staggerChildren: 0.15
            }
          }
        }}
      >
        <motion.div 
          className={`mode-card-luxe donor-card-premium ${anyAvailable ? "is-available" : "is-busy"}`}
          variants={{
            hidden: { opacity: 0, x: -20 },
            show: { opacity: 1, x: 0 }
          }}
        >
          <div className="mode-card-visual donor-visual">
            <div className="visual-glow" />
            <div className="mode-icon-luxe">🎁</div>
          </div>
          <div className="mode-card-info">
            <div className="card-eyebrow">{t("donorModeTagline")}</div>
            <h3>{t("donorModeTitle")}</h3>
            <div className={`availability-status ${anyAvailable ? "is-ready" : "is-busy"}`}>
              <span className="status-dot" />
              {anyAvailable ? t("lockerAvailable") : t("lockerOccupied")}
            </div>
          </div>
          <div className="mode-card-action">
            <SlideConfirm
              label={t("slideToDonor")}
              completedLabel={t("donorModeReady")}
              disabled={false}
              onConfirm={() => {
                let targetLockerId = currentLocker.lockerId;
                
                if (currentLocker.activeDonation) {
                  const emptyLocker = state.lockers.find(l => !l.activeDonation);
                  if (emptyLocker) {
                    targetLockerId = emptyLocker.lockerId;
                    dispatch({ type: "select-locker", id: targetLockerId });
                    dispatch({ type: "set-sync-message", message: `Redirecting to available SAFE ${targetLockerId.split('-')[1].toUpperCase()}...` });
                  } else {
                    dispatch({ type: "set-sync-message", message: "All units are currently occupied. Please try again later." });
                    return; // Don't navigate if everything is full
                  }
                } else {
                  dispatch({ type: "set-sync-message", message: t("modeArmedDonor") });
                }
                
                navigate("/donate");
              }}
            />
          </div>
        </motion.div>

        <motion.div 
          className={`mode-card-luxe receiver-card-premium ${currentLocker.activeDonation ? "is-available" : "is-locked"}`}
          variants={{
            hidden: { opacity: 0, x: -20 },
            show: { opacity: 1, x: 0 }
          }}
        >
          <div className="mode-card-visual receiver-visual">
            <div className="visual-glow" />
            <div className="mode-icon-luxe">🍴</div>
          </div>
          <div className="mode-card-info">
            <div className="card-eyebrow">{t("receiverModeTagline")}</div>
            <h3>{t("receiverModeTitle")}</h3>
            <div className={`availability-status ${currentLocker.activeDonation ? "is-ready" : "is-locked"}`}>
              <span className="status-dot" />
              {currentLocker.activeDonation ? t("donationReady") : t("noActiveDonations")}
            </div>
          </div>
          <div className="mode-card-action">
            <SlideConfirm
              label={t("slideToReceiver")}
              completedLabel={t("receiverModeReady")}
              disabled={false}
              onConfirm={() => {
                dispatch({
                  type: "set-sync-message",
                  message: currentLocker.activeDonation
                    ? t("modeArmedReceiver")
                    : t("modeReceiverLocked")
                });
                navigate("/receive");
              }}
            />
          </div>
        </motion.div>
      </motion.div>

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
