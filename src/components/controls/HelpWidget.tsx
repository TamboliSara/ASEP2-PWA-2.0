import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  HelpCircle, X, Heart, Package, ArrowDown, ShieldCheck, 
  QrCode, Box, CheckCircle2, Search, HandHeart, 
  Eye, ThumbsUp, Smartphone, List, Lock, Unlock, 
  ArrowRight, PackageOpen, Network, User, ScanFace, 
  Activity, BellRing, Sparkles, Fingerprint,
  Zap
} from "lucide-react";
import { useTranslation } from "../../store/useTranslation";

type HelpTab = "diagram" | "donor" | "receiver" | "features";

export function HelpWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<HelpTab>("diagram");
  const { t } = useTranslation();
  const contentBodyRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const handleTabChange = (tabId: HelpTab) => {
    setActiveTab(tabId);
    if (contentBodyRef.current) {
      contentBodyRef.current.scrollTo({ top: 0, behavior: "instant" });
    }
    if (modalRef.current) {
      modalRef.current.scrollTo({ top: 0, behavior: "instant" });
    }
  };

  useEffect(() => {
    if (contentBodyRef.current) {
      contentBodyRef.current.scrollTo({ top: 0, behavior: "instant" });
    }
    if (modalRef.current) {
      modalRef.current.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [activeTab, isOpen]);

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
      title: t("donorStep1Title"),
      desc: t("donorStep1Desc"),
      icon: <PackageOpen className="text-amber-400" size={24} />,
      visuals: [
        <PackageOpen key="1" className="text-amber-400" size={26} />,
        <ArrowRight key="2" className="text-muted" size={16} />,
        <ShieldCheck key="3" className="text-emerald-400" size={26} />,
        <ArrowRight key="4" className="text-muted" size={16} />,
        <ThumbsUp key="5" className="text-cyan-400" size={26} />
      ],
      badges: ["Fresh & Sealed", "Allergen Declaration", "Dietary Tagging"]
    },
    {
      id: 2,
      title: t("donorStep2Title"),
      desc: t("donorStep2Desc"),
      icon: <ScanFace className="text-indigo-400" size={24} />,
      visuals: [
        <ScanFace key="1" className="text-indigo-400" size={26} />,
        <span key="amp" style={{ fontWeight: 800, color: 'var(--text-muted)', fontSize: '0.95rem', margin: '0 0.2rem' }}>&</span>,
        <QrCode key="3" className="text-purple-400" size={26} />,
        <ArrowRight key="4" className="text-muted" size={16} />,
        <Smartphone key="5" className="text-blue-400" size={26} />
      ],
      badges: ["Face ID & QR Passkey", "Apple Face-ID", "Fast2SMS Phone OTP"]
    },
    {
      id: 3,
      title: t("donorStep3Title"),
      desc: t("donorStep3Desc"),
      icon: <Unlock className="text-cyan-400" size={24} />,
      visuals: [
        <Unlock key="1" className="text-cyan-400" size={26} />,
        <ArrowRight key="2" className="text-muted" size={16} />,
        <Box key="3" className="text-amber-400" size={26} />,
        <ArrowRight key="4" className="text-muted" size={16} />,
        <Sparkles key="5" className="text-emerald-400" size={26} />
      ],
      badges: ["12V Solenoid Retraction", "5s Auto-Window", "Illuminated Chamber"]
    },
    {
      id: 4,
      title: t("donorStep4Title"),
      desc: t("donorStep4Desc"),
      icon: <Eye className="text-emerald-400" size={24} />,
      visuals: [
        <Eye key="1" className="text-purple-400" size={26} />,
        <ArrowRight key="2" className="text-muted" size={16} />,
        <Activity key="3" className="text-cyan-400" size={26} />,
        <ArrowRight key="4" className="text-muted" size={16} />,
        <Lock key="5" className="text-emerald-400" size={26} />
      ],
      badges: ["YOLOv8 AI Detection", "Ultrasonic Echo (<34cm)", "Anti-Ghost Alarm"]
    }
  ];

  const receiverSteps = [
    {
      id: 1,
      title: t("receiverStep1Title"),
      desc: t("receiverStep1Desc"),
      icon: <Search className="text-blue-400" size={24} />,
      visuals: [
        <Eye key="1" className="text-blue-400" size={26} />,
        <ArrowRight key="2" className="text-muted" size={16} />,
        <Activity key="3" className="text-emerald-400" size={26} />,
        <ArrowRight key="4" className="text-muted" size={16} />,
        <Search key="5" className="text-indigo-400" size={26} />
      ],
      badges: ["Live Temp & VOC", "TinyML Quality Index (QI)", "Lifespan Countdown"]
    },
    {
      id: 2,
      title: t("receiverStep2Title"),
      desc: t("receiverStep2Desc"),
      icon: <ScanFace className="text-purple-400" size={24} />,
      visuals: [
        <ScanFace key="1" className="text-purple-400" size={26} />,
        <ArrowRight key="2" className="text-muted" size={16} />,
        <Fingerprint key="3" className="text-rose-400" size={26} />,
        <ArrowRight key="4" className="text-muted" size={16} />,
        <ShieldCheck key="5" className="text-emerald-400" size={26} />
      ],
      badges: ["5-Frame Liveness", "128-d Neural Vector", "Anti-Photo Spoof"]
    },
    {
      id: 3,
      title: t("receiverStep3Title"),
      desc: t("receiverStep3Desc"),
      icon: <HandHeart className="text-amber-400" size={24} />,
      visuals: [
        <ShieldCheck key="1" className="text-rose-400" size={26} />,
        <ArrowRight key="2" className="text-muted" size={16} />,
        <HandHeart key="3" className="text-amber-400" size={26} />,
        <ArrowRight key="4" className="text-muted" size={16} />,
        <CheckCircle2 key="5" className="text-emerald-400" size={26} />
      ],
      badges: ["Euclidean Distance (<0.55)", "Max 2 Meals/Day", "Equitable Sharing"]
    },
    {
      id: 4,
      title: t("receiverStep4Title"),
      desc: t("receiverStep4Desc"),
      icon: <Lock className="text-rose-400" size={24} />,
      visuals: [
        <Lock key="1" className="text-rose-400" size={26} />,
        <ArrowRight key="2" className="text-muted" size={16} />,
        <BellRing key="3" className="text-amber-400" size={26} />,
        <ArrowRight key="4" className="text-muted" size={16} />,
        <ShieldCheck key="5" className="text-blue-400" size={26} />
      ],
      badges: ["Hardware Lock (QI < 30%)", "Biochemical Isolation", "Compost Diversion"]
    },
    {
      id: 5,
      title: t("receiverStep5Title"),
      desc: t("receiverStep5Desc"),
      icon: <CheckCircle2 className="text-emerald-400" size={24} />,
      visuals: [
        <Unlock key="1" className="text-cyan-400" size={26} />,
        <ArrowRight key="2" className="text-muted" size={16} />,
        <User key="3" className="text-indigo-400" size={26} />,
        <ArrowRight key="4" className="text-muted" size={16} />,
        <Box key="5" className="text-emerald-400" size={26} />
      ],
      badges: ["Tactile Slide Confirm", "Solenoid Unlock", "Chamber Reset to EMPTY"]
    }
  ];

  const renderFeatures = () => (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      gap: '1rem',
      padding: '0.25rem'
    }}>
      {[
        {
          id: "fda-fsma",
          title: t("policyFdaFsmaTitle"),
          desc: t("policyFdaFsmaDesc"),
          icon: ShieldCheck,
          color: "var(--primary)"
        },
        {
          id: "fda-haccp",
          title: t("policyFdaHaccpTitle"),
          desc: t("policyFdaHaccpDesc"),
          icon: Activity,
          color: "var(--success)"
        },
        {
          id: "fda-labeling",
          title: t("policyFdaLabelingTitle"),
          desc: t("policyFdaLabelingDesc"),
          icon: List,
          color: "var(--warning)"
        },
        {
          id: "fssai-license",
          title: t("policyFssaiLicenseTitle"),
          desc: t("policyFssaiLicenseDesc"),
          icon: CheckCircle2,
          color: "var(--info)"
        },
        {
          id: "fssai-hygiene",
          title: t("policyFssaiHygieneTitle"),
          desc: t("policyFssaiHygieneDesc"),
          icon: ThumbsUp,
          color: "var(--accent)"
        },
        {
          id: "fssai-recall",
          title: t("policyFssaiRecallTitle"),
          desc: t("policyFssaiRecallDesc"),
          icon: BellRing,
          color: "#f43f5e"
        }
      ].map((feature, idx) => (
        <motion.div
          key={feature.id}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.08 }}
          whileHover={{ y: -3 }}
          style={{
            background: 'var(--panel-elevated)',
            border: '1px solid var(--line)',
            borderRadius: '20px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{
            background: 'var(--bg)',
            width: '44px',
            height: '44px',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--line)'
          }}>
            <feature.icon size={22} style={{ color: feature.color }} />
          </div>
          <div>
            <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '1.02rem', color: 'var(--text)', fontWeight: 800 }}>
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
      display: 'flex', flexDirection: 'column', gap: '2rem', padding: '0.25rem'
    }}>
      {/* Donor Flow Row */}
      <div className="diagram-section">
        <h4 style={{ 
          margin: '0 0 0.75rem 0', color: 'var(--accent)', fontSize: '1.05rem', 
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800
        }}>
          <Heart size={20} /> {t("donorProcedure")}
        </h4>
        <div style={{ 
          display: 'flex', alignItems: 'center', flexWrap: 'nowrap', 
          gap: '0.85rem', overflowX: 'auto', paddingBottom: '0.75rem', paddingTop: '0.25rem',
          scrollbarWidth: 'none'
        }}>
          {[
            { icon: User, label: t("diagramDonor"), desc: t("diagramInitiates"), color: "text-amber-500" },
            { icon: PackageOpen, label: t("diagramPack"), desc: t("diagramSealsFood"), color: "text-emerald-500" },
            { icon: ScanFace, label: t("diagramVerify"), desc: t("diagramFaceId"), color: "text-indigo-500" },
            { icon: Box, label: t("diagramDeposit"), desc: t("diagramLockerLocks"), color: "text-cyan-500" },
            { icon: Eye, label: t("diagramAiVision"), desc: t("diagramVisionCheck"), color: "text-purple-500" },
            { icon: Lock, label: t("diagramSecure"), desc: t("diagramAirtight"), color: "text-emerald-500" }
          ].map((node, i, arr) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, type: "spring", stiffness: 100 }}
                whileHover={{ scale: 1.05, y: -4 }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.65rem',
                  padding: '1.15rem 0.5rem', background: 'var(--panel-elevated)',
                  border: '1px solid var(--line)', borderRadius: '18px',
                  width: '98px', textAlign: 'center',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                <div style={{ 
                  padding: '0.75rem', background: 'var(--bg)', 
                  borderRadius: '12px', border: '1px solid var(--line)',
                  boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.02)'
                }}>
                  <node.icon size={24} className={node.color} />
                </div>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text)' }}>{node.label}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '0.15rem' }}>{node.desc}</div>
                </div>
              </motion.div>
              {i < arr.length - 1 && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: (i * 0.1) + 0.05 }}
                >
                  <ArrowRight size={20} className="text-muted" style={{ opacity: 0.6 }} />
                </motion.div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ width: '100%', height: '1px', background: 'var(--line)' }} />

      {/* Receiver Flow Row */}
      <div className="diagram-section">
        <h4 style={{ 
          margin: '0 0 0.75rem 0', color: '#60A5FA', fontSize: '1.05rem', 
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800
        }}>
          <Package size={20} /> {t("receiverProcedure")}
        </h4>
        <div style={{ 
          display: 'flex', alignItems: 'center', flexWrap: 'nowrap', 
          gap: '0.85rem', overflowX: 'auto', paddingBottom: '0.75rem', paddingTop: '0.25rem',
          scrollbarWidth: 'none'
        }}>
          {[
            { icon: Activity, label: t("diagramTelemetry"), desc: t("diagramBmeTinyMl"), color: "text-emerald-500" },
            { icon: Search, label: t("diagramBrowse"), desc: t("diagramKiosk"), color: "text-indigo-500" },
            { icon: ScanFace, label: t("diagramLiveness"), desc: t("diagramFaceVector"), color: "text-purple-500" },
            { icon: ShieldCheck, label: t("diagramQuota"), desc: t("diagramAntiHoarding"), color: "text-rose-500" },
            { icon: Unlock, label: t("diagramUnlock"), desc: t("diagramCollectFood"), color: "text-cyan-500" },
            { icon: CheckCircle2, label: t("diagramReset"), desc: t("diagramEmptyChamber"), color: "text-blue-500" }
          ].map((node, i, arr) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + (i * 0.1), type: "spring", stiffness: 100 }}
                whileHover={{ scale: 1.05, y: -4 }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.65rem',
                  padding: '1.15rem 0.5rem', background: 'var(--panel-elevated)',
                  border: '1px solid var(--line)', borderRadius: '18px',
                  width: '98px', textAlign: 'center',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                <div style={{ 
                  padding: '0.75rem', background: 'var(--bg)', 
                  borderRadius: '12px', border: '1px solid var(--line)',
                  boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.02)'
                }}>
                  <node.icon size={24} className={node.color} />
                </div>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text)' }}>{node.label}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '0.15rem' }}>{node.desc}</div>
                </div>
              </motion.div>
              {i < arr.length - 1 && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 + (i * 0.1) + 0.05 }}
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
        data-tour="universal-help"
        className="help-widget-trigger"
        onClick={() => setIsOpen(true)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        aria-label={t("systemGuide")}
      >
        <HelpCircle size={28} />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <div 
            className="help-widget-modal-overlay"
            style={{
              position: 'fixed', inset: 0, zIndex: 10000,
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
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                backdropFilter: 'blur(10px)', zIndex: 0
              }}
            />
            <motion.div
              ref={modalRef}
              className="help-widget-modal-content surface-card"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", bounce: 0.15 }}
              style={{
                position: 'relative',
                zIndex: 1,
                width: '100%', maxWidth: '720px',
                maxHeight: 'min(90vh, 760px)',
                height: 'min(90vh, 760px)',
                overflow: 'hidden',
                padding: '0',
                display: 'flex', flexDirection: 'column',
                background: 'var(--panel)',
                borderRadius: '32px',
                border: '1px solid var(--line)',
                boxShadow: 'var(--shadow-lg)'
              }}
            >
              {/* Header */}
              <div style={{
                flexShrink: 0,
                padding: '1.5rem 1.75rem', borderBottom: '1px solid var(--line)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'var(--panel-elevated)', flexWrap: 'wrap', gap: '1rem'
              }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div style={{
                    background: 'rgba(16, 185, 129, 0.12)', padding: '0.85rem',
                    borderRadius: '16px', color: '#10b981',
                    border: '1px solid rgba(16, 185, 129, 0.25)'
                  }}>
                    <HelpCircle size={26} />
                  </div>
                  <div>
                    <h2 style={{ margin: '0 0 0.2rem 0', fontSize: '1.6rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                      {t("systemGuide")}
                    </h2>
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.92rem', fontWeight: 500 }}>
                      {t("systemGuideSubtitle")}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      window.dispatchEvent(new CustomEvent('start-website-tour'));
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      background: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      borderRadius: '99px',
                      padding: '0.55rem 1.15rem',
                      color: 'var(--accent, #10b981)',
                      fontWeight: 800,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Sparkles size={15} />
                    <span>{t("interactiveTour")}</span>
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    style={{
                      background: 'var(--bg)', border: '1px solid var(--line)',
                      width: '44px', height: '44px', borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', color: 'var(--text)'
                    }}
                    aria-label="Close Help"
                  >
                    <X size={22} />
                  </button>
                </div>
              </div>

              {/* Tabs Navigation */}
              <div style={{ flexShrink: 0, padding: '1rem 1.75rem 0 1.75rem' }}>
                <div style={{
                  display: 'flex', gap: '0.35rem', background: 'var(--bg)',
                  padding: '0.4rem', borderRadius: '18px', border: '1px solid var(--line)',
                  overflowX: 'auto', scrollbarWidth: 'none'
                }}>
                  {[
                    { id: "diagram", icon: Network, label: t("tabArchitecture") },
                    { id: "donor", icon: Heart, label: t("tabDonateFlow") },
                    { id: "receiver", icon: Package, label: t("tabReceiveFlow") },
                    { id: "features", icon: ShieldCheck, label: t("tabFoodPolicies") }
                  ].map((tab) => (
                    <button 
                      key={tab.id}
                      onClick={() => handleTabChange(tab.id as HelpTab)}
                      style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        gap: '0.45rem', padding: '0.75rem 1rem',
                        borderRadius: '13px', border: 'none',
                        background: activeTab === tab.id ? 'var(--text)' : 'transparent',
                        color: activeTab === tab.id ? 'var(--bg)' : 'var(--text-muted)',
                        fontWeight: activeTab === tab.id ? 800 : 600,
                        fontSize: '0.82rem',
                        cursor: 'pointer', transition: 'all 0.2s',
                        boxShadow: activeTab === tab.id ? 'var(--shadow-sm)' : 'none',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <tab.icon size={16} />
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Content Body */}
              <div 
                ref={contentBodyRef}
                style={{ 
                  padding: '1.25rem 1.75rem 1.75rem 1.75rem', 
                  flex: 1,
                  minHeight: 0,
                  overflowY: 'auto' 
                }}
              >
                <AnimatePresence mode="wait">
                  <motion.div 
                    key={activeTab}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.18 }}
                  >
                    {activeTab === "diagram" && renderDiagram()}
                    {activeTab === "features" && renderFeatures()}
                    {(activeTab === "donor" || activeTab === "receiver") && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {(activeTab === "donor" ? donorSteps : receiverSteps).map((step, idx, arr) => (
                          <div key={step.id}>
                            <motion.div 
                              whileHover={{ scale: 1.01, x: 4 }}
                              style={{
                                background: 'var(--panel-elevated)', border: '1px solid var(--line)',
                                borderRadius: '22px', padding: '1.35rem', display: 'flex', gap: '1.25rem',
                                alignItems: 'flex-start', boxShadow: 'var(--shadow-sm)'
                              }}
                            >
                              <div style={{
                                width: '52px', height: '52px', borderRadius: '16px',
                                background: 'var(--bg)', border: '1px solid var(--line)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0, fontSize: '1.15rem', fontWeight: 900,
                                color: 'var(--text)'
                              }}>
                                {step.id}
                              </div>
                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                  <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800 }}>
                                    {step.icon} {step.title}
                                  </h4>
                                </div>
                                
                                <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: '1.55', fontSize: '0.88rem' }}>
                                  {step.desc}
                                </p>

                                {step.badges && (
                                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                                    {step.badges.map((badge, bIdx) => (
                                      <span key={bIdx} style={{
                                        fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.6rem',
                                        borderRadius: '99px', background: 'var(--bg)', color: 'var(--text-muted)',
                                        border: '1px solid var(--line)'
                                      }}>
                                        {badge}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {step.visuals && (
                                  <div style={{ 
                                    display: 'flex', alignItems: 'center', gap: '0.75rem', 
                                    marginTop: '0.5rem', padding: '0.6rem 0.9rem', 
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
                              <div style={{ display: 'flex', justifyContent: 'center', padding: '0.5rem 0' }}>
                                <ArrowDown size={20} className="text-muted" style={{ opacity: 0.4 }} />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Modal Footer Banner */}
              <div style={{
                flexShrink: 0,
                padding: '1rem 1.75rem',
                borderTop: '1px solid var(--line)',
                background: 'var(--panel-elevated)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Zap size={16} className="text-amber-400" />
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Dual-Redundant Sensing & Zero Ghost Donations
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ShieldCheck size={16} className="text-emerald-400" />
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Anti-Hoarding Protected (Max 2 Meals/Day)
                  </span>
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
