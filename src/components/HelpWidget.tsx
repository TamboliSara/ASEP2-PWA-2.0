import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  HelpCircle, X, Heart, Package, ArrowDown, ShieldCheck, 
  QrCode, ClipboardCheck, Box, CheckCircle2, Search, 
  HandHeart, ShoppingBag, Eye, ThumbsUp, Smartphone, 
  List, Lock, Unlock, ArrowRight, PackageOpen, Network, User
} from "lucide-react";
import { useTranslation } from "../store/useTranslation";

type HelpTab = "donor" | "receiver" | "diagram";

export function HelpWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<HelpTab>("diagram");
  const { t } = useTranslation();

  useEffect(() => {
    setMounted(true);
    const handleOpen = () => setIsOpen(true);
    window.addEventListener("open-help-widget", handleOpen);
    
    return () => {
      setMounted(false);
      window.removeEventListener("open-help-widget", handleOpen);
    };
  }, []);

  if (!mounted) return null;

  const donorSteps = [
    {
      id: 1,
      title: "1. Pack & Check Food",
      desc: "Put fresh, safe food in a clean box or bag. Close it tight to keep it clean.",
      icon: <Box className="text-amber-400" size={24} />,
      visuals: [<PackageOpen key="1" className="text-amber-400" size={28} />, <ArrowRight key="2" className="text-muted" size={16} />, <ThumbsUp key="3" className="text-emerald-400" size={28} />]
    },
    {
      id: 2,
      title: "2. Tap Screen",
      desc: "Look at the screen. Touch the big 'Donate' button and pick your food picture.",
      icon: <HandHeart className="text-rose-400" size={24} />,
      visuals: [<Smartphone key="1" className="text-slate-400" size={28} />, <ArrowRight key="2" className="text-muted" size={16} />, <List key="3" className="text-indigo-400" size={28} />]
    },
    {
      id: 3,
      title: "3. Put Food Inside",
      desc: "A locker door will open automatically. Put your food box inside carefully.",
      icon: <Unlock className="text-cyan-400" size={24} />,
      visuals: [<Unlock key="1" className="text-amber-400" size={28} />, <ArrowRight key="2" className="text-muted" size={16} />, <Box key="3" className="text-cyan-400" size={28} />]
    },
    {
      id: 4,
      title: "4. Push Door Closed",
      desc: "Push the door closed until you hear a 'click'. Thank you for sharing!",
      icon: <Lock className="text-emerald-400" size={24} />,
      visuals: [<Lock key="1" className="text-emerald-400" size={28} />, <ArrowRight key="2" className="text-muted" size={16} />, <Heart key="3" className="text-rose-400" size={28} />]
    }
  ];

  const receiverSteps = [
    {
      id: 1,
      title: "1. Look at Screen",
      desc: "Look at the screen to see what food is inside the lockers today.",
      icon: <Eye className="text-blue-400" size={24} />,
      visuals: [<Eye key="1" className="text-blue-400" size={28} />, <ArrowRight key="2" className="text-muted" size={16} />, <Search key="3" className="text-indigo-400" size={28} />]
    },
    {
      id: 2,
      title: "2. Choose Your Food",
      desc: "Touch the picture of the food you want on the screen.",
      icon: <HandHeart className="text-amber-400" size={24} />,
      visuals: [<Smartphone key="1" className="text-slate-400" size={28} />, <ArrowRight key="2" className="text-muted" size={16} />, <CheckCircle2 key="3" className="text-emerald-400" size={28} />]
    },
    {
      id: 3,
      title: "3. Take Food & Close",
      desc: "The door will open. Take your food and push the door closed. Enjoy!",
      icon: <Unlock className="text-emerald-400" size={24} />,
      visuals: [<Unlock key="1" className="text-amber-400" size={28} />, <ArrowRight key="2" className="text-muted" size={16} />, <Lock key="3" className="text-emerald-400" size={28} />]
    }
  ];

  const renderDiagram = () => (
    <div className="process-diagram-container" style={{
      display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1rem',
      background: 'var(--panel-elevated)', borderRadius: '24px', border: '1px solid var(--line)'
    }}>
      <div className="diagram-section">
        <h4 style={{ 
          margin: '0 0 0.75rem 0', color: 'var(--accent)', fontSize: '1.1rem', 
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          textTransform: 'uppercase', letterSpacing: '0.1em'
        }}>
          <Heart size={20} /> Donor Procedure
        </h4>
        <div style={{ 
          display: 'flex', alignItems: 'center', flexWrap: 'nowrap', 
          gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem',
          scrollbarWidth: 'none'
        }}>
          {[
            { icon: User, label: "Donor", desc: "Initiates", color: "text-amber-500" },
            { icon: PackageOpen, label: "Pack", desc: "Seals Food", color: "text-emerald-500" },
            { icon: Smartphone, label: "Input", desc: "Registers", color: "text-indigo-500" },
            { icon: Box, label: "Deposit", desc: "Locker Locks", color: "text-cyan-500" }
          ].map((node, i, arr) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.15, type: "spring", stiffness: 100 }}
                whileHover={{ scale: 1.05, y: -5 }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem',
                  padding: '1.25rem 0.5rem', background: 'var(--panel)',
                  border: '1px solid var(--line)', borderRadius: '20px',
                  width: '100px', textAlign: 'center',
                  boxShadow: 'var(--shadow-card)'
                }}
              >
                <div style={{ 
                  padding: '0.8rem', background: 'var(--bg)', 
                  borderRadius: '14px', border: '1px solid var(--line)',
                  boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.02)'
                }}>
                  <node.icon size={26} className={node.color} />
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text)' }}>{node.label}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.2rem' }}>{node.desc}</div>
                </div>
              </motion.div>
              {i < arr.length - 1 && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: (i * 0.15) + 0.1 }}
                >
                  <ArrowRight size={20} className="text-muted" style={{ opacity: 0.6 }} />
                </motion.div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ width: '100%', height: '1px', background: 'var(--line)' }} />

      <div className="diagram-section">
        <h4 style={{ 
          margin: '0 0 0.75rem 0', color: '#60A5FA', fontSize: '1.1rem', 
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          textTransform: 'uppercase', letterSpacing: '0.1em'
        }}>
          <Package size={20} /> Receiver Procedure
        </h4>
        <div style={{ 
          display: 'flex', alignItems: 'center', flexWrap: 'nowrap', 
          gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem',
          scrollbarWidth: 'none'
        }}>
          {[
            { icon: Box, label: "Ready", desc: "Verified Food", color: "text-emerald-500" },
            { icon: Search, label: "Browse", desc: "Kiosk UI", color: "text-indigo-500" },
            { icon: Smartphone, label: "Select", desc: "Unlocks", color: "text-amber-500" },
            { icon: User, label: "Collect", desc: "Takes Food", color: "text-blue-500" }
          ].map((node, i, arr) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + (i * 0.15), type: "spring", stiffness: 100 }}
                whileHover={{ scale: 1.05, y: -5 }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem',
                  padding: '1.25rem 0.5rem', background: 'var(--panel)',
                  border: '1px solid var(--line)', borderRadius: '20px',
                  width: '100px', textAlign: 'center',
                  boxShadow: 'var(--shadow-card)'
                }}
              >
                <div style={{ 
                  padding: '0.8rem', background: 'var(--bg)', 
                  borderRadius: '14px', border: '1px solid var(--line)',
                  boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.02)'
                }}>
                  <node.icon size={26} className={node.color} />
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text)' }}>{node.label}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.2rem' }}>{node.desc}</div>
                </div>
              </motion.div>
              {i < arr.length - 1 && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 + (i * 0.15) + 0.1 }}
                >
                  <ArrowRight size={20} className="text-muted" style={{ opacity: 0.6 }} />
                </motion.div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return createPortal(
    <>
      <motion.button
        className="help-widget-trigger"
        onClick={() => setIsOpen(true)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        aria-label="Help & Guide"
      >
        <HelpCircle size={28} />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <div className="help-widget-modal-overlay">
            <motion.div
              className="help-widget-modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              className="help-widget-modal-content surface-card"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", bounce: 0.2 }}
            >
              <div className="help-widget-header">
                <div className="help-widget-title-area">
                  <div className="help-icon-wrapper">
                    <HelpCircle className="text-accent" size={24} />
                  </div>
                  <div>
                    <h2 className="help-widget-title">Process Guide</h2>
                    <p className="help-widget-subtitle">Smart Food Exchange Flow</p>
                  </div>
                </div>
                <button
                  className="help-widget-close"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close Help"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="help-widget-tabs">
                <button 
                  className={`help-tab-btn ${activeTab === "diagram" ? "active" : ""}`}
                  onClick={() => setActiveTab("diagram")}
                >
                  <Network size={18} />
                  <span>Block Diagram</span>
                  {activeTab === "diagram" && (
                    <motion.div layoutId="activeTab" className="active-tab-indicator" />
                  )}
                </button>
                <button 
                  className={`help-tab-btn ${activeTab === "donor" ? "active" : ""}`}
                  onClick={() => setActiveTab("donor")}
                >
                  <Heart size={18} />
                  <span>Donor Flow</span>
                  {activeTab === "donor" && (
                    <motion.div layoutId="activeTab" className="active-tab-indicator" />
                  )}
                </button>
                <button 
                  className={`help-tab-btn ${activeTab === "receiver" ? "active" : ""}`}
                  onClick={() => setActiveTab("receiver")}
                >
                  <Package size={18} />
                  <span>Receiver Flow</span>
                  {activeTab === "receiver" && (
                    <motion.div layoutId="activeTab" className="active-tab-indicator" />
                  )}
                </button>
              </div>

              <div className="help-widget-body">
                <AnimatePresence mode="wait">
                  <motion.div 
                    key={activeTab}
                    initial={{ opacity: 0, x: activeTab === "donor" ? -20 : 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: activeTab === "donor" ? 20 : -20 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="help-flow-section"
                  >
                    <div className="help-steps">
                      {activeTab === "diagram" ? (
                        renderDiagram()
                      ) : (
                        (activeTab === "donor" ? donorSteps : receiverSteps).map((step, idx) => (
                          <div key={step.id} className="help-step-container">
                            <motion.div 
                              className="help-step-premium"
                              whileHover={{ scale: 1.02, backgroundColor: "rgba(255, 255, 255, 0.05)" }}
                            >
                              <div className="step-number-premium">
                                {step.id}
                              </div>
                              <div className="step-icon-premium">
                                {step.icon}
                              </div>
                              <div className="step-content-premium">
                                <h4>{step.title}</h4>
                                <p>{step.desc}</p>
                                {step.visuals && (
                                  <div className="step-visuals" style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '1rem', 
                                    marginTop: '1rem', 
                                    padding: '0.75rem 1rem', 
                                    background: 'rgba(255, 255, 255, 0.03)', 
                                    border: '1px solid rgba(255, 255, 255, 0.05)',
                                    borderRadius: '12px', 
                                    width: 'fit-content',
                                    boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.1)'
                                  }}>
                                    {step.visuals.map((visual, i) => (
                                      <span key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {visual}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </motion.div>
                            {idx < (activeTab === "donor" ? donorSteps.length - 1 : receiverSteps.length - 1) && (
                              <div className="step-connector-premium">
                                <div className="connector-line" />
                                <ArrowDown className="connector-arrow" size={14} />
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                </AnimatePresence>

                <div className="help-flow-footer-premium">
                  <div className="footer-glow" />
                  <div className="help-footer-item">
                    <ShieldCheck size={18} className="text-accent" />
                    <span>100% Safe & Clean Locker</span>
                  </div>
                  <div className="help-footer-divider" />
                  <div className="help-footer-item">
                    <QrCode size={18} className="text-accent-warm" />
                    <span>24/7 Digital Support</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>,
    document.body
  );
}
