import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLockerController } from "../features/useLockerController";
import { useAppContext } from "../store/AppContext";
import { useTranslation } from "../store/useTranslation";
import { ScrollReveal } from "../components/ScrollReveal";
import { motion } from "framer-motion";
import { Bluetooth, ShieldCheck, Box, Activity, Database, Check, Loader2, Wifi, AlertCircle } from "lucide-react";
import { HARDWARE_LOCKER_ID } from "../store/appState";

type PairingStep = "idle" | "ble_discovery" | "cloud_register" | "state_sync" | "complete" | "error";

export function ConnectPage() {
  const navigate = useNavigate();
  const { state } = useAppContext();
  const { currentLocker, pairLocker, isBusy } = useLockerController();
  const { t } = useTranslation();
  const [pairingStep, setPairingStep] = useState<PairingStep>("idle");
  const [pairingCancelled, setPairingCancelled] = useState(false);

  const isRealHardwarePaired = !!state.hardwareMac && state.hardwareMac !== "SIMULATED" && state.hardwareMac !== "";

  const steps = useMemo(() => [
    { text: "Hardware Discovery (BLE)", icon: Bluetooth,   key: "ble_discovery" },
    { text: "Cloud Registration",       icon: Database,     key: "cloud_register" },
    { text: "Security Handshake",       icon: ShieldCheck,  key: "state_sync" },
    { text: "System Online",            icon: Activity,     key: "complete" },
  ], []);

  const handlePair = useCallback(async () => {
    setPairingCancelled(false);
    setPairingStep("ble_discovery");
    const success = await pairLocker();

    if (success) {
      setPairingStep("complete");
      setTimeout(() => navigate("/", { replace: true }), 1800);
    } else {
      // Check if cancelled vs error
      if (state.syncMessage.includes("cancelled")) {
        setPairingCancelled(true);
        setPairingStep("idle");
      } else {
        setPairingStep("error");
      }
    }
  }, [pairLocker, navigate, state.syncMessage]);

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

          {/* Hardware info box */}
          <div style={{
            background: "rgba(var(--accent-rgb), 0.06)",
            border: "1px solid rgba(var(--accent-rgb), 0.2)",
            borderRadius: "12px",
            padding: "12px 16px",
            marginBottom: "16px",
            fontSize: "0.82rem"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", fontWeight: 600 }}>
              <Wifi size={14} />
              <span>System Configuration</span>
            </div>
            <div style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
              🔒 <strong>Chamber 1</strong> — Real ESP32-S3 Hardware
              {isRealHardwarePaired && (
                <span style={{ color: "var(--accent)", marginLeft: 6, fontSize: "0.78rem" }}>
                  (MAC: {state.hardwareMac})
                </span>
              )}
              <br />
              📋 <strong>Chambers 2–8</strong> — Mock simulation (no hardware required)
            </div>
          </div>

          {pairingCancelled && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                display: "flex", gap: "8px", alignItems: "center",
                background: "rgba(255,180,0,0.08)", border: "1px solid rgba(255,180,0,0.3)",
                borderRadius: "8px", padding: "8px 12px", marginBottom: "12px",
                fontSize: "0.82rem", color: "var(--text-muted)"
              }}
            >
              <AlertCircle size={14} style={{ color: "#f59e0b" }} />
              Bluetooth pairing cancelled. Click "Connect" to try again.
            </motion.div>
          )}
          
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

