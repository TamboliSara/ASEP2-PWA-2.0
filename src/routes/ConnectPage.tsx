import { useNavigate } from "react-router-dom";
import { useLockerController } from "../features/useLockerController";
import { useAppContext } from "../store/AppContext";
import { useTranslation } from "../store/useTranslation";
import { ScrollReveal } from "../components/ScrollReveal";
import { motion } from "framer-motion";
import { Bluetooth, ShieldCheck, Box, Activity, Database, Check, Loader2 } from "lucide-react";

export function ConnectPage() {
  const navigate = useNavigate();
  const { state } = useAppContext();
  const { currentLocker, pairLocker, isBusy } = useLockerController();
  const { t } = useTranslation();
  
  const steps = [
    { text: t("connectStep1"), icon: Box },
    { text: t("connectStep2"), icon: Activity },
    { text: t("connectStep3"), icon: Bluetooth },
    { text: t("connectStep4"), icon: ShieldCheck },
    { text: t("connectStep5"), icon: Database },
  ];

  async function handlePair() {
    await pairLocker();
    navigate("/");
  }

  return (
    <section className="connect-shell-luxe glass-panel-luxe">
      {/* Ambient Decorative Elements */}
      <div className="ambient-orbs">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
      </div>

      <div className="nature-leaf-accent leaf-top-right">🍃</div>
      <div className="nature-leaf-accent leaf-bottom-left">🌿</div>

      <div className="connect-grid-luxe">
        <ScrollReveal direction="left" className="connect-copy-luxe">
          <div className="eyebrow-badge">
            <span className="pulsing-dot-green" />
            {t("connectEyebrow")}
          </div>
          
          <h1 className="hero-title-luxe">
            {t("connectTitle").split(',').map((part, i) => (
              <span key={i} className={i === 1 ? "accent-text" : ""}>
                {part}{i === 0 && ","}
              </span>
            ))}
          </h1>
          
          <p className="hero-body-luxe">{t("connectBody")}</p>
          
          <div className="connect-actions-luxe">
            <button 
              className={`btn-premium ${isBusy ? 'is-loading' : ''}`} 
              type="button" 
              onClick={handlePair} 
              disabled={isBusy}
            >
              <div className="btn-shine" />
              {isBusy ? (
                <Loader2 className="btn-icon animate-spin" size={22} />
              ) : (
                <Bluetooth className="btn-icon" size={22} />
              )}
              <span>{isBusy ? t("pairingBusy") : t("connectAction")}</span>
            </button>
            
            {state.syncMessage && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }}
                className="status-toast-mini"
              >
                <Database size={14} />
                <span>{state.syncMessage}</span>
              </motion.div>
            )}
          </div>
        </ScrollReveal>

        <div className="connect-visual-luxe">
          <div className="assembly-stepper-luxe">
            {steps.map((step, index) => {
              const isCompleted = currentLocker.bleConnected;
              const Icon = step.icon;
              
              return (
                <ScrollReveal 
                  key={index} 
                  delay={0.2 + index * 0.1} 
                  direction="up"
                  className={`step-card-luxe ${isCompleted ? 'is-completed' : ''}`}
                >
                  <div className="step-marker-luxe">
                    <div className="step-number">{index + 1}</div>
                    <div className="step-line" />
                  </div>
                  
                  <div className="step-content-luxe">
                    <div className="step-icon-wrapper">
                      <Icon size={20} />
                      {isCompleted && (
                        <motion.div 
                          initial={{ scale: 0 }} 
                          animate={{ scale: 1 }} 
                          className="step-check-badge"
                        >
                          <Check size={10} strokeWidth={4} />
                        </motion.div>
                      )}
                    </div>
                    <p className="step-label-luxe">{step.text}</p>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
