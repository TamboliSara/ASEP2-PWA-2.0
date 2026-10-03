import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  HelpCircle, X, Heart, Package, ArrowDown, ShieldCheck, 
  QrCode, Box, CheckCircle2, Search, HandHeart, 
  Eye, ThumbsUp, Smartphone, List, Lock, Unlock, 
  ArrowRight, PackageOpen, Network, User, ScanFace, 
  Activity, Map, BellRing, Sparkles, Fingerprint, Calendar
} from "lucide-react";
import { useTranslation } from "../../store/useTranslation";

type HelpTab = "diagram" | "donor" | "receiver" | "features";

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
      title: "Pack & Check Food",
      desc: "Ensure food is fresh and properly sealed in a clean container for maximum safety.",
      icon: <Box className="text-amber-400" size={24} />,
      visuals: [<PackageOpen key="1" className="text-amber-400" size={28} />, <ArrowRight key="2" className="text-muted" size={16} />, <ThumbsUp key="3" className="text-emerald-400" size={28} />]
    },
    {
      id: 2,
      title: "Verify & Register",
      desc: "Use secure Face ID or select manually to register your donation items.",
      icon: <ScanFace className="text-rose-400" size={24} />,
      visuals: [<Fingerprint key="1" className="text-rose-400" size={28} />, <ArrowRight key="2" className="text-muted" size={16} />, <List key="3" className="text-indigo-400" size={28} />]
    },
    {
      id: 3,
      title: "Auto-Deposit",
      desc: "The smart locker door will automatically open. Carefully place your item inside.",
      icon: <Unlock className="text-cyan-400" size={24} />,
      visuals: [<Unlock key="1" className="text-cyan-400" size={28} />, <ArrowRight key="2" className="text-muted" size={16} />, <Box key="3" className="text-cyan-400" size={28} />]
    },
    {
      id: 4,
      title: "Secure Closure",
      desc: "Push the door until you hear it lock. System telemetry confirms an airtight seal.",
      icon: <Lock className="text-emerald-400" size={24} />,
      visuals: [<Lock key="1" className="text-emerald-400" size={28} />, <ArrowRight key="2" className="text-muted" size={16} />, <ShieldCheck key="3" className="text-emerald-400" size={28} />]
    }
  ];

  const receiverSteps = [
    {
      id: 1,
      title: "Browse Kiosk UI",
      desc: "Use the interactive Kiosk interface to browse available verified food items.",
      icon: <Search className="text-blue-400" size={24} />,
      visuals: [<Eye key="1" className="text-blue-400" size={28} />, <ArrowRight key="2" className="text-muted" size={16} />, <Search key="3" className="text-indigo-400" size={28} />]
    },
    {
      id: 2,
      title: "Select & Authenticate",
      desc: "Tap your desired item and undergo a rapid biometric check to unlock the unit.",
      icon: <HandHeart className="text-amber-400" size={24} />,
      visuals: [<Smartphone key="1" className="text-slate-400" size={28} />, <ArrowRight key="2" className="text-muted" size={16} />, <ScanFace key="3" className="text-rose-400" size={28} />]
    },
    {
      id: 3,
      title: "Retrieve & Close",
      desc: "The designated locker opens automatically. Retrieve the food and close securely.",
      icon: <CheckCircle2 className="text-emerald-400" size={24} />,
      visuals: [<Unlock key="1" className="text-amber-400" size={28} />, <ArrowRight key="2" className="text-muted" size={16} />, <Lock key="3" className="text-emerald-400" size={28} />]
    }
  ];

  const renderFeatures = () => (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      gap: '1rem',
      padding: '0.5rem'
    }}>
      {[
        {
          id: "fda-fsma",
          title: "FDA FSMA Compliance",
          desc: "Focuses on preventing foodborne illnesses through preventive controls rather than just reacting.",
          icon: ShieldCheck,
          color: "var(--primary)"
        },
        {
          id: "fda-haccp",
          title: "FDA HACCP Standards",
          desc: "Management system addressing food safety through analysis and control of biological and physical hazards.",
          icon: Activity,
          color: "var(--success)"
        },
        {
          id: "fda-labeling",
          title: "FDA Labeling Rules",
          desc: "Strict requirements for declaring nutritional content, allergens, and clear ingredient transparency.",
          icon: List,
          color: "var(--warning)"
        },
        {
          id: "fssai-license",
          title: "FSSAI Licensing",
          desc: "Mandatory statutory registration for all Food Business Operators (FBOs) to ensure legal accountability.",
          icon: CheckCircle2,
          color: "var(--info)"
        },
        {
          id: "fssai-hygiene",
          title: "FSSAI Schedule 4",
          desc: "Rigorous general hygienic and sanitary practices required for safe food processing and handling.",
          icon: ThumbsUp,
          color: "var(--accent)"
        },
        {
          id: "fssai-recall",
          title: "FSSAI Food Recall",
          desc: "Rapid response protocols to quickly remove unsafe or misbranded food items from the distribution network.",
          icon: BellRing,
          color: "var(--accent-warm)"
        }
      ].map((feature, idx) => (
        <motion.div
          key={feature.id}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.1 }}
          whileHover={{ y: -4, scale: 1.02 }}
          style={{
            background: 'var(--panel-elevated)',
            border: '1px solid var(--line)',
            borderRadius: '20px',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{
            background: 'var(--bg)',
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--line)'
          }}>
            <feature.icon size={24} style={{ color: feature.color }} />
          </div>
          <div>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.05rem', color: 'var(--text)' }}>
              {feature.title}
            </h4>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              {feature.desc}
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  );

  const renderDiagram = () => (
    <div className="process-diagram-container" style={{
      display: 'flex', flexDirection: 'column', gap: '2rem', padding: '0.5rem'
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
          gap: '1rem', overflowX: 'auto', paddingBottom: '1rem', paddingTop: '0.5rem',
          scrollbarWidth: 'none'
        }}>
          {[
            { icon: User, label: "Donor", desc: "Initiates", color: "text-amber-500" },
            { icon: PackageOpen, label: "Pack", desc: "Seals Food", color: "text-emerald-500" },
            { icon: ScanFace, label: "Verify", desc: "Face ID", color: "text-indigo-500" },
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
                  <ArrowRight size={24} className="text-muted" style={{ opacity: 0.8 }} />
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
          gap: '1rem', overflowX: 'auto', paddingBottom: '1rem', paddingTop: '0.5rem',
          scrollbarWidth: 'none'
        }}>
          {[
            { icon: Activity, label: "Ready", desc: "Verified UI", color: "text-emerald-500" },
            { icon: Search, label: "Browse", desc: "Kiosk", color: "text-indigo-500" },
            { icon: ScanFace, label: "Unlock", desc: "Biometrics", color: "text-amber-500" },
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
                  <ArrowRight size={24} className="text-muted" style={{ opacity: 0.8 }} />
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
        data-tour="universal-help"
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
          <div 
            className="help-widget-modal-overlay"
            style={{
              position: 'fixed', inset: 0, zIndex: 1000,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '1rem'
            }}
          >
            <motion.div
              className="help-widget-modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
                backdropFilter: 'blur(8px)', zIndex: 0
              }}
            />
            <motion.div
              className="help-widget-modal-content surface-card"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", bounce: 0.2 }}
              style={{
                position: 'relative',
                zIndex: 1,
                width: '100%', maxWidth: '650px',
                maxHeight: 'calc(100vh - 2rem)',
                overflowY: 'auto',
                padding: '0',
                display: 'flex', flexDirection: 'column',
                background: 'var(--panel)',
                borderRadius: '32px',
                border: '1px solid var(--line)',
                boxShadow: 'var(--shadow-lg)'
              }}
            >
              <div style={{
                padding: '1.5rem 2rem', borderBottom: '1px solid var(--line)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'var(--panel-elevated)'
              }}>
                <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                  <div style={{
                    background: 'var(--primary-light)', padding: '1rem',
                    borderRadius: '16px', color: 'var(--primary)'
                  }}>
                    <HelpCircle size={28} />
                  </div>
                  <div>
                    <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.75rem', fontWeight: 800, color: 'var(--text)' }}>System Guide</h2>
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '1rem' }}>Smart Food Exchange & Features</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      window.dispatchEvent(new CustomEvent('start-website-tour'));
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      background: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      borderRadius: '99px',
                      padding: '0.55rem 1.15rem',
                      color: 'var(--accent, #10b981)',
                      fontWeight: 800,
                      fontSize: '0.82rem',
                      cursor: 'pointer'
                    }}
                  >
                    <Sparkles size={14} />
                    <span>Interactive Tour</span>
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    style={{
                      background: 'var(--bg)', border: '1px solid var(--line)',
                      width: '48px', height: '48px', borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', color: 'var(--text)'
                    }}
                    aria-label="Close Help"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div style={{ padding: '1.25rem 2rem 0 2rem' }}>
                <div style={{
                  display: 'flex', gap: '0.5rem', background: 'var(--bg)',
                  padding: '0.5rem', borderRadius: '20px', border: '1px solid var(--line)',
                  overflowX: 'auto', scrollbarWidth: 'none'
                }}>
                  {[
                    { id: "diagram", icon: Network, label: "Architecture" },
                    { id: "donor", icon: Heart, label: "Donate Flow" },
                    { id: "receiver", icon: Package, label: "Receive Flow" },
                    { id: "features", icon: ShieldCheck, label: "Food Policies" }
                  ].map((tab) => (
                    <button 
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as HelpTab)}
                      style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        gap: '0.5rem', padding: '0.85rem 1.25rem',
                        borderRadius: '14px', border: 'none',
                        background: activeTab === tab.id ? 'var(--text)' : 'transparent',
                        color: activeTab === tab.id ? 'var(--bg)' : 'var(--text-muted)',
                        fontWeight: activeTab === tab.id ? 700 : 500,
                        cursor: 'pointer', transition: 'all 0.2s',
                        boxShadow: activeTab === tab.id ? 'var(--shadow-sm)' : 'none',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <tab.icon size={18} />
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ padding: '1.5rem 2rem 2rem 2rem', overflowY: 'auto' }}>
                <AnimatePresence mode="wait">
                  <motion.div 
                    key={activeTab}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    {activeTab === "features" && renderFeatures()}
                    {activeTab === "diagram" && renderDiagram()}
                    {(activeTab === "donor" || activeTab === "receiver") && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {(activeTab === "donor" ? donorSteps : receiverSteps).map((step, idx, arr) => (
                          <div key={step.id}>
                            <motion.div 
                              whileHover={{ scale: 1.01, x: 5 }}
                              style={{
                                background: 'var(--panel-elevated)', border: '1px solid var(--line)',
                                borderRadius: '24px', padding: '1.5rem', display: 'flex', gap: '1.5rem',
                                alignItems: 'center', boxShadow: 'var(--shadow-sm)'
                              }}
                            >
                              <div style={{
                                width: '60px', height: '60px', borderRadius: '18px',
                                background: 'var(--bg)', border: '1px solid var(--line)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0, fontSize: '1.25rem', fontWeight: 800,
                                color: 'var(--text)'
                              }}>
                                {step.id}
                              </div>
                              <div style={{ flex: 1 }}>
                                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  {step.icon} {step.title}
                                </h4>
                                <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: '1.5' }}>
                                  {step.desc}
                                </p>
                                {step.visuals && (
                                  <div style={{ 
                                    display: 'flex', alignItems: 'center', gap: '1rem', 
                                    marginTop: '1rem', padding: '0.75rem 1rem', 
                                    background: 'var(--bg)', border: '1px solid var(--line)',
                                    borderRadius: '12px', width: 'fit-content'
                                  }}>
                                    {step.visuals.map((visual, i) => (
                                      <span key={i} style={{ display: 'flex', alignItems: 'center' }}>
                                        {visual}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </motion.div>
                            {idx < arr.length - 1 && (
                              <div style={{ display: 'flex', justifyContent: 'center', padding: '0.75rem 0' }}>
                                <ArrowDown size={24} className="text-muted" style={{ opacity: 0.5 }} />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>,
    document.body
  );
}

