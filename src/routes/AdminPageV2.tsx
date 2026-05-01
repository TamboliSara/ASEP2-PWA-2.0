import { motion, AnimatePresence } from "framer-motion";
import { 
  ShieldCheck, 
  MoveRight, 
  BarChart3, 
  Activity, 
  Box, 
  Settings, 
  RefreshCcw, 
  Wifi, 
  AlertTriangle, 
  Database,
  Map as MapIcon,
  LogOut,
  Settings2,
  Clock,
  Layers
} from "lucide-react";
import { Link } from "react-router-dom";
import { StatusPill } from "../components/StatusPill";
import { SurfaceCard } from "../components/layout/SurfaceCard";
import { useLockerController } from "../features/useLockerController";
import { useTranslation } from "../store/useTranslation";
import { formatDateTime } from "../utils/format";
import { sampleFleetLockers } from "../utils/mockData";

export function AdminPageV2() {
  const { t } = useTranslation();
  const { state, currentLocker, clearFault, syncNow, reconnectLocker, resetDonations, signOut } = useLockerController();
  const fleet = sampleFleetLockers;

  if (!state.isAdminAuthenticated) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="min-h-[calc(100vh-180px)] flex items-center justify-center w-full max-w-2xl mx-auto"
      >
        <section className="relative overflow-hidden rounded-[2.5rem] border border-line bg-panel/30 backdrop-blur-2xl p-10 md:p-14 shadow-2xl">
          {/* Decorative background elements */}
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-accent/5 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 left-0 -ml-10 -mb-10 w-40 h-40 bg-accent-warm/5 rounded-full blur-[80px]" />
          
          <div className="relative z-10 flex flex-col items-center text-center gap-8">
            <div className="flex flex-col items-center gap-4">
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="w-20 h-20 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-2 shadow-[0_0_30px_rgba(20,184,166,0.1)]"
              >
                <ShieldCheck className="w-10 h-10 text-accent animate-pulse" />
              </motion.div>
              
              <div className="space-y-2">
                <p className="text-[10px] font-black tracking-[0.3em] uppercase text-accent/80 opacity-80">
                  {t("adminAuthRequired")}
                </p>
                <h2 className="text-4xl md:text-5xl font-black tracking-tight text-text">
                  {t("signIn")}
                </h2>
              </div>
            </div>

            <p className="text-lg text-text-muted max-w-md leading-relaxed font-medium">
              {t("adminSignInBody")}
            </p>

            <div className="w-full h-px bg-gradient-to-r from-transparent via-line to-transparent opacity-40" />

            <div className="flex flex-col items-center gap-6 w-full">
              <Link 
                className="group relative flex items-center justify-center gap-3 w-full sm:w-auto px-10 py-5 rounded-full bg-accent hover:bg-accent-hover text-white dark:text-black font-black text-lg transition-all duration-300 shadow-[0_10px_40px_rgba(20,184,166,0.3)] hover:shadow-[0_15px_50px_rgba(20,184,166,0.4)] hover:-translate-y-1 active:translate-y-0"
                to="/admin/sign-in"
              >
                <span>{t("continueSignIn")}</span>
                <MoveRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              
              <div className="flex items-center gap-6 opacity-30">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                  <span className="text-[9px] font-black tracking-widest uppercase text-text">Secure Shell</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent-warm" />
                  <span className="text-[9px] font-black tracking-widest uppercase text-text">Audit Logging</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </motion.div>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] }
    }
  };

  return (
    <motion.div 
      className="page-grid admin-grid"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.section 
        variants={itemVariants}
        className="hero-panel glass-panel compact relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-accent/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-10 -mb-10 w-40 h-40 bg-accent-warm/5 rounded-full blur-[80px] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="hero-copy">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-accent animate-ping absolute" />
              <div className="w-2 h-2 rounded-full bg-accent relative" />
              <p className="eyebrow !mb-0">{t("fleetOverview")}</p>
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-3 bg-gradient-to-r from-text via-text to-accent bg-clip-text text-transparent">
              {t("adminTitle")}
            </h2>
            <p className="text-text-muted font-medium max-w-xl text-lg leading-relaxed">
              {t("adminBody")}
            </p>
          </div>
          
          <div className="hero-actions flex flex-wrap items-center gap-4">
            <div className="hidden sm:flex flex-col items-end mr-4">
              <span className="text-[10px] font-black tracking-widest uppercase text-accent/60">System Core</span>
              <span className="text-xs font-bold text-text">v4.0.2 Stable</span>
            </div>
            <Link 
              className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-panel-elevated border border-line hover:border-accent/30 hover:bg-panel transition-all duration-300 font-black text-xs uppercase tracking-widest shadow-lg hover:-translate-y-1"
              to="/connect"
            >
              <Settings2 className="w-4 h-4 text-accent" />
              <span>{t("connectNav") || "Device Setup"}</span>
            </Link>
            <button 
              className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-danger/5 border border-danger/20 hover:bg-danger/10 text-danger transition-all duration-300 font-black text-xs uppercase tracking-widest hover:-translate-y-1"
              type="button" 
              onClick={signOut}
            >
              <LogOut className="w-4 h-4" />
              <span>{t("signOut") || "Sign Out"}</span>
            </button>
          </div>
        </div>
      </motion.section>

      <section className="admin-stats-bar grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div variants={itemVariants}>
          <SurfaceCard className="!p-0 relative overflow-hidden group h-full">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="absolute top-0 left-0 w-1 h-full bg-accent/20 group-hover:bg-accent transition-colors duration-500" />
            
            <div className="p-7 relative z-10">
              <div className="flex justify-between items-start mb-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-black tracking-[0.2em] uppercase text-text-muted/60">{t("totalDonations") || "Total Donations"}</p>
                  <h4 className="text-sm font-bold text-text">Accumulated Volume</h4>
                </div>
                <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center shadow-[0_0_20px_rgba(20,184,166,0.1)] group-hover:shadow-[0_0_30px_rgba(20,184,166,0.2)] transition-all">
                  <BarChart3 className="w-5 h-5 text-accent" />
                </div>
              </div>

              <div className="flex items-end justify-between gap-4">
                <div className="space-y-1">
                  <strong className="text-5xl font-black tracking-tighter font-mono">142</strong>
                  <div className="flex items-center gap-1.5 text-success font-black text-[10px] uppercase tracking-widest">
                    <Activity className="w-3 h-3" />
                    <span>+12.4% {t("increase") || "Trend"}</span>
                  </div>
                </div>
                
                <div className="flex flex-col items-end gap-2">
                  <div className="px-2 py-1 rounded-md bg-panel-elevated border border-line text-[9px] font-black text-text-muted uppercase tracking-tighter">
                    {t("live") || "Live Data"}
                  </div>
                  <div className="flex items-center gap-1.5 opacity-40">
                    <Clock className="w-3 h-3" />
                    <small className="text-[9px] font-bold uppercase tracking-tighter">{new Date().toLocaleTimeString()}</small>
                  </div>
                </div>
              </div>
            </div>

            {/* Decorative background icon */}
            <div className="absolute -bottom-6 -right-6 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity pointer-events-none transform rotate-12">
              <BarChart3 className="w-32 h-32" />
            </div>
          </SurfaceCard>
        </motion.div>

        <motion.div variants={itemVariants}>
          <SurfaceCard className="!p-0 relative overflow-hidden group h-full">
            <div className="absolute inset-0 bg-gradient-to-br from-accent-warm/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="absolute top-0 left-0 w-1 h-full bg-accent-warm/20 group-hover:bg-accent-warm transition-colors duration-500" />
            
            <div className="p-7 relative z-10">
              <div className="flex justify-between items-start mb-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-black tracking-[0.2em] uppercase text-text-muted/60">{t("activeLockers") || "Active Lockers"}</p>
                  <h4 className="text-sm font-bold text-text">Fleet Availability</h4>
                </div>
                <div className="w-10 h-10 rounded-xl bg-accent-warm/10 border border-accent-warm/20 flex items-center justify-center shadow-[0_0_20px_rgba(232,168,56,0.1)] group-hover:shadow-[0_0_30px_rgba(232,168,56,0.2)] transition-all">
                  <Layers className="w-5 h-5 text-accent-warm" />
                </div>
              </div>

              <div className="flex items-end justify-between gap-4">
                <div className="space-y-1">
                  <strong className="text-5xl font-black tracking-tighter font-mono">8/12</strong>
                  <div className="flex items-center gap-1.5 text-text-muted font-black text-[10px] uppercase tracking-widest">
                    <Box className="w-3 h-3" />
                    <span>66% {t("utilization") || "Capacity"}</span>
                  </div>
                </div>
                
                <div className="flex flex-col items-end gap-2">
                  <div className="px-2 py-1 rounded-md bg-panel-elevated border border-line text-[9px] font-black text-text-muted uppercase tracking-tighter">
                    {t("stable") || "Stable"}
                  </div>
                  <div className="flex items-center gap-1.5 opacity-40">
                    <Clock className="w-3 h-3" />
                    <small className="text-[9px] font-bold uppercase tracking-tighter">{new Date().toLocaleTimeString()}</small>
                  </div>
                </div>
              </div>
            </div>

            {/* Decorative background icon */}
            <div className="absolute -bottom-6 -right-6 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity pointer-events-none transform -rotate-6">
              <Layers className="w-32 h-32" />
            </div>
          </SurfaceCard>
        </motion.div>

        <motion.div variants={itemVariants}>
          <SurfaceCard className="!p-0 relative overflow-hidden group h-full">
            <div className="absolute inset-0 bg-gradient-to-br from-accent-bright/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="absolute top-0 left-0 w-1 h-full bg-accent-bright/20 group-hover:bg-accent-bright transition-colors duration-500" />
            
            <div className="p-7 relative z-10">
              <div className="flex justify-between items-start mb-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-black tracking-[0.2em] uppercase text-text-muted/60">{t("mealsServed") || "Meals Served Today"}</p>
                  <h4 className="text-sm font-bold text-text">Daily Impact</h4>
                </div>
                <div className="w-10 h-10 rounded-xl bg-accent-bright/10 border border-accent-bright/20 flex items-center justify-center shadow-[0_0_20px_rgba(var(--accent-rgb),0.1)] group-hover:shadow-[0_0_30px_rgba(var(--accent-rgb),0.2)] transition-all">
                  <Database className="w-5 h-5 text-accent-bright" />
                </div>
              </div>

              <div className="flex items-end justify-between gap-4">
                <div className="space-y-1">
                  <strong className="text-5xl font-black tracking-tighter font-mono">24</strong>
                  <div className="flex items-center gap-1.5 text-success font-black text-[10px] uppercase tracking-widest">
                    <Activity className="w-3 h-3" />
                    <span>+8.2% {t("increase") || "Trend"}</span>
                  </div>
                </div>
                
                <div className="flex flex-col items-end gap-2">
                  <div className="px-2 py-1 rounded-md bg-panel-elevated border border-line text-[9px] font-black text-text-muted uppercase tracking-tighter">
                    {t("active") || "Active"}
                  </div>
                  <div className="flex items-center gap-1.5 opacity-40">
                    <Clock className="w-3 h-3" />
                    <small className="text-[9px] font-bold uppercase tracking-tighter">{new Date().toLocaleTimeString()}</small>
                  </div>
                </div>
              </div>
            </div>

            {/* Decorative background icon */}
            <div className="absolute -bottom-6 -right-6 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity pointer-events-none transform rotate-45">
              <Database className="w-32 h-32" />
            </div>
          </SurfaceCard>
        </motion.div>
      </section>

      <motion.div variants={itemVariants}>
        <SurfaceCard className="!p-8 overflow-hidden relative">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
              <MapIcon className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-[10px] font-black tracking-widest uppercase text-accent/80">{t("fleetMap")}</p>
              <h3 className="text-xl font-black">{t("liveStatusVisualization")}</h3>
            </div>
          </div>
          
          <div className="fleet-map relative aspect-[21/9] bg-panel-elevated/30 rounded-2xl border border-line overflow-hidden group/map shadow-2xl">
            {/* Google Maps Integration */}
            <iframe
              title="VIT Pune Location"
              width="100%"
              height="100%"
              frameBorder="0"
              style={{ border: 0, filter: 'grayscale(1) contrast(1.1) brightness(0.9) invert(0.05)', opacity: 0.7 }}
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3784.441999208006!2d73.868202514892!3d18.46362248744!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bc2ea9511019ed3%3A0x33ef92d33b49767a!2sVishwakarma%20Institute%20of%20Technology!5e0!3m2!1sen!2sin!4v1620000000000!5m2!1sen!2sin"
              allowFullScreen
              loading="lazy"
            ></iframe>

            {/* Technical Overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-panel/60 via-transparent to-panel/20 pointer-events-none" />
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
            
            {/* Map UI Elements */}
            <div className="absolute top-6 left-6 flex items-center gap-3 z-20">
              <div className="px-3 py-1.5 rounded-full bg-accent/10 backdrop-blur-md border border-accent/20 flex items-center gap-2 shadow-xl">
                <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest text-accent">Live GPS Stream</span>
              </div>
              <div className="px-3 py-1.5 rounded-full bg-panel/40 backdrop-blur-md border border-line flex items-center gap-2 shadow-xl">
                <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest">Zone: VIT-PUNE-01</span>
              </div>
            </div>

            <div className="absolute top-6 right-6 flex flex-col items-end gap-1 z-20">
              <span className="text-[10px] font-mono font-bold text-accent/60 uppercase">Lat: 18.4636</span>
              <span className="text-[10px] font-mono font-bold text-accent/60 uppercase">Lng: 73.8682</span>
            </div>

            {/* Status Legend */}
            <div className="absolute bottom-6 left-6 flex items-center gap-4 z-20">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-panel/60 backdrop-blur-md border border-line">
                <div className="w-2 h-2 rounded-full bg-accent" />
                <span className="text-[9px] font-black uppercase text-text-muted tracking-tighter">Active</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-panel/60 backdrop-blur-md border border-line">
                <div className="w-2 h-2 rounded-full bg-panel border border-line" />
                <span className="text-[9px] font-black uppercase text-text-muted tracking-tighter">Standby</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-panel/60 backdrop-blur-md border border-line">
                <div className="w-2 h-2 rounded-full bg-danger" />
                <span className="text-[9px] font-black uppercase text-text-muted tracking-tighter">Fault</span>
              </div>
            </div>
            
            {fleet.map((locker, idx) => (
              <motion.button
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.5 + (idx * 0.05), type: "spring", stiffness: 200, damping: 15 }}
                key={locker.lockerId}
                className={`fleet-node is-${locker.occupancyState} absolute group z-30`}
                type="button"
                style={{ left: `${locker.coordinates.x}%`, top: `${locker.coordinates.y}%` }}
              >
                <div className="relative flex flex-col items-center">
                  {/* Pulse Effect for Active Nodes */}
                  {locker.occupancyState === 'occupied' && (
                    <div className="absolute inset-0 -m-2 bg-accent rounded-full animate-ping opacity-10 pointer-events-none" />
                  )}
                  
                  {/* Marker Pin */}
                  <div className={`relative w-7 h-7 rounded-full flex items-center justify-center font-black text-[9px] transition-all duration-500 border-2 shadow-2xl
                    ${locker.occupancyState === 'occupied' 
                      ? 'bg-accent border-accent text-white ring-4 ring-accent/20 scale-110' 
                      : locker.faultState !== 'none'
                        ? 'bg-danger border-danger text-white ring-4 ring-danger/20'
                        : 'bg-panel/90 backdrop-blur-md border-line text-text-muted hover:border-accent/50 hover:text-text'}`}
                  >
                    {locker.lockerLabel.split(' ')[1]?.[0] || 'L'}
                  </div>

                  {/* Dynamic Label Underneath */}
                  <div className="mt-2 px-2 py-0.5 rounded bg-panel/60 backdrop-blur-sm border border-line group-hover:bg-panel group-hover:border-accent/30 transition-colors">
                    <span className="text-[8px] font-black uppercase tracking-tighter text-text-muted group-hover:text-text">{locker.lockerLabel}</span>
                  </div>
                  
                  {/* Advanced Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 p-4 rounded-2xl bg-panel-elevated/95 backdrop-blur-2xl border border-line shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap z-50 transform translate-y-2 group-hover:translate-y-0 min-w-[180px]">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[10px] font-black uppercase tracking-widest text-accent">{locker.zoneLabel}</span>
                      <div className={`w-2 h-2 rounded-full ${locker.occupancyState === 'occupied' ? 'bg-accent' : 'bg-text-muted'}`} />
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider mb-0.5">Active Donation</span>
                        <p className="text-sm font-black text-text">{locker.activeDonationName ?? "None (Ready)"}</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 pt-3 border-t border-line">
                        <div className="flex flex-col">
                          <span className="text-[8px] font-bold text-text-muted uppercase tracking-wider mb-0.5">Health</span>
                          <span className="text-[10px] font-black text-success uppercase">{locker.sensorHealth}</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[8px] font-bold text-text-muted uppercase tracking-wider mb-0.5">Sync</span>
                          <span className="text-[10px] font-mono font-bold text-text">99.2%</span>
                        </div>
                      </div>
                    </div>

                    {/* Tooltip arrow */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-panel-elevated/95" />
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </SurfaceCard>
      </motion.div>

      <div className="admin-content-layout flex flex-col gap-10 mt-10">
        <motion.section variants={itemVariants}>
          <SurfaceCard className="!p-8">
            <div className="luxe-card-header flex justify-between items-start mb-8">
              <div className="luxe-card-title-stack">
                <p className="text-[10px] font-black tracking-widest uppercase text-accent/80 mb-1">{t("lockerSummaries")}</p>
                <h3 className="text-2xl font-black">{t("systemInventory")}</h3>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-panel-elevated border border-line flex items-center justify-center text-xl shadow-inner">
                <Box className="w-6 h-6 text-text-muted" />
              </div>
            </div>
            
            <div className="locker-summary-list grid gap-4">
              {fleet.map((locker) => (
                <article 
                  key={locker.lockerId} 
                  className="luxe-summary-item flex flex-col md:flex-row md:items-center justify-between p-6 rounded-[2rem] bg-panel-elevated/40 border border-line/50 hover:border-accent/40 hover:bg-panel-elevated/60 transition-all duration-500 group relative overflow-hidden"
                >
                  {/* Hover glow effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-accent/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                  
                  <div className="flex items-center gap-6 relative z-10">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-lg border-2 transition-all duration-500
                      ${locker.occupancyState === 'occupied' 
                        ? 'bg-accent/10 border-accent/30 text-accent shadow-[0_0_20px_rgba(20,184,166,0.1)] group-hover:scale-110' 
                        : locker.occupancyState === 'maintenance'
                          ? 'bg-danger/10 border-danger/30 text-danger'
                          : 'bg-panel border-line text-text-muted group-hover:border-accent/20'}`}
                    >
                      {locker.lockerLabel.split(' ')[1]?.[0] || 'L'}
                    </div>
                    <div className="luxe-summary-info">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-black text-lg tracking-tight text-text">{locker.lockerLabel}</h4>
                        <span className="px-2 py-0.5 rounded-md bg-panel border border-line text-[8px] font-black uppercase tracking-widest text-text-muted">{locker.lockerId}</span>
                      </div>
                      <p className="text-[10px] font-black text-accent uppercase tracking-[0.2em]">{locker.zoneLabel}</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-8 mt-4 md:mt-0 relative z-10">
                    <div className="hidden lg:flex flex-col items-start gap-1">
                      <span className="text-[9px] font-black text-text-muted uppercase tracking-widest">Active Payload</span>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-text truncate max-w-[150px]">
                          {locker.activeDonationName ?? t("ready")}
                        </p>
                        {locker.occupancyState === 'occupied' && (
                          <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                        )}
                      </div>
                    </div>

                    <div className="hidden sm:flex flex-col items-center px-8 border-x border-line/30">
                      <span className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1">Health Core</span>
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${locker.sensorHealth === 'healthy' ? 'bg-accent' : 'bg-warning'}`} />
                        <span className="text-xs font-black uppercase tracking-tight">{locker.sensorHealth}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-5">
                      <div className="flex flex-col items-end">
                        <StatusPill
                          value={locker.occupancyState}
                          tone={locker.faultState !== "none" ? "danger" : locker.occupancyState === "occupied" ? "warning" : "success"}
                        />
                        <span className="text-[9px] font-bold text-text-muted uppercase tracking-tighter mt-1.5 opacity-50 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {new Date(locker.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </SurfaceCard>
        </motion.section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <motion.section variants={itemVariants}>
            <SurfaceCard className="!p-3.5 relative overflow-hidden h-full group border-accent/20">
              {/* Technical Overlays */}
              <Scanline />
              <CornerBrackets />
              
              {/* Animated Heartbeat Background */}
              <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none group-hover:opacity-[0.08] transition-opacity duration-1000">
                <Activity className="w-20 h-20 animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]" />
              </div>
              
              <div className="luxe-card-header flex justify-between items-start mb-4 relative z-10">
                <div className="luxe-card-title-stack">
                  <p className="text-[9px] font-black tracking-[0.3em] uppercase text-accent/80 mb-0.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                    {t("currentKiosk")}
                    <span className="opacity-40 ml-2 font-mono text-[8px]">REF: KSK-9902</span>
                  </p>
                  <h3 className="text-lg font-black tracking-tight text-text flex items-center gap-2">
                    {t("healthCore")}
                    <span className="h-3 w-px bg-line/50 mx-1" />
                    <span className="text-[9px] font-mono text-accent/50 uppercase">Active</span>
                  </h3>
                </div>
                <div className="w-10 h-10 rounded-xl bg-accent/5 border border-accent/20 flex items-center justify-center shadow-sm group-hover:shadow-lg transition-all">
                  <ShieldCheck className="w-5 h-5 text-accent" />
                </div>
              </div>
              
              <div className="luxe-metric-grid grid grid-cols-2 gap-x-4 gap-y-3 relative z-10">
                <MetricItem 
                  label={t("bleStatus") || "BLE Signal"} 
                  value={currentLocker.bleConnected ? t("connected") : t("disconnected")}
                  progress={currentLocker.bleConnected ? 100 : 15}
                  color={currentLocker.bleConnected ? "var(--accent)" : "var(--danger)"}
                  icon={<Wifi className="w-3.5 h-3.5" />}
                />
                <MetricItem 
                  label={t("sensorHealth") || "Sensor Array"} 
                  value={currentLocker.telemetry.sensorHealth}
                  progress={currentLocker.telemetry.sensorHealth === 'healthy' ? 100 : 65}
                  color={currentLocker.telemetry.sensorHealth === 'healthy' ? "var(--accent)" : "var(--warning)"}
                  icon={<Activity className="w-3.5 h-3.5" />}
                />
                <div className="col-span-2">
                  <MetricItem 
                    label={t("sanitization") || "Hygiene Integrity"} 
                    value={currentLocker.sanitizationState === 'idle' ? "Complete" : "Processing"}
                    progress={currentLocker.sanitizationState === 'idle' ? 100 : 40}
                    color="var(--accent)"
                    icon={<RefreshCcw className="w-3.5 h-3.5" />}
                    wide
                  />
                </div>
              </div>
              
              <div className="mt-5 pt-3 border-t border-line/40 flex items-center justify-between relative z-10">
                <div className="flex flex-col gap-0">
                  <span className="text-[7px] font-black uppercase tracking-[0.2em] text-text-muted/60 leading-none mb-1">{t("lastSync")}</span>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-2 h-2 text-accent/60" />
                    <span className="text-[9px] font-mono font-bold text-text tracking-tighter">{formatDateTime(currentLocker.lastSyncedAt)}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <motion.div 
                      key={i}
                      animate={{ 
                        height: [6, 12, 6],
                        opacity: [0.3, 1, 0.3]
                      }}
                      transition={{ 
                        duration: 0.8, 
                        repeat: Infinity, 
                        delay: i * 0.15
                      }}
                      className="w-0.5 rounded-full bg-accent/40"
                    />
                  ))}
                </div>
              </div>
            </SurfaceCard>
          </motion.section>

          <motion.section variants={itemVariants}>
            <SurfaceCard className="!p-3.5 h-full relative overflow-hidden group border-accent/10">
              <Scanline />
              <CornerBrackets />
              
              {/* Background technical decoration */}
              <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none group-hover:opacity-[0.07] transition-opacity duration-700">
                <Settings className="w-20 h-20 rotate-12" />
              </div>
              
              <div className="luxe-card-header flex justify-between items-start mb-4 relative z-10">
                <div className="luxe-card-title-stack">
                  <p className="text-[9px] font-black tracking-[0.3em] uppercase text-accent/80 mb-0.5">{t("systemActions")}</p>
                  <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
                    {t("controlCenter")}
                    <span className="px-1 py-0.5 rounded bg-panel-elevated border border-line text-[7px] font-mono text-text-muted">ID: CMD-0x1</span>
                  </h3>
                </div>
                <motion.button 
                  whileHover={{ rotate: 90, scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-10 h-10 rounded-xl bg-panel-elevated border border-line flex items-center justify-center shadow-sm transition-colors group/settings"
                >
                  <Settings className="w-4 h-4 text-text-muted group-hover/settings:text-accent transition-colors" />
                </motion.button>
              </div>
              
              <div className="luxe-action-grid grid grid-cols-1 sm:grid-cols-2 gap-2 relative z-10">
                <ActionButton 
                  onClick={syncNow}
                  icon={<RefreshCcw className="w-4 h-4" />}
                  label={t("forceCloudSync") || "Force Cloud Sync"}
                  sublabel="Update records"
                  index={0}
                />
                <ActionButton 
                  onClick={reconnectLocker}
                  icon={<Wifi className="w-4 h-4" />}
                  label={t("bleReconnect") || "BLE Reconnect"}
                  sublabel="Reset bridge"
                  index={1}
                />
                <ActionButton 
                  onClick={clearFault}
                  variant="warning"
                  icon={<AlertTriangle className="w-4 h-4" />}
                  label={t("clearFault") || "Clear Fault"}
                  sublabel="Acknowledge"
                  index={2}
                />
                <ActionButton 
                  onClick={resetDonations}
                  variant="danger"
                  icon={<RefreshCcw className="w-4 h-4" />}
                  label="Emergency Wipe"
                  sublabel="Full purge"
                  index={3}
                />
              </div>
              
              <div className="mt-4 flex items-center justify-center gap-3 opacity-10 group-hover:opacity-20 transition-opacity">
                <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-text" />
                <span className="text-[7px] font-mono font-black uppercase tracking-[0.4em]">Encrypted Stream</span>
                <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-text" />
              </div>
            </SurfaceCard>
          </motion.section>
        </div>
      </div>
    </motion.div>
  );
}

function Scanline() {
  return (
    <motion.div 
      initial={{ top: "-100%" }}
      animate={{ top: "200%" }}
      transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
      className="absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-accent/30 to-transparent z-20 pointer-events-none"
    />
  );
}

function CornerBrackets() {
  return (
    <>
      <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-accent/20 rounded-tl-sm pointer-events-none group-hover:border-accent/40 transition-colors" />
      <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-accent/20 rounded-tr-sm pointer-events-none group-hover:border-accent/40 transition-colors" />
      <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-accent/20 rounded-bl-sm pointer-events-none group-hover:border-accent/40 transition-colors" />
      <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-accent/20 rounded-br-sm pointer-events-none group-hover:border-accent/40 transition-colors" />
    </>
  );
}

function MetricItem({ label, value, progress, color, icon, wide = false }: any) {
  const isHealthy = progress >= 80;
  const isCritical = progress < 30;
  
  return (
    <div className={`luxe-metric-card group/metric relative ${wide ? 'w-full' : ''}`}>
      <div className="flex justify-between items-end mb-1.5">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-500 border
            bg-panel border-line group-hover/metric:border-accent/40 group-hover/metric:bg-accent/10 shadow-md`}>
            <span className="text-text-muted group-hover/metric:text-accent transition-all duration-300 transform group-hover/metric:scale-105 scale-90">{icon}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-text-muted/60 leading-none mb-0.5">{label}</span>
            <strong className={`text-[12px] font-black uppercase tracking-tight transition-colors duration-300
              ${isHealthy ? 'text-text' : isCritical ? 'text-danger' : 'text-accent-warm'}`}>
              {value}
            </strong>
          </div>
        </div>
        
        <div className="flex flex-col items-end leading-none">
          <span className="text-[9px] font-mono font-black text-text group-hover/metric:text-accent transition-colors">{progress}%</span>
          <div className="w-6 h-0.5 bg-accent/5 rounded-full mt-0.5 overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 2, repeat: Infinity }}
              className="h-full bg-accent/40"
            />
          </div>
        </div>
      </div>
      
      <div className="relative h-1.5 w-full bg-line/20 rounded-full overflow-hidden backdrop-blur-md border border-line/10 group-hover/metric:border-accent/20 transition-colors">
        {/* Subtle grid pattern inside bar */}
        <div className="absolute inset-0 opacity-[0.05] bg-[radial-gradient(#fff_1px,transparent_1px)] bg-[size:4px_4px]" />
        
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] }}
          className="h-full rounded-full relative" 
          style={{ 
            background: color.startsWith('var') ? color : `linear-gradient(90deg, ${color}CC, ${color})`,
            width: `${progress}%`,
            boxShadow: `0 0 10px ${color.startsWith('var') ? 'rgba(var(--accent-rgb), 0.2)' : color + '30'}`
          }}
        >
          {/* Glowing point at the end */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full blur-[4px] opacity-40" />
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-1 bg-white rounded-full shadow-[0_0_8px_#fff]" />

          <motion.div 
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
          />
        </motion.div>
      </div>
    </div>
  );
}

function ActionButton({ onClick, icon, label, sublabel, variant = "default", index = 0 }: any) {
  const isDanger = variant === "danger";
  const isWarning = variant === "warning";
  
  const textColors = {
    danger: "text-danger",
    warning: "text-accent-warm",
    default: "text-accent"
  };

  const textColor = textColors[variant as keyof typeof textColors] || textColors.default;

  return (
    <motion.button 
      onClick={onClick}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.1 * index, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -1.5, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      className={`relative flex items-center gap-3 w-full p-2.5 rounded-xl border transition-all duration-500 group overflow-hidden
        bg-panel-elevated/40 backdrop-blur-xl border-line
        hover:bg-panel-elevated/80 hover:shadow-xl
        ${isDanger ? 'hover:border-danger/40 hover:shadow-danger/10' : 
          isWarning ? 'hover:border-accent-warm/40 hover:shadow-accent-warm/10' : 
          'hover:border-accent/40 hover:shadow-accent/10'}`}
    >
      {/* Digital Scanline Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.03] to-transparent -translate-y-full group-hover:translate-y-full transition-transform duration-1000 ease-in-out pointer-events-none" />
      
      <div className={`relative flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-500 border
        bg-panel border-line group-hover:border-transparent group-hover:shadow-[0_0_15px_rgba(var(--accent-rgb),0.15)]
        ${isDanger ? 'group-hover:bg-danger group-hover:text-white' : 
          isWarning ? 'group-hover:bg-accent-warm group-hover:text-white' : 
          'group-hover:bg-accent group-hover:text-white'}`}
      >
        <div className={`transition-transform duration-500 group-hover:scale-110 ${textColor} group-hover:text-white transform scale-90`}>
          {icon}
        </div>
      </div>

      <div className="flex flex-col gap-0 relative z-10 leading-tight text-left">
        <strong className="text-[13px] font-black tracking-tight text-text group-hover:text-text transition-colors leading-none mb-0.5">
          {label}
        </strong>
        <span className="text-[8px] font-black text-text-muted uppercase tracking-[0.12em] opacity-50 group-hover:opacity-100 transition-all flex items-center gap-1">
          <span className="w-1 h-1 rounded-full bg-current opacity-30" />
          {sublabel}
        </span>
      </div>

      {/* Hover corner bracket */}
      <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-accent/0 group-hover:border-accent/30 transition-all duration-500" />
      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-accent/0 group-hover:border-accent/30 transition-all duration-500" />

      <div className="absolute inset-0 opacity-0 group-hover:opacity-[0.03] pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] transition-opacity duration-500" />
    </motion.button>
  );
}

