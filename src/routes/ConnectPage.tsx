import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLockerController } from "../features/useLockerController";
import { useAppContext } from "../store/AppContext";
import { useTranslation } from "../store/useTranslation";
import { ScrollReveal } from "../components/ScrollReveal";
import { motion } from "framer-motion";
import { Bluetooth, ShieldCheck, Box, Activity, Database, Check, Loader2, Leaf } from "lucide-react";

type PairingStep = "idle" | "ble_discovery" | "cloud_register" | "state_sync" | "complete" | "error";

export function ConnectPage() {
  const navigate = useNavigate();
  const { state } = useAppContext();
  const { currentLocker, pairLocker, isBusy } = useLockerController();
  const { t } = useTranslation();
  const [pairingStep, setPairingStep] = useState<PairingStep>("idle");

  const steps = useMemo(() => [
    { text: "Hardware Discovery", icon: Bluetooth, key: "ble_discovery" },
    { text: "Cloud Registration", icon: Database, key: "cloud_register" },
    { text: "Security Handshake", icon: ShieldCheck, key: "state_sync" },
    { text: "System Online", icon: Activity, key: "complete" },
  ], []);

  const handlePair = useCallback(async () => {
    setPairingStep("ble_discovery");
    await pairLocker();

    if (state.hasCompletedPairing || !isBusy) {
      setPairingStep("complete");
      setTimeout(() => navigate("/"), 1500);
    }
  }, [pairLocker, navigate, state.hasCompletedPairing, isBusy]);

  const getCurrentStepIndex = (): number => {
    const msg = state.syncMessage.toLowerCase();
    if (msg.includes("cloud connected") || msg.includes("offline mode") || msg.includes("pair")) return 3;
    if (msg.includes("syncing")) return 2;
    if (msg.includes("registering")) return 1;
    if (msg.includes("initiating")) return 0;
    if (pairingStep === "complete") return 3;
    return -1;
  };

  const activeStepIndex = getCurrentStepIndex();

  return (
    <section className="connect-shell-luxe glass-panel-luxe">
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
              const isCompleted = index < activeStepIndex || (index === 3 && pairingStep === "complete");
              const isActive = index === activeStepIndex && isBusy;
              const Icon = step.icon;
              
              return (
                <ScrollReveal 
                  key={index} 
                  delay={0.2 + index * 0.1} 
                  direction="up"
                  className={`step-card-luxe ${isCompleted ? 'is-completed' : ''} ${isActive ? 'is-active' : ''}`}
                >
                  <div className="step-marker-luxe">
                    <div className="step-number">
                      {isCompleted ? <Check size={14} strokeWidth={4} /> : index + 1}
                    </div>
                    {index < steps.length - 1 && <div className="step-line" />}
                  </div>
                  
                  <div className="step-content-luxe">
                    <div className="step-icon-wrapper">
                      <Icon size={20} className={isActive ? "animate-pulse" : ""} />
                    </div>
                    <p className="step-label-luxe">{step.text}</p>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </div>

      <style>{`
        .step-card-luxe.is-active .step-icon-wrapper {
          color: var(--accent);
          background: rgba(var(--accent-rgb), 0.1);
          box-shadow: 0 0 20px rgba(var(--accent-rgb), 0.2);
        }
        .step-card-luxe.is-completed .step-marker-luxe .step-number {
          background: var(--accent);
          color: white;
          border-color: var(--accent);
        }
        .hero-title-luxe .accent-text {
          display: block;
          background: linear-gradient(to right, var(--accent), var(--accent-warm));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
      `}</style>
    </section>
  );
}

