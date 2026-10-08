import { useNavigate } from "react-router-dom";
import { Hero } from "@/components/ui/animated-hero";
import { SlideConfirm } from "../components/controls/SlideConfirm";
import { useAppContext } from "../store/AppContext";
import { useTranslation } from "../store/useTranslation";
import { useLockerController } from "../features/locker/useLockerController";
import { ScrollReveal } from "../components/effects/ScrollReveal";


export function ModeSelectPage() {
  const navigate = useNavigate();
  const { state, dispatch } = useAppContext();
  const { currentLocker } = useLockerController();
  const { t } = useTranslation();

    const anyAvailable = state.lockers.some(l => !l.activeDonation);

  return (
    <div className="page-grid mode-select-grid">
      <Hero />

      <div className="mode-selection-stack-luxe">
        <ScrollReveal direction="left" distance={40} delay={0.1}>
          <div className={`mode-card-luxe donor-card-premium ${anyAvailable ? "is-available" : "is-busy"}`}>
            <div className="mode-card-visual donor-visual">
              <div className="visual-glow" />
              <div className="mode-icon-luxe">🎁</div>
            </div>
            <div className="mode-card-info">
              <div className="card-eyebrow">{t("donorModeTagline")}</div>
              <h3>{t("donorModeTitle")}</h3>
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
          </div>
        </ScrollReveal>

        <ScrollReveal direction="right" distance={40} delay={0.2}>
          <div className={`mode-card-luxe receiver-card-premium ${currentLocker.activeDonation ? "is-available" : "is-locked"}`}>
            <div className="mode-card-visual receiver-visual">
              <div className="visual-glow" />
              <div className="mode-icon-luxe">🍴</div>
            </div>
            <div className="mode-card-info">
              <div className="card-eyebrow">{t("receiverModeTagline")}</div>
              <h3>{t("receiverModeTitle")}</h3>
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
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
}

