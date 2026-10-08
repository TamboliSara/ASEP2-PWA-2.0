import { motion, AnimatePresence } from "framer-motion";
import { 
  ShieldCheck, 
  MoveRight, 
  BarChart3, 
  Box, 
  Database,
  Map as MapIcon,
  LogOut,
  Settings2,
  Layers,
  MoreHorizontal,
  X,
  Globe,
  Wifi,
  ScanLine,
  Search,
  Copy,
  Check,
  Smartphone,
  Laptop,
  Clock,
  User,
  Phone,
  Radio,
  QrCode,
  Shield,
  Activity,
  Sparkles,
  ArrowUpRight,
  Trash2,
  AlertTriangle,
  Loader2
} from "lucide-react";
import { Link } from "react-router-dom";
import { StatusPill } from "../components/controls/StatusPill";
import { SurfaceCard } from "../components/layout/SurfaceCard";
import { MetricCardPremium } from "../components/safety/MetricCardPremium";
import { Menu } from "../components/ui/fluid-menu";
import { useLockerController } from "../features/locker/useLockerController";
import { useTranslation } from "../store/useTranslation";
import {
  formatDateTime,
  getHoursRemaining,
  toLocalDigits,
  translateFoodName,
  translateDonorName,
  translateCategory
} from "../utils/format";
import { calculateQualityScore, getQualityStage, getQualityLabel, MAX_SHELF_LIFE } from "../utils/safety";
import { useState, useEffect, useMemo } from "react";
import { ScrollReveal } from "../components/effects/ScrollReveal";
import { TextReveal } from "../components/effects/TextReveal";
import { generateTelemetryPDF } from "../utils/pdfGenerator";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { db } from "../services/firebase";
import { clearAllQrSessions, type QrSession } from "../services/qrSessionService";
import { subscribeTelemetry, rtdbToDomainTelemetry } from "../services/rtdb";
import type { FleetLockerSummary, DonationRecord } from "../types/domain";
import { ActiveCommunityCalendar } from "../features/calendar/ActiveCommunityCalendar";

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

// Helper: Parse client User-Agent into clean device & browser telemetry
function parseUserAgent(ua?: string): { os: string; browser: string; iconType: "mobile" | "desktop" } | null {
  if (!ua || !ua.trim()) return null;
  const lower = ua.toLowerCase();
  
  let os = "Desktop";
  let iconType: "mobile" | "desktop" = "desktop";
  if (lower.includes("android")) {
    const vMatch = ua.match(/Android\s+([0-9\.]+)/i);
    os = vMatch ? `Android ${vMatch[1]}` : "Android";
    iconType = "mobile";
  } else if (lower.includes("iphone") || lower.includes("ipad") || lower.includes("ios")) {
    os = lower.includes("ipad") ? "iPadOS" : "iOS";
    iconType = "mobile";
  } else if (lower.includes("windows")) {
    os = "Windows";
  } else if (lower.includes("macintosh") || lower.includes("mac os")) {
    os = "macOS";
  } else if (lower.includes("linux")) {
    os = "Linux";
  }
  
  let browser = "Browser";
  if (lower.includes("chrome") && !lower.includes("edg") && !lower.includes("opr")) browser = "Chrome";
  else if (lower.includes("safari") && !lower.includes("chrome")) browser = "Safari";
  else if (lower.includes("firefox")) browser = "Firefox";
  else if (lower.includes("edg")) browser = "Edge";
  else if (lower.includes("opera") || lower.includes("opr")) browser = "Opera";
  
  return { os, browser, iconType };
}

export function AdminPageV2() {
  const { t, locale } = useTranslation();
  const { state, dispatch, currentLocker, signOut } = useLockerController();
  const fleet = deriveFleetForPDF(state.lockers);
  const [showSafeSelector, setShowSafeSelector] = useState(false);

  // ── QR Session IP audit log state ──
  const [qrSessions, setQrSessions] = useState<QrSession[]>([]);
  const [qrSearchQuery, setQrSearchQuery] = useState("");
  const [qrStatusFilter, setQrStatusFilter] = useState<"all" | "scanned" | "verified" | "pending">("all");
  const [copiedIp, setCopiedIp] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearingLogs, setIsClearingLogs] = useState(false);
  const [clearFeedback, setClearFeedback] = useState<string | null>(null);
  const [clearError, setClearError] = useState<string | null>(null);

  const handleExecuteClearLogs = async () => {
    setIsClearingLogs(true);
    setClearError(null);
    try {
      const res = await clearAllQrSessions();
      if (res.success) {
        setQrSessions([]);
        setShowClearConfirm(false);
        setClearFeedback(t("logsClearedSuccess", `Successfully cleared ${res.count} audit logs.`));
        setTimeout(() => setClearFeedback(null), 4000);
      } else {
        setClearError(res.error || t("logsClearFailed", "Failed to clear audit logs. Please try again."));
      }
    } catch (err: any) {
      setClearError(err?.message || t("logsClearFailed", "An unexpected error occurred while clearing logs."));
    } finally {
      setIsClearingLogs(false);
    }
  };

  const copyToClipboard = (text: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedIp(text);
      setTimeout(() => setCopiedIp(null), 2000);
    } catch {
      // fallback
    }
  };

  const qrStats = useMemo(() => {
    const total = qrSessions.length;
    const scanned = qrSessions.filter(s => s.scannedAt || s.phoneIp).length;
    const verified = qrSessions.filter(s => s.verified).length;
    const ips = new Set(qrSessions.map(s => s.phoneIp).filter(Boolean)).size;
    return { total, scanned, verified, ips };
  }, [qrSessions]);

  const filteredQrSessions = useMemo(() => {
    return qrSessions.filter(s => {
      if (qrStatusFilter === "scanned" && !(s.scannedAt || s.phoneIp)) return false;
      if (qrStatusFilter === "verified" && !s.verified) return false;
      if (qrStatusFilter === "pending" && (s.scannedAt || s.verified || s.phoneIp)) return false;

      if (qrSearchQuery.trim()) {
        const q = qrSearchQuery.toLowerCase().trim();
        const matchName = s.donorName?.toLowerCase().includes(q);
        const matchPhone = s.phone?.toLowerCase().includes(q);
        const matchIp = s.phoneIp?.toLowerCase().includes(q);
        const matchUa = s.userAgent?.toLowerCase().includes(q);
        return matchName || matchPhone || matchIp || matchUa;
      }
      return true;
    });
  }, [qrSessions, qrStatusFilter, qrSearchQuery]);

  useEffect(() => {
    if (!db) return;
    const q = query(
      collection(db, "qr_sessions"),
      limit(100)
    );
    const unsub = onSnapshot(q, (snap) => {
      const sessions: QrSession[] = [];
      snap.forEach(d => {
        const data = d.data() as QrSession;
        if (!data.sessionId) data.sessionId = d.id;
        sessions.push(data);
      });
      // Sort newest scans first (based on scannedAt or createdAt)
      sessions.sort((a, b) => {
        const timeA = new Date(a.scannedAt || a.createdAt || 0).getTime();
        const timeB = new Date(b.scannedAt || b.createdAt || 0).getTime();
        return timeB - timeA;
      });
      setQrSessions(sessions);
    }, (err) => {
      console.warn("[Admin] QR sessions listener error:", err);
    });
    return unsub;
  }, [state.isAdminAuthenticated]);

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
        totalDonations: toLocalDigits(totalDonations, locale),
        activeLockers: `${toLocalDigits(state.lockers.filter(l => l.occupancyState !== 'empty').length, locale)}/${toLocalDigits(state.lockers.length, locale)}`,
        mealsServed: toLocalDigits(mealsServed, locale)
      },
      foodItem: targetLocker.activeDonation ? {
        name: translateFoodName(targetLocker.activeDonation.foodName, locale),
        category: translateCategory(targetLocker.activeDonation.categoryLabel, locale),
        donor: translateDonorName(targetLocker.activeDonation.donorName, locale)
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
          donorName: translateDonorName(l.activeDonation!.donorName, locale),
          donorContact: toLocalDigits(l.activeDonation!.donorContact, locale),
          foodName: translateFoodName(l.activeDonation!.foodName, locale),
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
                  {t("adminAuthRequired", "Admin Authorization Required")}
                </p>
                <h2 className="text-4xl md:text-5xl font-black tracking-tight text-text">
                  {t("signIn", "Sign In")}
                </h2>
              </div>
            </div>

            

            <div className="w-full h-px bg-gradient-to-r from-transparent via-line to-transparent opacity-40" />

            <div className="flex flex-col items-center gap-6 w-full">
              <Link 
                className="group relative flex items-center justify-center gap-3 w-full sm:w-auto px-10 py-5 rounded-full bg-accent hover:bg-accent-hover text-white dark:text-black font-black text-lg transition-all duration-300 shadow-[0_10px_40px_rgba(20,184,166,0.3)] hover:shadow-[0_15px_50px_rgba(20,184,166,0.4)] hover:-translate-y-1 active:translate-y-0"
                to="/admin/sign-in"
              >
                <span>{t("continueSignIn", "Continue to Sign In")}</span>
                <MoveRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              
              <div className="flex items-center gap-6 opacity-30">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                  <span className="text-[9px] font-black tracking-widest uppercase text-text">{t("secureShell", "Secure Shell")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent-warm" />
                  <span className="text-[9px] font-black tracking-widest uppercase text-text">{t("auditLogging", "Audit Logging")}</span>
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
              
              <TextReveal mode="words" direction="up" distance={20} delay={0.2}>
                <h2 className="text-3xl md:text-4xl leading-[1.05] font-black tracking-tight mb-3 text-text drop-shadow-sm dark:drop-shadow-none">
                  {t("adminTitle", "Maintenance and safety dashboard")}
                </h2>
              </TextReveal>
              <TextReveal mode="block" direction="up" distance={20} delay={0.3} threshold={0.1}>
                <p className="text-text-muted font-medium text-base md:text-[17px] leading-relaxed max-w-[500px]">
                  {t("adminBody", "Monitor every locker, inspect active donations, and open the current kiosk for deeper cleaning or safety actions.")}
                </p>
              </TextReveal>
            </div>
            
            <div className="hero-actions flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-4">
                <HeroActionButton 
                  to="/connect"
                  icon={<Settings2 className="w-5 h-5" />}
                  label={t("connectNav", "CONNECT")}
                  accent="teal"
                  index={0}
                />
                
                <HeroActionButton 
                  onClick={() => setShowSafeSelector(true)}
                  icon={<Box className="w-6 h-6" />}
                  label={t("auditReport", "AUDIT REPORT")}
                  accent="teal"
                  featured
                  index={1}
                />
                

                
                <HeroActionButton 
                  onClick={signOut}
                  icon={<LogOut className="w-5 h-5" />}
                  label={t("signOut", "SIGNOUT")}
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
            title={t("totalDonations", "Total Donations")}
            subtitle={firestoreDonationCount !== null ? t("liveFromFirebase", "Live from Firebase") : t("localCount", "Local Count")}
            value={toLocalDigits(totalDonations, locale)}
            trend={firestoreDonationCount !== null ? `● ${t("liveSync", "LIVE SYNC")}` : `○ ${t("localTrend", "LOCAL")}`}
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
                title={t("safeReadiness", "SAFE Readiness")}
                subtitle={t("missionAvailability", "Mission Availability")}
                value={`${toLocalDigits(available, locale)}/${toLocalDigits(total, locale)}`}
                trend={`${toLocalDigits(occupied, locale)} ${t("occupiedLabel", "OCCUPIED")} · ${toLocalDigits(available, locale)} ${t("availableLabel", "AVAILABLE")}`}
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
            title={t("mealsServedToday", "Meals Served Today")}
            subtitle={`${t("dailyImpact", "Daily Impact")} — ${toLocalDigits(new Date().toLocaleDateString(locale === 'hi' ? 'hi-IN' : locale === 'mr' ? 'mr-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' }), locale)}`}
            value={toLocalDigits(mealsServed, locale)}
            trend={firestoreRetrievalCount !== null ? `● ${t("liveSync", "LIVE SYNC")}` : `○ ${t("localTrend", "LOCAL")}`}
            trendDirection="up"
            icon={<Database className="w-6 h-6" />}
            bgIcon={<Database className="w-40 h-40" />}
            accentColor="var(--accent-bright)"
            index={2}
          />
        </ScrollReveal>
      </section>
      <div className="admin-content-layout flex flex-col gap-6 mt-6">


        <ScrollReveal type="zoom" direction="up" distance={40} delay={0.7} parallax={0.1}>
          <ActiveCommunityCalendar />
        </ScrollReveal>
      </div>





      {/* ── QR Scan IP Audit Log — Modern & Premium (Light & Dark Theme) ───────────────────────────────────────── */}
      <ScrollReveal direction="up" distance={30} delay={0.85}>
        <div className="mt-8 rounded-[2rem] bg-white dark:bg-[#0c1222] border border-slate-200/90 dark:border-white/10 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.03)] dark:shadow-2xl !p-6 sm:!p-8 relative z-10 overflow-hidden">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-200/80 dark:border-blue-500/25 mb-2.5 shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">{t("securityAuditFeed", "Security Audit Feed")}</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
                {t("qrScanIpAuditLog", "QR Scan — IP Audit Log")}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 max-w-xl leading-relaxed">
                {t("qrAuditSubtitle", "Real-time forensic ledger capturing donor mobile scans, public IP handshakes, and device telemetry.")}
              </p>
            </div>

            <div className="flex items-center gap-2.5 self-start sm:self-center flex-wrap">
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-50 dark:bg-white/[0.05] border border-slate-200/80 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span><strong className="font-mono text-slate-900 dark:text-white">{toLocalDigits(qrStats.scanned, locale)}</strong> {t("scansRecorded", "scans recorded")}</span>
              </span>

              <button
                type="button"
                onClick={() => {
                  setClearError(null);
                  setShowClearConfirm(true);
                }}
                disabled={qrSessions.length === 0 || isClearingLogs}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border border-rose-200/80 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-50/80 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs active:scale-95 cursor-pointer"
                title={qrSessions.length === 0 ? t("noLogsToClear", "No logs to clear") : t("clearAllLogs", "Clear All Logs")}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t("clearAllLogs", "Clear All Logs")}</span>
              </button>
            </div>
          </div>

          {/* Feedback message banner */}
          <AnimatePresence>
            {clearFeedback && (
              <motion.div
                initial={{ opacity: 0, y: -6, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -6, height: 0 }}
                className="mb-5 p-3 rounded-xl bg-emerald-50/90 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between gap-2 shadow-xs"
              >
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>{clearFeedback}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setClearFeedback(null)}
                  className="p-1 rounded-md text-emerald-600 dark:text-emerald-400 hover:opacity-75 transition-opacity cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Minimal Search & Segmented Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-5">
            {/* Search Input */}
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input 
                type="text"
                value={qrSearchQuery}
                onChange={(e) => setQrSearchQuery(e.target.value)}
                placeholder={t("searchDonorPhoneIp", "Search donor, phone, IP...")}
                className="w-full pl-10 pr-9 py-2 rounded-xl bg-slate-50 hover:bg-slate-100/70 dark:bg-white/[0.05] dark:hover:bg-white/[0.07] border border-slate-200/80 dark:border-white/10 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:bg-white dark:focus:bg-white/[0.08] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all shadow-xs"
              />
              {qrSearchQuery && (
                <button 
                  onClick={() => setQrSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  title={t("clearSearch", "Clear search")}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Segmented Filter Pills */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100/80 dark:bg-white/[0.04] border border-slate-200/70 dark:border-white/10 overflow-x-auto">
              {[
                { id: "all", label: t("allLogs", "All Logs"), count: qrSessions.length },
                { id: "scanned", label: t("scanned", "Scanned"), count: qrStats.scanned },
                { id: "verified", label: t("verified", "Verified"), count: qrStats.verified },
                { id: "pending", label: t("pending", "Pending"), count: qrSessions.length - qrStats.scanned },
              ].map(f => {
                const active = qrStatusFilter === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setQrStatusFilter(f.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                      active 
                        ? "bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-xs font-bold border border-slate-200/60 dark:border-transparent" 
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5"
                    }`}
                  >
                    <span>{f.label}</span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md font-bold ${
                      active 
                        ? "bg-blue-50 dark:bg-white/20 text-blue-700 dark:text-white" 
                        : "bg-slate-200/60 dark:bg-white/10 text-slate-600 dark:text-slate-400"
                    }`}>
                      {toLocalDigits(f.count, locale)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-950/40 shadow-xs">
            {filteredQrSessions.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <ScanLine className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  {qrSearchQuery ? t("noMatchingRecords", "No matching records found") : t("noQrScansRecorded", "No QR scans recorded")}
                </p>
                {qrSearchQuery && (
                  <button
                    onClick={() => setQrSearchQuery("")}
                    className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline font-bold"
                  >
                    {t("clearSearch", "Clear search")}
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-white/5 bg-slate-50/80 dark:bg-white/[0.02]">
                    <th className="py-3.5 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap">{t("time", "Time")}</th>
                    <th className="py-3.5 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap">{t("donor", "Donor")}</th>
                    <th className="py-3.5 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap">{t("phone", "Phone")}</th>
                    <th className="py-3.5 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap">{t("publicIpAddress", "Public IP Address")}</th>
                    <th className="py-3.5 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap">{t("status", "Status")}</th>
                    <th className="py-3.5 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap">{t("clientDevice", "Client Device")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {filteredQrSessions.map((s, i) => {
                    const rawTime = s.scannedAt || s.createdAt;
                    const dateObj = rawTime ? new Date(rawTime) : new Date();
                    const parsedClient = parseUserAgent(s.userAgent);
                    const intlLocale = locale === 'hi' ? 'hi-IN' : locale === 'mr' ? 'mr-IN' : 'en-IN';

                    return (
                      <tr
                        key={s.sessionId || `session-${i}`}
                        className="hover:bg-blue-50/30 dark:hover:bg-white/[0.02] transition-colors duration-150 group"
                      >
                        {/* Time */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                              {rawTime
                                ? toLocalDigits(dateObj.toLocaleTimeString(intlLocale, { hour: '2-digit', minute: '2-digit', hour12: true }), locale)
                                : "—"
                              }
                            </span>
                            <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                              {rawTime
                                ? toLocalDigits(dateObj.toLocaleDateString(intlLocale, { day: '2-digit', month: 'short' }), locale)
                                : ""
                              }
                            </span>
                          </div>
                        </td>

                        {/* Donor */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-600/30 dark:to-indigo-600/30 text-blue-700 dark:text-blue-300 font-bold text-xs flex items-center justify-center shrink-0 border border-blue-200/60 dark:border-blue-500/30">
                              {(s.donorName || "G").charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-semibold text-slate-900 dark:text-white text-xs group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                {translateDonorName(s.donorName, locale) || t("guestDonor", "Guest Donor")}
                              </span>
                              {s.sessionId && (
                                <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500">
                                  #{toLocalDigits(s.sessionId.slice(-5), locale)}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Phone */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {s.phone ? (
                            <span className="font-mono text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-white/[0.04] px-2.5 py-1 rounded-md border border-slate-200/60 dark:border-white/5">
                              {toLocalDigits(s.phone.startsWith("+") ? s.phone : `+91 ${s.phone}`, locale)}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono text-xs">—</span>
                          )}
                        </td>

                        {/* Public IP Address */}
                        <td className="py-3.5 px-4 whitespace-nowrap font-mono text-xs">
                          {s.phoneIp ? (
                            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/50 shadow-xs font-semibold">
                              <Globe className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                              <span>{s.phoneIp}</span>
                              <button
                                onClick={() => copyToClipboard(s.phoneIp!)}
                                className="p-1 rounded text-blue-500 hover:text-blue-800 dark:hover:text-white transition-colors cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/50"
                                title={t("copyIpAddress", "Copy IP address")}
                              >
                                {copiedIp === s.phoneIp ? (
                                  <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3 opacity-60 hover:opacity-100" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                              {t("waitingForScan", "Waiting for scan")}
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {s.verified ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/90 dark:border-emerald-800/60 shadow-xs">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              {t("verified", "Verified")}
                            </span>
                          ) : s.scannedAt || s.phoneIp ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200/90 dark:border-amber-800/60 shadow-xs">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                              </span>
                              {t("scanned", "Scanned")}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border border-slate-200/70 dark:border-slate-700">
                              <Clock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                              {t("pending", "Pending")}
                            </span>
                          )}
                        </td>

                        {/* Client Device */}
                        <td className="py-3.5 px-4 max-w-[200px]">
                          {parsedClient ? (
                            <div 
                              className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-200/70 dark:border-white/10 text-xs font-medium text-slate-700 dark:text-slate-300 max-w-[190px] cursor-help"
                              title={s.userAgent}
                            >
                              {parsedClient.iconType === "mobile" ? (
                                <Smartphone className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                              ) : (
                                <Laptop className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
                              )}
                              <span className="truncate">{parsedClient.os} · {parsedClient.browser}</span>
                            </div>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600 font-mono text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* Table Footer */}
            {filteredQrSessions.length > 0 && (
              <div className="py-3 px-4 bg-slate-50/70 dark:bg-white/[0.01] border-t border-slate-200/80 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>
                  {t("showing", "Showing")} <strong className="font-semibold text-slate-800 dark:text-slate-200">{toLocalDigits(filteredQrSessions.length, locale)}</strong> {t("of", "of")} <strong className="font-semibold text-slate-800 dark:text-slate-200">{toLocalDigits(qrSessions.length, locale)}</strong> {t("recordedAuditSessions", "recorded audit sessions")}
                </span>
                <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-semibold text-[11px]">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {t("firestoreRealtimeSyncActive", "Firestore Realtime Sync Active")}
                </span>
              </div>
            )}
          </div>
        </div>
      </ScrollReveal>

      {/* ── Clear QR Audit Logs Confirmation Modal ── */}
      <AnimatePresence>
        {showClearConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
              onClick={() => !isClearingLogs && setShowClearConfirm(false)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-white dark:bg-[#0c1222] border border-slate-200 dark:border-white/10 rounded-[2rem] p-6 sm:p-7 shadow-2xl overflow-hidden z-10"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 flex items-center justify-center shrink-0 text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                    {t("clearAuditLogsTitle", "Clear All Audit Logs?")}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1.5 leading-relaxed">
                    {t("clearAuditLogsDesc", "This will permanently delete all")} <strong className="text-rose-600 dark:text-rose-400 font-bold">{toLocalDigits(qrSessions.length, locale)}</strong> {t("clearAuditLogsDesc2", "recorded audit sessions from Cloud Firestore, including scan timestamps, IP handshakes, and verification telemetry. This action cannot be undone.")}
                  </p>
                </div>
              </div>

              {clearError && (
                <div className="mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-xs text-rose-700 dark:text-rose-300 font-semibold">
                  {clearError}
                </div>
              )}

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={isClearingLogs}
                  onClick={() => setShowClearConfirm(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-white/5 hover:bg-slate-200/70 dark:hover:bg-white/10 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {t("cancel", "Cancel")}
                </button>
                <button
                  type="button"
                  disabled={isClearingLogs}
                  onClick={handleExecuteClearLogs}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500 shadow-md shadow-rose-600/25 transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isClearingLogs ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{t("clearing", "Clearing...")}</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{t("yesClearAll", "Yes, Clear All Logs")}</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                    <p className="text-[10px] font-black tracking-widest uppercase text-accent">{t("diagnosticExport", "DIAGNOSTIC EXPORT")}</p>
                  </div>
                  <h3 className="text-3xl font-black">{t("selectSafeForReport", "Select Safe for Report")}</h3>
                  <p className="text-text-muted mt-2 text-sm font-medium">{t("selectSafeForReportSub", "Select a mission-safe to generate a localized telemetry PDF.")}</p>
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
                      {toLocalDigits((idx + 1).toString().padStart(2, '0'), locale)}
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] font-black tracking-widest text-text-muted uppercase">{t("safeUnit", "SAFE")}</p>
                      <p className="text-xs font-black text-text group-hover:text-accent transition-colors">UNIT_{toLocalDigits(locker.lockerId.split('-')[1], locale)}</p>
                    </div>
                  </motion.button>
                ))}
              </div>
              
              <div className="mt-8 pt-6 border-t border-line/20 flex justify-center">
                <div className="flex items-center gap-2 opacity-30">
                  <ShieldCheck className="w-4 h-4 text-accent" />
                  <span className="text-[9px] font-black tracking-widest uppercase text-text">{t("securityVerifiedTelemetry", "Security Verified Telemetry")}</span>
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



