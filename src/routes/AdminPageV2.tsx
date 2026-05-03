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
  Layers,
  MoreHorizontal
} from "lucide-react";
import { Link } from "react-router-dom";
import { StatusPill } from "../components/StatusPill";
import { SurfaceCard } from "../components/layout/SurfaceCard";
import { MetricCardPremium } from "../components/MetricCardPremium";
import { Menu } from "../components/ui/fluid-menu";
import { FleetMap } from "../components/FleetMap";
import { useLockerController } from "../features/useLockerController";
import { useTranslation } from "../store/useTranslation";
import { formatDateTime } from "../utils/format";
import { sampleFleetLockers } from "../utils/mockData";
import { useState } from "react";
import { ScrollReveal } from "../components/ScrollReveal";
import { TextReveal } from "../components/TextReveal";

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
      transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as const }
    }
  };

  return (
    <div className="page-grid admin-grid">
      <ScrollReveal direction="up" distance={40}>
        <section className="relative bg-panel rounded-[2.5rem] p-6 md:p-8 shadow-sm border border-line/40 overflow-hidden">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-accent/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-10 -mb-10 w-40 h-40 bg-accent-warm/10 rounded-full blur-[80px] pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="hero-copy max-w-2xl">
              <TextReveal direction="up" distance={15} delay={0.1}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 rounded-full bg-accent" />
                  <p className="text-[11px] font-black tracking-widest uppercase text-accent m-0 leading-none">FLEET OVERVIEW</p>
                </div>
              </TextReveal>
              <TextReveal direction="up" distance={20} delay={0.2}>
                <h2 className="text-3xl md:text-4xl leading-[1.05] font-black tracking-tight mb-3 text-text drop-shadow-sm dark:drop-shadow-none">
                  Maintenance and<br />safety dashboard
                </h2>
              </TextReveal>
              <TextReveal direction="up" distance={20} delay={0.3}>
                <p className="text-text-muted font-medium text-base md:text-[17px] leading-relaxed max-w-[500px]">
                  Monitor every locker, inspect active donations, and open the current kiosk for deeper cleaning or safety actions.
                </p>
              </TextReveal>
            </div>
            
            <div className="hero-actions flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-3">
                <Link 
                  className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-panel-elevated hover:bg-line/20 border border-transparent transition-all duration-300 font-black text-xs uppercase tracking-widest text-text shadow-sm hover:-translate-y-0.5"
                  to="/connect"
                >
                  <Settings2 className="w-4 h-4 text-accent" />
                  <span>CONNECT</span>
                </Link>
                <button 
                  className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-panel-elevated hover:bg-line/20 border border-transparent transition-all duration-300 font-black text-xs uppercase tracking-widest text-text shadow-sm hover:-translate-y-0.5"
                  type="button" 
                  onClick={signOut}
                >
                  <LogOut className="w-4 h-4 text-danger/80" />
                  <span>SIGNOUT</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </ScrollReveal>

      <section className="admin-stats-bar grid grid-cols-1 md:grid-cols-3 gap-5">
        <ScrollReveal direction="up" distance={30} delay={0.1}>
          <MetricCardPremium 
            title={t("totalDonations") || "Total Donations"}
            subtitle="Accumulated Volume"
            value="142"
            trend={`+12.4% ${t("increase") || "Trend"}`}
            trendDirection="up"
            icon={<BarChart3 className="w-6 h-6" />}
            bgIcon={<BarChart3 className="w-40 h-40" />}
            accentColor="var(--accent)"
            index={0}
          />
        </ScrollReveal>

        <ScrollReveal direction="up" distance={30} delay={0.2}>
          <MetricCardPremium 
            title={t("activeLockers") || "Active Lockers"}
            subtitle="Fleet Availability"
            value="8/12"
            trend={`66% ${t("utilization") || "Capacity"}`}
            trendDirection="neutral"
            icon={<Layers className="w-6 h-6" />}
            bgIcon={<Layers className="w-40 h-40" />}
            accentColor="var(--accent-warm)"
            index={1}
          />
        </ScrollReveal>

        <ScrollReveal direction="up" distance={30} delay={0.3}>
          <MetricCardPremium 
            title={t("mealsServed") || "Meals Served Today"}
            subtitle="Daily Impact"
            value="24"
            trend={`+8.2% ${t("increase") || "Trend"}`}
            trendDirection="up"
            icon={<Database className="w-6 h-6" />}
            bgIcon={<Database className="w-40 h-40" />}
            accentColor="var(--accent-bright)"
            index={2}
          />
        </ScrollReveal>
      </section>

      <ScrollReveal direction="up" distance={40} delay={0.4}>
        <FleetMap />
      </ScrollReveal>

      <div className="admin-content-layout flex flex-col gap-6 mt-6">
        <ScrollReveal direction="up" distance={40} delay={0.5}>
          <SurfaceCard className="!p-5">
            <div className="luxe-card-header flex justify-between items-start mb-5">
              <div className="luxe-card-title-stack">
                <TextReveal direction="left" distance={10} delay={0.1}>
                  <p className="text-[10px] font-black tracking-widest uppercase text-accent/80 mb-1">{t("lockerSummaries")}</p>
                </TextReveal>
                <TextReveal direction="left" distance={15} delay={0.2}>
                  <h3 className="text-2xl font-black">{t("systemInventory")}</h3>
                </TextReveal>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-panel-elevated border border-line flex items-center justify-center text-xl shadow-inner">
                <Box className="w-6 h-6 text-text-muted" />
              </div>
            </div>
            
            <div className="locker-summary-list grid gap-4">
              {fleet.map((locker, idx) => (
                <ScrollReveal key={locker.lockerId} direction="up" distance={20} delay={idx * 0.05}>
                  <article className="luxe-summary-item flex flex-col md:flex-row md:items-center justify-between p-6 rounded-[2.2rem] bg-panel-elevated/40 border border-line/50 hover:border-accent/40 hover:bg-panel-elevated/60 transition-all duration-500 group relative overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1">
                    {/* Technical Overlays */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 blur-[40px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-accent-warm/5 blur-[30px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                    
                    <div className="flex items-center gap-6 relative z-10">
                      <div className="relative">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-black text-xl border-2 transition-all duration-700
                          ${locker.occupancyState === 'occupied' 
                            ? 'bg-accent/10 border-accent/30 text-accent shadow-[0_0_20px_rgba(20,184,166,0.1)] group-hover:shadow-[0_0_30px_rgba(20,184,166,0.3)]' 
                            : locker.occupancyState === 'maintenance'
                              ? 'bg-danger/10 border-danger/30 text-danger shadow-[0_0_20px_rgba(239,68,68,0.1)]'
                              : 'bg-panel/50 border-line text-text-muted group-hover:border-accent/20'}`}
                        >
                          {locker.lockerLabel.split(' ')[1]?.[0] || 'L'}
                        </div>
                        
                        {/* Status Pulse Dot */}
                        <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-panel z-20 flex items-center justify-center
                          ${locker.faultState !== "none" ? 'bg-danger' : locker.occupancyState === "occupied" ? 'bg-accent' : 'bg-success'}`}>
                          <div className="w-full h-full rounded-full bg-white animate-ping opacity-40" />
                        </div>
                      </div>

                      <div className="luxe-summary-info">
                        <div className="flex items-center gap-3 mb-1.5">
                          <h4 className="font-black text-xl tracking-tight text-text group-hover:text-accent transition-colors">{locker.lockerLabel}</h4>
                          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-panel/80 border border-line text-[9px] font-mono font-bold uppercase tracking-widest text-text-muted shadow-inner">
                            <Database className="w-2.5 h-2.5 opacity-50" />
                            {locker.lockerId}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-px bg-accent/40" />
                          <p className="text-[10px] font-black text-accent/70 uppercase tracking-[0.25em]">{locker.zoneLabel}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-10 mt-6 md:mt-0 relative z-10">
                      <div className="hidden lg:flex flex-col items-start gap-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black text-text-muted uppercase tracking-[0.15em]">Locker Utilization</span>
                          <span className="text-[9px] font-mono font-bold text-accent">{Math.round((locker.occupiedUnits / locker.totalUnits) * 100)}%</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex gap-1.5 h-4 items-center">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <motion.div 
                                key={i} 
                                initial={false}
                                animate={{ 
                                  height: i < (locker.occupiedUnits / locker.totalUnits) * 5 ? [12, 16, 12] : 8,
                                  opacity: i < (locker.occupiedUnits / locker.totalUnits) * 5 ? 1 : 0.2
                                }}
                                transition={{ 
                                  duration: 1.5, 
                                  repeat: Infinity, 
                                  delay: i * 0.1,
                                  repeatType: "reverse"
                                }}
                                className={`w-1 rounded-full ${i < (locker.occupiedUnits / locker.totalUnits) * 5 ? 'bg-accent shadow-[0_0_8px_rgba(20,184,166,0.4)]' : 'bg-line'}`} 
                              />
                            ))}
                          </div>
                          <p className="text-sm font-mono font-black text-text">
                            {locker.occupiedUnits} <span className="text-text-muted opacity-40">/</span> {locker.totalUnits}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        {locker.faultState !== "none" || locker.foodQualityScore === "spoilt" ? (
                          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-danger/10 border border-danger/30 shadow-[0_0_20px_rgba(239,68,68,0.15)] group-hover:bg-danger/20 transition-all">
                            <AlertTriangle className="w-4 h-4 text-danger animate-pulse" />
                            <span className="text-[10px] font-black tracking-widest uppercase text-danger">Quarantined</span>
                          </div>
                        ) : null}
                        
                        <div className="flex flex-col items-end min-w-[100px]">
                          <StatusPill
                            value={locker.occupancyState}
                            tone={locker.faultState !== "none" || locker.foodQualityScore === "spoilt" ? "danger" : locker.occupancyState === "occupied" ? "warning" : "success"}
                          />
                          <div className="flex items-center gap-1.5 mt-2 opacity-30 group-hover:opacity-60 transition-opacity">
                            <Activity className="w-2.5 h-2.5" />
                            <span className="text-[8px] font-black uppercase tracking-tighter text-text">Active Stream</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Corner Decoration */}
                    <div className="absolute top-0 left-0 w-1 h-0 group-hover:h-full bg-accent transition-all duration-700 ease-in-out" />
                  </article>
                </ScrollReveal>
              ))}
            </div>
          </SurfaceCard>
        </ScrollReveal>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ScrollReveal direction="left" distance={40} delay={0.6}>
            <SurfaceCard className="environmental-card-luxe !p-5 relative overflow-hidden group border-accent/10">
              {/* Technical Overlays */}
              <Scanline />
              <BotanicalDecoration />
              
              {/* Animated Heartbeat Background */}
              <div className="absolute top-10 right-10 p-4 opacity-[0.03] pointer-events-none group-hover:opacity-[0.05] transition-opacity duration-1000">
                <Activity className="w-24 h-24 animate-[pulse_3s_cubic-bezier(0.4,0,0.6,1)_infinite]" />
              </div>
              
              <div className="luxe-card-header flex justify-between items-start mb-4 relative z-10">
                <div className="luxe-card-title-stack">
                  <TextReveal direction="left" distance={10} delay={0.1}>
                    <p className="text-[10px] font-black tracking-[0.2em] uppercase text-accent/80 mb-0.5 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                      {t("currentKiosk") || "CURRENT KIOSK"}
                      <span className="opacity-40 ml-1.5 font-mono text-[8px] font-medium tracking-normal">REF: KSK-9902</span>
                    </p>
                  </TextReveal>
                  <TextReveal direction="left" distance={15} delay={0.2}>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl md:text-2xl font-black tracking-tight text-text leading-none">
                        {t("terminalDiagnostics") || "Terminal Diagnostics"}
                      </h3>
                      <span className="px-1.5 py-0.5 rounded-full bg-accent/10 text-accent text-[8px] font-black uppercase tracking-widest border border-accent/20">Active</span>
                    </div>
                  </TextReveal>
                </div>
                <div className="w-10 h-10 rounded-full bg-accent/5 border border-accent/20 flex items-center justify-center shadow-sm group-hover:shadow-lg transition-all group-hover:scale-110">
                  <ShieldCheck className="w-5 h-5 text-accent" />
                </div>
              </div>
              
              <div className="luxe-metric-grid grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5 relative z-10">
                <MetricItem 
                  label="TinyML AI Engine" 
                  value="Edge Active"
                  progress={100}
                  color="var(--accent)"
                  icon={<Settings2 className="w-3.5 h-3.5" />}
                />
                <MetricItem 
                  label="BME688 VOC Nose" 
                  value={`${currentLocker.telemetry.gasResistanceOhms} Ω`}
                  progress={currentLocker.telemetry.gasResistanceOhms > 15000 ? 100 : 40}
                  color={currentLocker.telemetry.gasResistanceOhms > 15000 ? "var(--accent)" : "var(--warning)"}
                  icon={<Activity className="w-3.5 h-3.5" />}
                />
                <MetricItem 
                  label="DS18B20 Core Temp" 
                  value={`${currentLocker.telemetry.internalTempC}°C`}
                  progress={currentLocker.telemetry.internalTempC <= 5 ? 100 : 70}
                  color={currentLocker.telemetry.internalTempC <= 5 ? "var(--accent)" : "var(--warning)"}
                  icon={<Activity className="w-3.5 h-3.5" />}
                />
                <MetricItem 
                  label="UV-C Quarantine" 
                  value={currentLocker.sanitizationState === 'idle' ? "Standby" : "Active"}
                  progress={currentLocker.sanitizationState === 'idle' ? 100 : 40}
                  color={currentLocker.sanitizationState === 'idle' ? "var(--accent)" : "var(--danger)"}
                  icon={<RefreshCcw className={`w-3.5 h-3.5 ${currentLocker.sanitizationState !== 'idle' ? 'animate-spin' : ''}`} />}
                />
              </div>
              
              <div className="mt-6 pt-4 border-t border-line/20 flex items-center justify-between relative z-10">
                <div className="flex flex-col gap-0">
                  <span className="text-[7px] font-black uppercase tracking-[0.2em] text-text-muted/60 leading-none mb-1">{t("lastSync")}</span>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-2.5 h-2.5 text-accent/60" />
                    <span className="text-[9px] font-mono font-bold text-text tracking-tighter opacity-70">{formatDateTime(currentLocker.lastSyncedAt)}</span>
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
                        duration: 1.2, 
                        repeat: Infinity, 
                        delay: i * 0.15,
                        ease: "easeInOut"
                      }}
                      className="w-0.5 rounded-full bg-accent/40"
                    />
                  ))}
                </div>
              </div>
            </SurfaceCard>
          </ScrollReveal>

          <ScrollReveal direction="right" distance={40} delay={0.7}>
            <SurfaceCard className="environmental-card-luxe !p-5 relative overflow-hidden group border-accent/10">
              <Scanline />
              <BotanicalDecoration />
              
              {/* Background technical decoration */}
              <div className="absolute top-10 right-10 p-4 opacity-[0.03] pointer-events-none group-hover:opacity-[0.05] transition-opacity duration-1000">
                <Settings className="w-24 h-24 rotate-12" />
              </div>
              
              <div className="luxe-card-header flex justify-between items-start mb-4 relative z-10">
                <div className="luxe-card-title-stack">
                  <TextReveal direction="left" distance={10} delay={0.1}>
                    <p className="text-[10px] font-black tracking-[0.2em] uppercase text-accent/80 mb-0.5">{t("systemActions") || "ACTIONS"}</p>
                  </TextReveal>
                  <TextReveal direction="left" distance={15} delay={0.2}>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl md:text-2xl font-black tracking-tight flex items-center gap-2 leading-none">
                        {t("systemCommandCenter") || "System Command Center"}
                      </h3>
                      <span className="px-1.5 py-0.5 rounded bg-panel-elevated border border-line text-[7px] font-mono font-bold text-text-muted">ID: CMD-0x1</span>
                    </div>
                  </TextReveal>
                </div>
                <motion.button 
                  whileHover={{ rotate: 90, scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-10 h-10 rounded-full bg-panel-elevated border border-line flex items-center justify-center shadow-sm transition-all group/settings hover:bg-white dark:hover:bg-accent"
                >
                  <Settings className="w-4 h-4 text-text-muted group-hover/settings:text-white transition-colors" />
                </motion.button>
              </div>
              
              <div className="luxe-action-grid grid grid-cols-1 sm:grid-cols-2 gap-3 relative z-10">
                <ActionButton 
                  onClick={syncNow}
                  icon={<RefreshCcw className="w-4 h-4" />}
                  label={t("forceCloudSync") || "Force Sync"}
                  sublabel="UPDATE RECORDS"
                  index={0}
                />
                <ActionButton 
                  onClick={reconnectLocker}
                  icon={<Wifi className="w-4 h-4" />}
                  label={t("bleReconnect") || "BLE Reset"}
                  sublabel="RESET BRIDGE"
                  index={1}
                />
                <ActionButton 
                  onClick={clearFault}
                  variant="warning"
                  icon={<AlertTriangle className="w-4 h-4" />}
                  label={t("clearFault") || "Clear Fault"}
                  sublabel="ACKNOWLEDGE"
                  index={2}
                />
                <ActionButton 
                  onClick={resetDonations}
                  variant="danger"
                  icon={<RefreshCcw className="w-4 h-4" />}
                  label="Emergency Wipe"
                  sublabel="FULL PURGE"
                  index={3}
                />
              </div>
              
              <div className="mt-6 flex items-center justify-center gap-3 opacity-10 group-hover:opacity-20 transition-opacity">
                <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-text" />
                <span className="text-[7px] font-mono font-black uppercase tracking-[0.4em]">Encrypted</span>
                <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-text" />
              </div>
            </SurfaceCard>
          </ScrollReveal>
        </div>
      </div>
    </div>
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

function BotanicalDecoration() {
  return (
    <div className="absolute top-0 left-0 p-4 pointer-events-none opacity-[0.12] dark:opacity-[0.06] z-0">
      <svg width="80" height="80" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="20" cy="20" r="40" stroke="currentColor" strokeWidth="1.5" className="text-accent" />
        <circle cx="20" cy="20" r="60" stroke="currentColor" strokeWidth="1" className="text-accent/60" />
      </svg>
    </div>
  );
}

function MetricItem({ label, value, progress, color, icon, wide = false }: any) {
  const isHealthy = progress >= 80;
  const isCritical = progress < 30;
  
  return (
    <div className={`luxe-metric-card group/metric relative flex flex-col gap-2 ${wide ? 'w-full' : ''}`}>
      <div className="flex items-center gap-3">
        <div className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-700 border
          bg-white dark:bg-panel-elevated border-line group-hover/metric:border-accent group-hover/metric:shadow-[0_0_15px_rgba(20,184,166,0.1)]`}>
          <span className="text-text-muted group-hover/metric:text-accent transition-all duration-500 transform group-hover/metric:scale-105">{icon}</span>
        </div>
        
        <div className="flex flex-col gap-0 flex-grow">
          <div className="flex justify-between items-baseline">
            <span className="text-[9px] font-black uppercase tracking-[0.12em] text-text-muted opacity-60 leading-none">{label}</span>
            <span className="text-[10px] font-mono font-black text-text/30 group-hover/metric:text-accent transition-colors">{progress}%</span>
          </div>
          <strong className={`text-[15px] font-black uppercase tracking-tight transition-colors duration-300
            ${isHealthy ? 'text-text' : isCritical ? 'text-danger' : 'text-accent-warm'}`}>
            {value}
          </strong>
        </div>
      </div>
      
      <div className="relative h-1 w-full bg-line/15 rounded-full overflow-hidden backdrop-blur-sm border border-line/5 group-hover/metric:border-accent/5 transition-colors">
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
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full blur-[5px] opacity-50" />
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-1 bg-white rounded-full shadow-[0_0_8px_#fff]" />

          <motion.div 
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "linear" }}
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
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 * index, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      className={`relative flex items-center gap-3 w-full p-3 rounded-[1.5rem] border transition-all duration-500 group overflow-hidden
        bg-white dark:bg-panel-elevated/30 backdrop-blur-xl border-line
        hover:shadow-xl hover:bg-white dark:hover:bg-panel-elevated/60
        ${isDanger ? 'hover:border-danger/30 hover:shadow-danger/5' : 
          isWarning ? 'hover:border-accent-warm/30 hover:shadow-accent-warm/5' : 
          'hover:border-accent/30 hover:shadow-accent/5'}`}
    >
      {/* Decorative scanline on hover */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-accent/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />
      
      <div className={`relative flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 border
        bg-white dark:bg-panel border-line group-hover:border-transparent group-hover:shadow-[0_0_15px_rgba(var(--accent-rgb),0.1)]
        ${isDanger ? 'group-hover:bg-danger group-hover:text-white' : 
          isWarning ? 'group-hover:bg-accent-warm group-hover:text-white' : 
          'group-hover:bg-accent group-hover:text-white'}`}
      >
        <div className={`transition-transform duration-500 group-hover:scale-105 ${textColor} group-hover:text-white transform`}>
          {icon}
        </div>
      </div>

      <div className="flex flex-col gap-0 relative z-10 leading-tight text-left flex-grow">
        <strong className="text-[13px] font-black tracking-tight text-text group-hover:text-accent transition-colors leading-none">
          {label}
        </strong>
        <span className="text-[8px] font-black text-text-muted uppercase tracking-[0.12em] opacity-50 group-hover:opacity-100 transition-all flex items-center gap-1.5">
          <span className={`w-1 h-px bg-current opacity-20 group-hover:w-2 transition-all`} />
          {sublabel}
        </span>
      </div>

      {/* Decorative pulse point */}
      <div className="absolute top-3 right-5 w-1 h-1 rounded-full bg-current opacity-0 group-hover:opacity-15 transition-opacity animate-pulse" />
    </motion.button>
  );
}

