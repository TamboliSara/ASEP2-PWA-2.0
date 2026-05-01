import { useNavigate } from "react-router-dom";
import { useLockerController } from "../features/useLockerController";
import { useAppContext } from "../store/AppContext";
import { useTranslation } from "../store/useTranslation";

export function ConnectPage() {
  const navigate = useNavigate();
  const { state } = useAppContext();
  const { currentLocker, pairLocker, isBusy } = useLockerController();
  const { t } = useTranslation();
  const assemblySteps = [t("connectStep1"), t("connectStep2"), t("connectStep3"), t("connectStep4"), t("connectStep5")];

  async function handlePair() {
    await pairLocker();
    navigate("/");
  }

  return (
    <section className="flow-shell connect-shell glass-panel">
      <div className="flow-copy">
        <p className="eyebrow">{t("connectEyebrow")}</p>
        <h2>{t("connectTitle")}</h2>
        <p>{t("connectBody")}</p>
        <div className="button-stack">
          <button className="primary-button" type="button" onClick={handlePair} disabled={isBusy}>
            {isBusy ? t("pairingBusy") : t("connectAction")}
          </button>
        </div>
        {state.syncMessage ? <p className="microcopy">{state.syncMessage}</p> : null}
      </div>
      <div className="assembly-panel">
        <div className="assembly-stage">
          {assemblySteps.map((step, index) => {
            const isCompleted = currentLocker.bleConnected;
            return (
              <article 
                key={step} 
                className={`assembly-step ${isCompleted ? 'is-completed' : ''}`} 
                style={{ animationDelay: `${index * 200}ms` }}
              >
                <div className="step-status-icon">
                  {isCompleted ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                <p>{step}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
