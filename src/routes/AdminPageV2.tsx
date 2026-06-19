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
  MoreHorizontal,
  FileText,
  X,
  User,
  Mail,
  Heart,
  Package,
  Droplets
} from "lucide-react";
import { Link } from "react-router-dom";
import { StatusPill } from "../components/StatusPill";
import { SurfaceCard } from "../components/layout/SurfaceCard";
import { MetricCardPremium } from "../components/MetricCardPremium";
import { Menu } from "../components/ui/fluid-menu";
import { FleetMap } from "../components/FleetMap";
import { useLockerController } from "../features/useLockerController";
import { useTranslation } from "../store/useTranslation";
import { formatDateTime, getHoursRemaining } from "../utils/format";
import { calculateQualityScore, getQualityStage, getQualityLabel, MAX_SHELF_LIFE } from "../utils/safety";
import { useState, useEffect, useMemo } from "react";
import { ScrollReveal } from "../components/ScrollReveal";
import { TextReveal } from "../components/TextReveal";
import { generateTelemetryPDF } from "../utils/pdfGenerator";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../services/firebase";
import { subscribeTelemetry, rtdbToDomainTelemetry } from "../services/rtdb";
import type { FleetLockerSummary, DonationRecord } from "../types/domain";
import { ActiveCommunityCalendar } from "../components/ActiveCommunityCalendar";

// Derive fleet data from real state for PDF generation
function deriveFleetForPDF(lockers: any[]): FleetLockerSummary[] {
  const totalUnits = lockers.length;
  const occupiedLockers = lockers.filter((l: any) => l.occupancyState === 'occupied' || l.occupancyState === 'spoiled');
  return [{
    lockerId: "kiosk-delta",
    lockerLabel: "Kiosk Delta (THIS DEVICE)",
    zoneLabel: "Campus Gate — Active Kiosk",
    coordinates: { x: 75, y: 52 },
    occupancyState: occupiedLockers.length > 0 ? "occupied" : "empty",
    foodQualityScore: "fresh",
    faultState: "none",
    lastSyncedAt: new Date().toISOString(),
    sensorHealth: "healthy",
    heuristicGasProfile: ["Active monitoring"],
    totalUnits,
    occupiedUnits: occupiedLockers.length,
    freeUnits: totalUnits - occupiedLockers.length,
  }];
}

export function AdminPageV2() {
  const { t } = useTranslation();
  const { state, dispatch, selectLocker, currentLocker, clearFault, syncNow, reconnectLocker, resetDonations, signOut } = useLockerController();
  const fleet = deriveFleetForPDF(state.lockers);
  const [showSafeSelector, setShowSafeSelector] = useState(false);

  // ── Firestore: Live donation counts ──
  const [firestoreDonationCount, setFirestoreDonationCount] = useState<number | null>(null);
  const [firestoreRetrievalCount, setFirestoreRetrievalCount] = useState<number | null>(null);

  useEffect(() => {
    if (!db || !state.isAdminAuthenticated) return;

    // Listen to donations collection
    const donationsUnsub = onSnapshot(
      collection(db, "donations"),
      (snapshot) => {
        setFirestoreDonationCount(snapshot.size);
        console.log(`[Admin] Firestore donations count: ${snapshot.size}`);
      },
      (error) => {
        console.warn("[Admin] Firestore donations listener error:", error);
      }
    );

    // Listen to retrievals collection
    const retrievalsUnsub = onSnapshot(
      collection(db, "retrievals"),
      (snapshot) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayMs = today.getTime();
        
        let todayCount = 0;
        snapshot.forEach(doc => {
          const data = doc.data();
          if (data.retrievedAt) {
            const retrievedDate = new Date(data.retrievedAt).getTime();
            if (retrievedDate >= todayMs) {
              todayCount++;
            }
          }
        });
        
        setFirestoreRetrievalCount(todayCount);
        console.log(`[Admin] Firestore today's retrievals count: ${todayCount} (out of ${snapshot.size} total)`);
      },
      (error) => {
        console.warn("[Admin] Firestore retrievals listener error:", error);
      }
    );

    return () => {
      donationsUnsub();
      retrievalsUnsub();
    };
  }, [state.isAdminAuthenticated]);

  // ── RTDB: Live telemetry subscription for selected locker ──
  useEffect(() => {
    if (!state.isAdminAuthenticated || !currentLocker) return;

    const unsub = subscribeTelemetry(currentLocker.lockerId, (rtdbData) => {
      if (rtdbData && rtdbData.timestamp > 0) {
        const domainTelemetry = rtdbToDomainTelemetry(rtdbData);
        dispatch({
          type: "patch-locker",
          id: currentLocker.lockerId,
          locker: {
            telemetry: domainTelemetry,
            lastSyncedAt: new Date().toISOString()
          }
        });
      }
    });

    return unsub;
  }, [state.isAdminAuthenticated, currentLocker?.lockerId, dispatch]);

  // ── Computed stats with Firestore primary, local fallback ──
  const totalDonations = useMemo(() => {
    const local = state.donationHistory.length + state.lockers.filter(l => l.activeDonation).length;
    if (firestoreDonationCount !== null) return Math.max(firestoreDonationCount, local);
    return local;
  }, [firestoreDonationCount, state.donationHistory.length, state.lockers]);

  const mealsServed = useMemo(() => {
    if (firestoreRetrievalCount !== null) {
      // If Firestore is connected, we use its count, but ensure it doesn't drop below session retrievals
      const localSessionRetrievals = state.logs.filter(log => log.type === 'unlock' && log.detail.includes('retrieved')).length;
      return Math.max(firestoreRetrievalCount, localSessionRetrievals);
    }
    // Fallback: count retrievals from the current session logs
    return state.logs.filter(log => log.type === 'unlock' && log.detail.includes('retrieved')).length;
  }, [firestoreRetrievalCount, state.logs]);

  const handleGeneratePDF = (targetLocker = currentLocker) => {
    // Calculate Receiver Telemetry (Freshness Analysis)
    const deadline = targetLocker.deadlineEstimate;
    const hrsRemaining = deadline ? getHoursRemaining(deadline.absoluteIso) : 0;
    const finalHrs = isNaN(hrsRemaining) ? (deadline?.hoursRemaining || 0) : hrsRemaining;
    
    const qualityScore = calculateQualityScore(finalHrs);
    const stage = getQualityStage(qualityScore);
    const riskLevel = stage === "spoilt" ? "Critical" : stage === "aging" ? "Warning" : "Safe";
    const spoilageStatus = getQualityLabel(stage);
    
    const aiInsight = stage === "spoilt" 
      ? "Critical Risk: Immediate intervention required to prevent spoilage. Unit stability is compromised."
      : stage === "aging" 
        ? "Warning: Quality degradation detected. Community pickup should be prioritized immediately."
        : "Conditions Optimal: Food quality is stable and safe for distribution. No immediate action required.";

    generateTelemetryPDF({
      terminalId: "KSK-9902",
      generatedBy: "Admin User",
      timestamp: new Date().toISOString(),
      fleet: fleet,
      currentLocker: targetLocker,
      stats: {
        totalDonations: String(totalDonations),
        activeLockers: `${state.lockers.filter(l => l.occupancyState !== 'empty').length}/${state.lockers.length}`,
        mealsServed: String(mealsServed)
      },
      foodItem: targetLocker.activeDonation ? {
        name: targetLocker.activeDonation.foodName,
        category: targetLocker.activeDonation.categoryLabel,
        donor: targetLocker.activeDonation.donorName
      } : {
        name: "N/A (System Check)",
        category: "N/A",
        donor: "N/A"
      },
      receiverTelemetry: {
        qualityScore,
        hoursRemaining: finalHrs,
        riskLevel,
        aiInsight,
        spoilageStatus
      },
      communityContributions: state.lockers
        .filter(l => l.activeDonation)
        .map(l => ({
          lockerId: l.lockerId,
          donorName: l.activeDonation!.donorName,
          donorContact: l.activeDonation!.donorContact,
          foodName: l.activeDonation!.foodName,
          dietTag: l.activeDonation!.dietTag,
          qualityScore: getQualityLabel(l.activeDonation!.latestQualityScore as any),
          createdAt: l.activeDonation!.createdAt
        }))
    });
    setShowSafeSelector(false);
  };

  if (!state.isAdminAuthenticated) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] as const }}
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
              <TextReveal mode="words" direction="up" distance={15} delay={0.1}>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-accent" />
                    <p className="text-[11px] font-black tracking-widest uppercase text-accent m-0 leading-none">FLEET OVERVIEW</p>
                  </div>
              </TextReveal>
              <TextReveal mode="words" direction="up" distance={20} delay={0.2}>
                <h2 className="text-3xl md:text-4xl leading-[1.05] font-black tracking-tight mb-3 text-text drop-shadow-sm dark:drop-shadow-none">
                  Maintenance and<br />safety dashboard
                </h2>
              </TextReveal>
              <TextReveal mode="block" direction="up" distance={20} delay={0.3} threshold={0.1}>
                <p className="text-text-muted font-medium text-base md:text-[17px] leading-relaxed max-w-[500px]">
                  Monitor every locker, inspect active donations, and open the current kiosk for deeper cleaning or safety actions.
                </p>
              </TextReveal>
            </div>
            
            <div className="hero-actions flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-4">
                <HeroActionButton 
                  to="/connect"
                  icon={<Settings2 className="w-5 h-5" />}
                  label="CONNECT"
                  accent="teal"
                  index={0}
                />
                
                <HeroActionButton 
                  onClick={() => setShowSafeSelector(true)}
                  icon={<Box className="w-6 h-6" />}
                  label="AUDIT REPORT"
                  accent="teal"
                  featured
                  index={1}
                />
                

                
                <HeroActionButton 
                  onClick={signOut}
                  icon={<LogOut className="w-5 h-5" />}
                  label="SIGNOUT"
                  accent="rose"
                  index={2}
                />
              </div>
            </div>
          </div>
        </section>
      </ScrollReveal>

      <section className="admin-stats-bar grid grid-cols-1 md:grid-cols-3 gap-5">
        <ScrollReveal direction="up" distance={30} delay={0.1}>
          <MetricCardPremium 
            title={t("totalDonations") || "Total Donations"}
            subtitle={firestoreDonationCount !== null ? "Live from Firebase" : "Local Count"}
            value={String(totalDonations)}
            trend={firestoreDonationCount !== null ? "● LIVE SYNC" : "○ LOCAL"}
            trendDirection="up"
            icon={<BarChart3 className="w-6 h-6" />}
            bgIcon={<BarChart3 className="w-40 h-40" />}
            accentColor="var(--accent)"
            index={0}
          />
        </ScrollReveal>

        <ScrollReveal direction="up" distance={30} delay={0.2}>
          {(() => {
            const total = state.lockers.length;
            const occupied = state.lockers.filter(l => l.occupancyState !== 'empty').length;
            const available = total - occupied;
            return (
              <MetricCardPremium 
                title="SAFE Readiness"
                subtitle="Mission Availability"
                value={`${available}/${total}`}
                trend={`${occupied} OCCUPIED · ${available} AVAILABLE`}
                trendDirection={occupied > 0 ? "neutral" : "up"}
                icon={<Layers className="w-6 h-6" />}
                bgIcon={<Layers className="w-40 h-40" />}
                accentColor="var(--accent-warm)"
                index={1}
              />
            );
          })()}
        </ScrollReveal>

        <ScrollReveal direction="up" distance={30} delay={0.3}>
          <MetricCardPremium 
            title="Meals Served Today"
            subtitle={`Daily Impact — ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
            value={String(mealsServed)}
            trend={firestoreRetrievalCount !== null ? "● LIVE SYNC" : "○ LOCAL"}
            trendDirection="up"
            icon={<Database className="w-6 h-6" />}
            bgIcon={<Database className="w-40 h-40" />}
            accentColor="var(--accent-bright)"
            index={2}
          />
        </ScrollReveal>
      </section>
      <div className="admin-content-layout flex flex-col gap-6 mt-6">
        <ScrollReveal type="zoom" direction="up" distance={40} delay={0.6} parallax={0.1}>
          <div className="obsidian-card premium-noise !p-6 rounded-[2.25rem] group border-emerald-500/20">
            <Scanline />
            <BotanicalDecoration />
            
            <div className="relative z-10">
              <div className="luxe-card-header mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="luxe-card-title-stack">
                  <TextReveal mode="words" direction="left" distance={10} delay={0.1}>
                    <p className="text-[11px] font-black tracking-[0.4em] uppercase text-emerald-600 dark:text-emerald-500/60 mb-2 flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                      Fleet Donation Registry
                    </p>
                  </TextReveal>
                  <TextReveal mode="words" direction="left" distance={15} delay={0.2}>
                    <h3 className="text-3xl font-black tracking-tight text-text leading-none">
                      Active Community Contributions
                    </h3>
                  </TextReveal>
                </div>
                <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-black text-[10px] uppercase tracking-widest">
                  <Heart className="w-3 h-3" />
                  {state.lockers.filter(l => l.activeDonation).length} Active SAFEs
                </div>
              </div>

              {state.lockers.filter(l => l.activeDonation).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {state.lockers.filter(l => l.activeDonation).map((locker, idx) => (
                    <motion.div 
                      key={locker.lockerId}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * idx }}
                      className={`relative p-5 rounded-[1.75rem] border transition-all duration-500 group/donation overflow-hidden cursor-pointer
                        ${locker.lockerId === state.selectedLockerId 
                          ? 'bg-emerald-500/10 border-emerald-500/40 shadow-[0_0_40px_rgba(16,184,129,0.1)]' 
                          : 'bg-panel-elevated/40 dark:bg-white/5 border-line dark:border-white/10 hover:border-emerald-500/30'}`}
                      onClick={() => selectLocker(locker.lockerId)}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg border transition-all duration-500
                              ${locker.lockerId === state.selectedLockerId ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'bg-muted/10 dark:bg-white/5 border-line dark:border-white/10 group-hover/donation:border-emerald-500/50'}`}>
                              <User className="w-5 h-5" />
                            </div>
                            <div className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-md bg-emerald-500 text-[7px] font-black text-white uppercase tracking-tighter">
                              {locker.lockerId.replace('chamber-', 'SAFE')}
                            </div>
                          </div>
                          <div className="flex flex-col overflow-hidden">
                            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-500/60 leading-none mb-1">VERIFIED DONOR</span>
                            <span className="text-base font-black text-text truncate leading-tight">{locker.activeDonation?.donorName}</span>
                            <div className="flex items-center gap-1 mt-0.5 opacity-60">
                              <Mail className="w-2.5 h-2.5 text-text-muted" />
                              <span className="text-[9px] font-medium text-text-muted truncate lowercase">{locker.activeDonation?.donorContact}</span>
                            </div>
                          </div>
                        </div>
                        <div className={`w-2 h-2 rounded-full mt-2 ${locker.activeDonation?.latestQualityScore === 'fresh' ? 'bg-emerald-500 shadow-[0_0_8px_#10B981]' : locker.activeDonation?.latestQualityScore === 'aging' ? 'bg-amber-500' : 'bg-rose-500'}`} />
                      </div>

                      <div className="mb-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Package className="w-3 h-3 text-emerald-500" />
                          <span className="text-[8px] font-black uppercase tracking-widest text-text-muted opacity-60">Stored Asset</span>
                        </div>
                        <div className="px-3 py-1.5 rounded-lg bg-panel dark:bg-white/5 border border-line dark:border-white/5">
                          <span className="text-sm font-black text-text tracking-tight">{locker.activeDonation?.foodName}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mb-4">
                        <div className={`p-3 rounded-xl border transition-colors duration-300 flex flex-col gap-0.5
                          ${locker.activeDonation?.dietTag === 'veg' || locker.activeDonation?.dietTag === 'vegan'
                            ? 'bg-emerald-500/[0.08] border-emerald-500/20 text-emerald-700 dark:text-emerald-400' 
                            : 'bg-amber-500/[0.08] border-amber-500/20 text-amber-700 dark:text-amber-400'}`}>
                          <span className="text-[7px] font-black uppercase tracking-widest opacity-60">Dietary</span>
                          <span className="text-[10px] font-black uppercase tracking-widest">
                            {locker.activeDonation?.dietTag || 'Standard'}
                          </span>
                        </div>
                        <div className={`p-3 rounded-xl border transition-colors duration-300 flex flex-col gap-0.5
                          ${locker.activeDonation?.latestQualityScore === 'fresh' 
                            ? 'bg-emerald-500/[0.08] border-emerald-500/20 text-emerald-700 dark:text-emerald-400' 
                            : locker.activeDonation?.latestQualityScore === 'aging'
                            ? 'bg-amber-500/[0.08] border-amber-500/20 text-amber-700 dark:text-amber-400'
                            : 'bg-rose-500/[0.08] border-rose-500/20 text-rose-700 dark:text-rose-400'}`}>
                          <span className="text-[7px] font-black uppercase tracking-widest opacity-60">Quality</span>
                          <span className="text-[10px] font-black uppercase tracking-widest">
                            {locker.activeDonation?.latestQualityScore || 'Nominal'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-line dark:border-white/5">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-text-muted opacity-40" />
                          <span className="text-[9px] font-mono font-bold text-text-muted">{formatDateTime(locker.activeDonation?.createdAt || "")}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                           <span className="text-[8px] font-black uppercase tracking-tighter text-text-muted opacity-40">System Logged</span>
                           <div className="w-1 h-1 rounded-full bg-emerald-500/50" />
                        </div>
                      </div>

                      {/* Selection Glow */}
                      {locker.lockerId === state.selectedLockerId && (
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-[50px] rounded-full pointer-events-none" />
                      )}
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="py-20 flex flex-col items-center justify-center text-center opacity-40 text-text-muted">
                  <div className="w-20 h-20 rounded-full bg-panel-elevated dark:bg-white/5 border border-dashed border-line dark:border-white/20 flex items-center justify-center mb-6">
                    <Database className="w-10 h-10" />
                  </div>
                  <h4 className="text-xl font-black uppercase tracking-[0.4em] mb-2">Registry Standby</h4>
                  <p className="text-sm font-medium max-w-md mx-auto">The fleet is currently waiting for new community donations. Diagnostic streams will activate upon safe deposition.</p>
                </div>
              )}
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal type="zoom" direction="up" distance={40} delay={0.7} parallax={0.1}>
          <ActiveCommunityCalendar />
        </ScrollReveal>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ScrollReveal type="zoom" direction="left" distance={40} delay={0.6} parallax={0.1}>
            <div className="obsidian-card premium-noise !p-6 rounded-[2.25rem] group border-emerald-500/20">
              <Scanline />
              <BotanicalDecoration />
              
              <div className="luxe-card-header flex justify-between items-start mb-10 relative z-10">
                <div className="luxe-card-title-stack">
                <TextReveal mode="words" direction="left" distance={10} delay={0.1}>
                  <p className="text-[11px] font-black tracking-[0.4em] uppercase text-emerald-600 dark:text-emerald-500/60 mb-2 flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-emerald-500" />
                    {t("currentKiosk")}
                  </p>
                </TextReveal>
                <TextReveal mode="words" direction="left" distance={15} delay={0.2}>
                  <h3 className="text-3xl font-black tracking-tight text-text leading-none">
                    Terminal Diagnostics
                  </h3>
                </TextReveal>
                </div>
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shadow-emerald-500/20 shadow-lg">
                  <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              
              {/* Selected locker label */}
              <div className="mb-6 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 inline-flex items-center gap-2 relative z-10">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                  Inspecting: {currentLocker.lockerId.replace('chamber-', 'SAFE ')} {currentLocker.activeDonation ? `— ${currentLocker.activeDonation.foodName}` : '— Empty'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 relative z-10">
                <MetricItem 
                  label="TinyML AI Engine" 
                  value={currentLocker.activeDonation ? "Neural Active" : "Standby"}
                  progress={currentLocker.activeDonation ? 100 : 20}
                  color={currentLocker.activeDonation ? "var(--accent-bright)" : "var(--text-muted)"}
                  icon={<Settings2 className="w-4 h-4" />}
                />
                <MetricItem 
                  label="VOC Sensor Profile" 
                  value={`${currentLocker.telemetry.gasResistanceOhms.toLocaleString()} Ω`}
                  progress={currentLocker.telemetry.gasResistanceOhms > 15000 ? 92 : currentLocker.telemetry.gasResistanceOhms > 5000 ? 60 : 25}
                  color={currentLocker.telemetry.gasResistanceOhms > 15000 ? "var(--accent-bright)" : currentLocker.telemetry.gasResistanceOhms > 5000 ? "var(--warning)" : "var(--danger)"}
                  icon={<Activity className="w-4 h-4" />}
                />
                <MetricItem 
                  label="Atmospheric Temp" 
                  value={`${currentLocker.telemetry.internalTempC.toFixed(1)}°C`}
                  progress={currentLocker.telemetry.internalTempC <= 5 ? 98 : currentLocker.telemetry.internalTempC <= 10 ? 70 : 30}
                  color={currentLocker.telemetry.internalTempC <= 5 ? "var(--accent-bright)" : currentLocker.telemetry.internalTempC <= 10 ? "var(--warning)" : "var(--danger)"}
                  icon={<Activity className="w-4 h-4" />}
                />
                <MetricItem 
                  label="Chamber Humidity" 
                  value={`${currentLocker.telemetry.humidityPct.toFixed(0)}%`}
                  progress={currentLocker.telemetry.humidityPct <= 70 ? 90 : currentLocker.telemetry.humidityPct <= 85 ? 60 : 25}
                  color={currentLocker.telemetry.humidityPct <= 70 ? "var(--accent-bright)" : currentLocker.telemetry.humidityPct <= 85 ? "var(--warning)" : "var(--danger)"}
                  icon={<Droplets className="w-4 h-4" />}
                />
                <MetricItem
                  label="HC-SR04 Distance"
                  value={currentLocker.telemetry.distanceCm != null ? `${currentLocker.telemetry.distanceCm.toFixed(1)} cm` : "—"}
                  progress={currentLocker.telemetry.distanceCm != null ? (currentLocker.telemetry.distanceCm < 34 ? 88 : 10) : 0}
                  color={currentLocker.telemetry.distanceCm != null && currentLocker.telemetry.distanceCm < 34 ? "var(--accent-bright)" : "var(--text-muted)"}
                  icon={<Activity className="w-4 h-4" />}
                />
              </div>
              
              <div className="mt-10 pt-6 border-t border-line dark:border-white/5 flex items-center justify-between relative z-10">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-text-muted opacity-40 mb-1">SYSTEM SYNC</span>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3 h-3 text-emerald-500/50" />
                    <span className="text-[11px] font-mono font-bold text-text-muted">{formatDateTime(currentLocker.lastSyncedAt)}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map(i => (
                    <motion.div 
                      key={i}
                      animate={{ height: [8, 16, 8], opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                      className="w-1 bg-emerald-500/40 rounded-full"
                    />
                  ))}
                </div>
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal type="zoom" direction="right" distance={40} delay={0.8} parallax={0.1}>
            <div className="obsidian-card premium-noise !p-6 rounded-[2.25rem] group border-emerald-500/20">
              <Scanline />
              <BotanicalDecoration />
              
              <div className="luxe-card-header flex justify-between items-start mb-10 relative z-10">
                <div className="luxe-card-title-stack">
                  <TextReveal mode="words" direction="left" distance={10} delay={0.1}>
                    <p className="text-[11px] font-black tracking-[0.4em] uppercase text-emerald-600 dark:text-emerald-500/60 mb-2">{t("systemActions")}</p>
                  </TextReveal>
                  <TextReveal mode="words" direction="left" distance={15} delay={0.2}>
                    <h3 className="text-3xl font-black tracking-tight text-text leading-none">
                      Command Center
                    </h3>
                  </TextReveal>
                </div>
                <motion.button 
                  whileHover={{ rotate: 90, scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-12 h-12 rounded-full bg-panel-elevated/40 dark:bg-white/5 border border-line dark:border-white/10 flex items-center justify-center shadow-lg hover:bg-emerald-500 hover:text-white transition-all text-text-muted"
                >
                  <Settings className="w-5 h-5" />
                </motion.button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
                <ActionButton 
                  onClick={syncNow}
                  icon={<RefreshCcw className="w-5 h-5" />}
                  label="Force Sync"
                  sublabel="Update Records"
                  index={0}
                />
                <ActionButton 
                  onClick={reconnectLocker}
                  icon={<Wifi className="w-5 h-5" />}
                  label="BLE Reset"
                  sublabel="Reset Bridge"
                  index={1}
                />
                <ActionButton 
                  onClick={clearFault}
                  variant="warning"
                  icon={<AlertTriangle className="w-5 h-5" />}
                  label="Clear Fault"
                  sublabel="Acknowledge"
                  index={2}
                />
                <ActionButton 
                  onClick={handleGeneratePDF}
                  icon={<FileText className="w-5 h-5" />}
                  label="Export PDF"
                  sublabel="Telemetry Report"
                  index={3}
                />
                <div className="sm:col-span-2 mt-2">
                  <motion.button
                    onClick={resetDonations}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className="w-full py-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-500 font-black text-xs uppercase tracking-[0.3em] hover:bg-rose-500 hover:text-white transition-all duration-500"
                  >
                    Emergency System Wipe
                  </motion.button>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>

      <ScrollReveal direction="up" distance={40} delay={0.8}>
        <div className="mt-6">
          <FleetMap />
        </div>
      </ScrollReveal>

      <ScrollReveal direction="up" distance={40} delay={0.9}>
        <div className="mt-6 obsidian-card premium-noise !p-6 rounded-[2.25rem] border-emerald-500/20 relative z-10 overflow-hidden">
          <div className="luxe-card-header mb-6 relative z-10">
            <div className="flex items-center gap-2 mb-1">
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
               <span className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500">System Trace</span>
            </div>
            <h3 className="text-2xl font-black text-text tracking-tight">Activity Log</h3>
          </div>
          <div className="space-y-3 relative z-10 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {state.logs.length > 0 ? state.logs.map(log => (
              <div key={log.id} className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 p-4 rounded-xl bg-panel-elevated/50 dark:bg-white/5 border border-line hover:border-emerald-500/30 transition-colors">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-500 tracking-[0.2em]">{log.type.replace('_', ' ')}</span>
                  <p className="text-sm font-medium text-text mt-1">{log.detail || `Event triggered for ${log.lockerId}`}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="px-2 py-1 rounded bg-panel dark:bg-black/20 border border-line">
                    <span className="text-[9px] font-mono text-text-muted">{formatDateTime(log.createdAt)}</span>
                  </div>
                  {log.syncState === 'synced' ? (
                     <Database className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                     <RefreshCcw className="w-3 h-3 text-amber-500 animate-spin" />
                  )}
                </div>
              </div>
            )) : (
              <div className="p-8 text-center border border-dashed border-line rounded-xl">
                <p className="text-sm font-bold text-text-muted opacity-50 uppercase tracking-widest">No Activity Recorded</p>
              </div>
            )}
          </div>
        </div>
      </ScrollReveal>

      <AnimatePresence>
        {showSafeSelector && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
              onClick={() => setShowSafeSelector(false)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-panel border border-line rounded-[3rem] p-8 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-accent/10 rounded-full blur-[100px] pointer-events-none" />
              
              <div className="flex justify-between items-start mb-8">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-accent" />
                    <p className="text-[10px] font-black tracking-widest uppercase text-accent">DIAGNOSTIC EXPORT</p>
                  </div>
                  <h3 className="text-3xl font-black">Select Safe for Report</h3>
                  <p className="text-text-muted mt-2 text-sm font-medium">Select a mission-safe to generate a localized telemetry PDF.</p>
                </div>
                <button 
                  onClick={() => setShowSafeSelector(false)}
                  className="w-12 h-12 rounded-2xl bg-panel-elevated border border-line flex items-center justify-center text-text-muted hover:text-accent transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {state.lockers.slice(0, 8).map((locker, idx) => (
                  <motion.button
                    key={locker.lockerId}
                    whileHover={{ y: -5, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleGeneratePDF(locker)}
                    className="group relative flex flex-col items-center justify-center gap-4 p-6 rounded-[2rem] bg-panel-elevated/40 border border-line hover:border-accent/40 hover:bg-panel-elevated/80 transition-all duration-300"
                  >
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl border-2 transition-all
                      ${locker.occupancyState === 'occupied' ? 'bg-accent/10 border-accent/30 text-accent' : 'bg-panel/50 border-line text-text-muted'}`}>
                      {(idx + 1).toString().padStart(2, '0')}
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] font-black tracking-widest text-text-muted uppercase">SAFE</p>
                      <p className="text-xs font-black text-text group-hover:text-accent transition-colors">UNIT_{locker.lockerId.split('-')[1]}</p>
                    </div>
                  </motion.button>
                ))}
              </div>
              
              <div className="mt-8 pt-6 border-t border-line/20 flex justify-center">
                <div className="flex items-center gap-2 opacity-30">
                  <ShieldCheck className="w-4 h-4 text-accent" />
                  <span className="text-[9px] font-black tracking-widest uppercase text-text">Security Verified Telemetry</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function HeroActionButton({ onClick, to, icon, label, accent = "teal", featured = false, index = 0 }: any) {
  const isRose = accent === "rose";
  
  const content = (
    <div className="relative flex flex-col items-center justify-center gap-3">
      <div className={`icon-container relative z-10 rounded-2xl flex items-center justify-center transition-all duration-700 border
        bg-white dark:bg-panel border-line group-hover:border-transparent group-hover:scale-110 shadow-inner
        ${featured ? 'w-16 h-16 text-accent' : 'w-12 h-12'}
        ${isRose ? 'group-hover:bg-danger group-hover:text-white' : 'group-hover:bg-accent group-hover:text-white'}`}>
        <div className={`transition-transform duration-700 group-hover:rotate-[8deg] ${featured ? 'scale-125' : ''}`}>
          {icon}
        </div>
        
        {/* Glow behind icon */}
        <div className={`absolute inset-0 rounded-2xl blur-xl opacity-0 group-hover:opacity-40 transition-opacity duration-500
          ${isRose ? 'bg-danger' : 'bg-accent'}`} />
      </div>
      
      <div className="flex flex-col items-center text-center">
        <span className={`text-[11px] font-black tracking-[0.25em] uppercase leading-tight transition-colors duration-300 max-w-[100px]
          ${isRose ? 'text-danger/60 group-hover:text-danger' : 'text-text-muted group-hover:text-accent'}`}>
          {label.split(' ').map((word: string, i: number) => (
            <span key={i} className="block">{word}</span>
          ))}
        </span>
        {featured && (
          <motion.div 
            animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-1.5 h-1.5 rounded-full bg-accent mt-2 shadow-[0_0_8px_rgba(20,184,166,0.6)]" 
          />
        )}
      </div>
    </div>
  );

  const wrapperProps = {
    initial: { opacity: 0, scale: 0.9, y: 15 },
    animate: { opacity: 1, scale: 1, y: 0 },
    transition: { delay: 0.1 * index, duration: 0.8, ease: [0.16, 1, 0.3, 1] as const },
    whileHover: { y: -6 },
    whileTap: { scale: 0.95 },
    className: `group relative flex items-center justify-center rounded-[2.8rem] transition-all duration-700 overflow-hidden
      bg-panel-elevated/30 backdrop-blur-3xl border border-line/40
      hover:bg-panel-elevated/60 hover:border-accent/40 hover:shadow-[0_25px_60px_rgba(0,0,0,0.4)]
      ${featured ? 'px-12 py-8 min-w-[180px]' : 'px-8 py-6 min-w-[150px]'}
      ${isRose ? 'hover:border-danger/40 hover:shadow-danger/10' : 'hover:shadow-accent/10'}`
  };

  if (to) {
    return (
      <motion.div {...wrapperProps}>
        <Link to={to} className="w-full h-full flex items-center justify-center z-10">
          {content}
        </Link>
        {/* Background Technical Decoration */}
        <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-accent/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-accent/5 rounded-full blur-[40px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
      </motion.div>
    );
  }

  return (
    <motion.button type="button" onClick={onClick} {...wrapperProps}>
      <div className="relative z-10">
        {content}
      </div>
      {/* Decorative scanline */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-[1.5s] ease-in-out pointer-events-none" />
      {/* Background Technical Decoration */}
      <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-accent/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
      <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-accent/5 rounded-full blur-[40px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
    </motion.button>
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
    <div className={`group/metric relative flex flex-col gap-3 ${wide ? 'w-full' : ''}`}>
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-700 border
          bg-panel-elevated/40 dark:bg-white/5 border-line dark:border-white/5 group-hover/metric:border-emerald-500/40 group-hover/metric:shadow-[0_0_20px_rgba(16,184,129,0.1)]`}>
          <span className="text-text-muted group-hover/metric:text-emerald-600 dark:group-hover/metric:text-emerald-400 transition-all duration-500 transform group-hover/metric:scale-110">{icon}</span>
        </div>
        
        <div className="flex flex-col gap-0.5 flex-grow">
          <div className="flex justify-between items-baseline">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted group-hover/metric:text-emerald-600/60 dark:group-hover/metric:text-emerald-500/60 transition-colors leading-none">{label}</span>
            <span className="text-[10px] font-mono font-bold text-text-muted/40 group-hover/metric:text-emerald-600/40 dark:group-hover/metric:text-emerald-500/40">{progress}%</span>
          </div>
          <strong className={`text-lg font-black tracking-tight transition-colors duration-300
            ${isHealthy ? 'text-text' : isCritical ? 'text-rose-500' : 'text-amber-500'}`}>
            {value}
          </strong>
        </div>
      </div>
      
      <div className="relative h-1.5 w-full bg-muted/10 dark:bg-white/5 rounded-full overflow-hidden border border-line dark:border-white/[0.02]">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] as const }}
          className="h-full rounded-full relative" 
          style={{ 
            background: `linear-gradient(90deg, ${color}44, ${color})`,
            boxShadow: `0 0 15px ${color}44`
          }}
        >
          <motion.div 
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
          />
        </motion.div>
      </div>
    </div>
  );
}

function ActionButton({ onClick, icon, label, sublabel, variant = "default", index = 0 }: any) {
  const isDanger = variant === "danger";
  const isWarning = variant === "warning";
  
  const accents = {
    danger: "rose-500",
    warning: "amber-500",
    default: "emerald-500"
  };

  const accentColor = accents[variant as keyof typeof accents] || accents.default;

  return (
    <motion.button 
      onClick={onClick}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 * index, duration: 0.8, ease: [0.16, 1, 0.3, 1] as const }}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      className="relative flex items-center gap-4 w-full p-4 rounded-3xl border transition-all duration-500 group overflow-hidden
        bg-panel-elevated/40 dark:bg-white/5 border-line dark:border-white/[0.03] hover:border-emerald-500/20 hover:bg-panel-elevated dark:hover:bg-white/[0.08] shadow-2xl"
    >
      <div className={`relative flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 border
        bg-muted/5 dark:bg-white/5 border-line dark:border-white/10 group-hover:border-${accentColor}/50 group-hover:bg-${accentColor}/10`}
      >
        <div className={`transition-transform duration-500 group-hover:scale-110 text-text-muted group-hover:text-${accentColor}`}>
          {icon}
        </div>
      </div>

      <div className="flex flex-col gap-0.5 relative z-10 leading-tight text-left flex-grow">
        <strong className="text-[14px] font-black tracking-tight text-text group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
          {label}
        </strong>
        <span className="text-[9px] font-black text-text-muted uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-all flex items-center gap-2">
          {sublabel}
        </span>
      </div>

      {/* Decorative hover glow */}
      <div className={`absolute -right-4 -bottom-4 w-12 h-12 bg-${accentColor}/10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700`} />
    </motion.button>
  );
}

