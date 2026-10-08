import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Filter, 
  User, 
  Mail, 
  Clock, 
  Package, 
  Heart, 
  ShieldCheck, 
  MoreHorizontal,
  X,
  Info,
  Layers,
  CheckCircle2,
  AlertCircle,
  Search,
  List,
  CalendarDays,
  Eye,
  ArrowRight,
  Sparkles,
  Check
} from "lucide-react";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { db } from "../../services/firebase";
import { formatDateTime } from "../../utils/format";
import { TextReveal } from "../../components/effects/TextReveal";
import { ScrollReveal } from "../../components/effects/ScrollReveal";
import { getQualityLabel } from "../../utils/safety";

export interface DonationEntry {
  id: string;
  donorName: string;
  donorContact: string;
  foodName: string;
  categoryLabel: string;
  dietTag: string;
  createdAt: string;
  latestQualityScore: string;
  lockerId: string;
  lockerNumber: number;
  allergensNotes?: string;
  // Top-level status (set to 'retrieved' when item is collected)
  status?: string;
  // Donor biometric (set at deposit)
  donorImageUrl?: string;
  donorImageBase64?: string;
  // Nested receiver sub-document (written by syncRetrieval)
  receiver?: {
    retrievedAt: string;
    retrievedBy: string;
    qualityScoreAtRetrieval: string;
    receiverImageUrl?: string;
    receiverImageBase64?: string;
  };
  // Nested admin override sub-document (null for community retrieval)
  adminOverride?: {
    adminCredentials: string;
    overrideAt: string;
  } | null;
}

const SAFE_COLORS: Record<string, { solid: string, alphaBg: string, alphaBorder: string, text: string, shadow: string, hex: string }> = {
  'chamber-1': { solid: 'bg-blue-500', alphaBg: 'bg-blue-500/10', alphaBorder: 'border-blue-500/40', text: 'text-blue-600 dark:text-blue-400', shadow: 'shadow-blue-500/30', hex: '#3B82F6' },
  'chamber-2': { solid: 'bg-purple-500', alphaBg: 'bg-purple-500/10', alphaBorder: 'border-purple-500/40', text: 'text-purple-600 dark:text-purple-400', shadow: 'shadow-purple-500/30', hex: '#A855F7' },
  'chamber-3': { solid: 'bg-pink-500', alphaBg: 'bg-pink-500/10', alphaBorder: 'border-pink-500/40', text: 'text-pink-600 dark:text-pink-400', shadow: 'shadow-pink-500/30', hex: '#EC4899' },
  'chamber-4': { solid: 'bg-orange-500', alphaBg: 'bg-orange-500/10', alphaBorder: 'border-orange-500/40', text: 'text-orange-600 dark:text-orange-400', shadow: 'shadow-orange-500/30', hex: '#F97316' },
  'chamber-5': { solid: 'bg-teal-500', alphaBg: 'bg-teal-500/10', alphaBorder: 'border-teal-500/40', text: 'text-teal-600 dark:text-teal-400', shadow: 'shadow-teal-500/30', hex: '#14B8A6' },
  'chamber-6': { solid: 'bg-indigo-500', alphaBg: 'bg-indigo-500/10', alphaBorder: 'border-indigo-500/40', text: 'text-indigo-600 dark:text-indigo-400', shadow: 'shadow-indigo-500/30', hex: '#6366F1' },
  'chamber-7': { solid: 'bg-cyan-500', alphaBg: 'bg-cyan-500/10', alphaBorder: 'border-cyan-500/40', text: 'text-cyan-600 dark:text-cyan-400', shadow: 'shadow-cyan-500/30', hex: '#06B6D4' },
  'chamber-8': { solid: 'bg-emerald-500', alphaBg: 'bg-emerald-500/10', alphaBorder: 'border-emerald-500/40', text: 'text-emerald-600 dark:text-emerald-400', shadow: 'shadow-emerald-500/30', hex: '#10B981' },
};

export function ActiveCommunityCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDayDate, setSelectedDayDate] = useState<Date>(new Date());
  const [selectedEvent, setSelectedEvent] = useState<DonationEntry | null>(null);
  const [donations, setDonations] = useState<DonationEntry[]>([]);
  const [selectedLockers, setSelectedLockers] = useState<string[]>(["chamber-1"]);
  const [view, setView] = useState<"week" | "day" | "agenda">("week");
  const [now, setNow] = useState(new Date());
  
  // Stacking modal state
  const [selectedStack, setSelectedStack] = useState<DonationEntry[] | null>(null);
  const [stackSearchQuery, setStackSearchQuery] = useState("");
  const [stackFilterStatus, setStackFilterStatus] = useState<"all" | "fresh" | "aging" | "retrieved">("all");

  // Agenda list view filters
  const [agendaSearchQuery, setAgendaSearchQuery] = useState("");
  const [agendaStatusFilter, setAgendaStatusFilter] = useState<"all" | "active" | "retrieved">("all");
  const [agendaQualityFilter, setAgendaQualityFilter] = useState<"all" | "fresh" | "aging" | "spoilt">("all");

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Keyboard escape handler for modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedEvent) setSelectedEvent(null);
        if (selectedStack) setSelectedStack(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedEvent, selectedStack]);

  // ── Firestore Listener — donations is the single source of truth ─────────
  useEffect(() => {
    if (!db) return;

    const donationsUnsub = onSnapshot(
      query(collection(db, "donations"), orderBy("createdAt", "desc"), limit(100)),
      (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DonationEntry));
        setDonations(docs);
      }
    );

    return () => {
      donationsUnsub();
    };
  }, []);

  // ── All events filtered by selected lockers ───────────────────────────────
  const allEvents = useMemo(() => {
    return donations.filter(d => selectedLockers.includes(d.lockerId));
  }, [donations, selectedLockers]);

  // ── Locker Item Counts (for sidebar indicators) ───────────────────────────
  const lockerCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (let i = 1; i <= 8; i++) {
      counts[`chamber-${i}`] = donations.filter(d => d.lockerId === `chamber-${i}`).length;
    }
    return counts;
  }, [donations]);

  // ── Layout Calculation with Smart Collision Grouping ─────────────────────
  const getEventLayouts = (dayEvents: DonationEntry[]) => {
    if (dayEvents.length === 0) return new Map();

    const layoutItems = [...dayEvents].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).map(event => {
      const start = new Date(event.createdAt);
      const top = (start.getHours() * 30) + (start.getMinutes() / 60 * 30);
      
      let height = 48; // Standard legible card height
      if (event.receiver?.retrievedAt) {
        const dur = (new Date(event.receiver.retrievedAt).getTime() - new Date(event.createdAt).getTime()) / (1000 * 60 * 60) * 30;
        if (dur > 48) height = Math.min(dur, 85);
      }

      return {
        id: event.id,
        event,
        top,
        height,
        bottom: top + height
      };
    });

    // 2. Cluster items that overlap visually in time
    const clusters: (typeof layoutItems)[] = [];
    layoutItems.forEach(item => {
      let foundCluster = false;
      for (const cluster of clusters) {
        // Group if time windows overlap or events start within 45 minutes of each other
        if (cluster.some(cItem => (item.top < cItem.bottom && item.bottom > cItem.top) || Math.abs(item.top - cItem.top) < 25)) {
          cluster.push(item);
          foundCluster = true;
          break;
        }
      }
      if (!foundCluster) clusters.push([item]);
    });

    // 3. Assign layout: single cards, 2-column split, or unified Stack Cards
    const layoutMap = new Map();
    clusters.forEach(cluster => {
      if (cluster.length === 1) {
        // Single donation: full column width
        const item = cluster[0];
        layoutMap.set(item.id, {
          isStack: false,
          stackSize: 1,
          stackEvents: [item.event],
          left: 2,
          width: 96,
          top: item.top,
          height: item.height
        });
      } else if (cluster.length === 2) {
        // 2 donations: neat side-by-side split (no chaotic fan-out)
        cluster.forEach((item, idx) => {
          layoutMap.set(item.id, {
            isStack: false,
            stackSize: 1,
            stackEvents: [item.event],
            left: idx === 0 ? 2 : 51,
            width: 47,
            top: item.top,
            height: item.height
          });
        });
      } else {
        // 3 or MORE donations: Consolidated Stack Card!
        // Instead of generating 15-20 unreadable overlapping slivers,
        // represent the entire cluster with a single interactive Stack Card.
        const clusterEvents = cluster.map(c => c.event);
        const minTop = Math.min(...cluster.map(c => c.top));
        const maxBottom = Math.max(...cluster.map(c => c.bottom));
        const stackHeight = Math.max(56, Math.min(96, maxBottom - minTop));

        const stackLayout = {
          isStack: true,
          stackSize: cluster.length,
          stackEvents: clusterEvents,
          left: 2,
          width: 96,
          top: minTop,
          height: stackHeight
        };

        cluster.forEach(item => {
          layoutMap.set(item.id, stackLayout);
        });
      }
    });

    return layoutMap;
  };

  // ── Calendar Week Helpers ──────────────────────────────────────────
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  
  const getWeekRange = (date: Date) => {
    const start = new Date(date);
    start.setDate(date.getDate() - date.getDay());
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const currentWeek = useMemo(() => getWeekRange(currentDate), [currentDate]);

  const prevPeriod = () => {
    if (view === "day") {
      const d = new Date(selectedDayDate);
      d.setDate(d.getDate() - 1);
      setSelectedDayDate(d);
      setCurrentDate(d);
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 7);
      setCurrentDate(d);
    }
  };

  const nextPeriod = () => {
    if (view === "day") {
      const d = new Date(selectedDayDate);
      d.setDate(d.getDate() + 1);
      setSelectedDayDate(d);
      setCurrentDate(d);
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 7);
      setCurrentDate(d);
    }
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDayDate(today);
  };

  const toggleLocker = (id: string) => {
    setSelectedLockers(prev => 
      prev.includes(id) 
        ? (prev.length > 1 ? prev.filter(l => l !== id) : prev) 
        : [...prev, id]
    );
  };

  const selectAllLockers = () => {
    setSelectedLockers([1, 2, 3, 4, 5, 6, 7, 8].map(n => `chamber-${n}`));
  };

  const selectSingleLocker = (id: string) => {
    setSelectedLockers([id]);
  };

  // ── Filtered events for Stack Modal ─────────────────────────────────
  const filteredStackEvents = useMemo(() => {
    if (!selectedStack) return [];
    return selectedStack.filter(item => {
      if (stackFilterStatus === "fresh" && item.latestQualityScore !== "fresh") return false;
      if (stackFilterStatus === "aging" && item.latestQualityScore !== "aging") return false;
      if (stackFilterStatus === "retrieved" && item.status !== "retrieved") return false;

      if (stackSearchQuery.trim()) {
        const q = stackSearchQuery.toLowerCase();
        return (
          item.foodName.toLowerCase().includes(q) ||
          item.donorName.toLowerCase().includes(q) ||
          item.donorContact.toLowerCase().includes(q) ||
          item.lockerId.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [selectedStack, stackFilterStatus, stackSearchQuery]);

  // ── Filtered events for Agenda List View ────────────────────────────
  const agendaEvents = useMemo(() => {
    return allEvents.filter(item => {
      if (agendaStatusFilter === "active" && item.status === "retrieved") return false;
      if (agendaStatusFilter === "retrieved" && item.status !== "retrieved") return false;

      if (agendaQualityFilter !== "all" && item.latestQualityScore !== agendaQualityFilter) return false;

      if (agendaSearchQuery.trim()) {
        const q = agendaSearchQuery.toLowerCase();
        return (
          item.foodName.toLowerCase().includes(q) ||
          item.donorName.toLowerCase().includes(q) ||
          item.donorContact.toLowerCase().includes(q) ||
          item.categoryLabel?.toLowerCase().includes(q) ||
          item.lockerId.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allEvents, agendaStatusFilter, agendaQualityFilter, agendaSearchQuery]);

  // Group agenda events by date
  const agendaGroupedByDate = useMemo(() => {
    const groups: Record<string, DonationEntry[]> = {};
    agendaEvents.forEach(item => {
      const dateKey = new Date(item.createdAt).toDateString();
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(item);
    });
    return groups;
  }, [agendaEvents]);

  // Day Focus Events
  const dayFocusEvents = useMemo(() => {
    const targetDateStr = selectedDayDate.toDateString();
    return allEvents.filter(e => new Date(e.createdAt).toDateString() === targetDateStr);
  }, [allEvents, selectedDayDate]);

  return (
    <div className="active-community-calendar mt-8">
      <div className="obsidian-card premium-noise !p-0 rounded-[2.5rem] border border-emerald-500/20 overflow-hidden shadow-2xl">
        {/* Calendar Header */}
        <div className="p-6 md:p-8 border-b border-line/40 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-panel/30 backdrop-blur-xl">
          <div className="flex items-center gap-5">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shadow-[0_0_20px_rgba(16,184,129,0.1)] shrink-0"
            >
              <CalendarIcon className="w-7 h-7 text-emerald-500" />
            </motion.div>
            <div>
              <TextReveal mode="words" direction="left" distance={10} delay={0.1}>
                <h3 className="text-2xl font-black tracking-tight text-text">Contribution Timeline</h3>
              </TextReveal>
              <p className="text-xs text-text-muted mt-0.5">
                {view === "week" && "Interactive 7-day schedule with smart grouped stacks"}
                {view === "day" && `Focused timeline for ${selectedDayDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`}
                {view === "agenda" && "Chronological audit list with search & deep inspection"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto justify-between xl:justify-end">
            {/* View Mode Switcher */}
            <div className="flex items-center bg-panel-elevated/80 p-1 rounded-2xl border border-line/40 gap-1 shadow-inner">
              <button
                onClick={() => setView("week")}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  view === "week" 
                    ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/25" 
                    : "text-text-muted hover:text-text hover:bg-white/5"
                }`}
                title="7-Day Week Overview"
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Week</span>
              </button>
              <button
                onClick={() => setView("day")}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  view === "day" 
                    ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/25" 
                    : "text-text-muted hover:text-text hover:bg-white/5"
                }`}
                title="Single Day Focused Timeline"
              >
                <Clock className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Day Focus</span>
              </button>
              <button
                onClick={() => setView("agenda")}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  view === "agenda" 
                    ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/25" 
                    : "text-text-muted hover:text-text hover:bg-white/5"
                }`}
                title="Accessible List & Search View"
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Agenda List</span>
              </button>
            </div>

            {/* Quick Metrics */}
            <div className="hidden sm:flex items-center gap-4 px-3 py-1.5 rounded-2xl bg-panel-elevated/40 border border-line/20">
              <div className="text-right">
                <p className="text-[9px] font-black uppercase tracking-widest text-text-muted opacity-60">Total Items</p>
                <p className="text-lg font-black text-emerald-500 leading-none mt-0.5">{allEvents.length}</p>
              </div>
              <div className="w-px h-6 bg-line/40" />
              <div className="text-left">
                <p className="text-[9px] font-black uppercase tracking-widest text-text-muted opacity-60">In Locker</p>
                <p className="text-lg font-black text-amber-500 leading-none mt-0.5">
                  {allEvents.filter(e => e.status !== 'retrieved').length}
                </p>
              </div>
            </div>

            {/* Period Navigator */}
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-panel-elevated/50 rounded-2xl p-1 border border-line/40 shadow-inner">
                <button 
                  onClick={prevPeriod}
                  className="p-2.5 rounded-xl hover:bg-white/10 text-text-muted transition-colors cursor-pointer"
                  title="Previous period"
                  aria-label="Previous period"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-4 py-1.5 font-black text-xs uppercase tracking-widest text-text whitespace-nowrap min-w-[140px] text-center">
                  {view === "day" 
                    ? selectedDayDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                    : `${currentWeek[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${currentWeek[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                  }
                </span>
                <button 
                  onClick={nextPeriod}
                  className="p-2.5 rounded-xl hover:bg-white/10 text-text-muted transition-colors cursor-pointer"
                  title="Next period"
                  aria-label="Next period"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              
              <button 
                onClick={goToToday}
                className="px-5 py-3 rounded-2xl bg-emerald-500 text-white font-black text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
              >
                Today
              </button>
            </div>
          </div>
        </div>

        {/* Calendar Body Layout */}
        <div className="flex flex-col lg:flex-row min-h-[600px]">
          {/* Sidebar Filters */}
          <div className="w-full lg:w-72 border-r border-line/40 p-6 bg-panel/10 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-500" />
                  <span className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-600 dark:text-emerald-400">Fleet Units</span>
                </div>
                {/* Fast select actions */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={selectAllLockers}
                    className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg bg-panel-elevated hover:bg-emerald-500/20 hover:text-emerald-400 border border-line/40 transition-colors cursor-pointer text-text-muted"
                    title="Select all units"
                  >
                    All
                  </button>
                  <button
                    onClick={() => selectSingleLocker("chamber-1")}
                    className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg bg-panel-elevated hover:bg-emerald-500/20 hover:text-emerald-400 border border-line/40 transition-colors cursor-pointer text-text-muted"
                    title="Focus Safe 1"
                  >
                    SAFE-01
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-2.5">
                {[1, 2, 3, 4, 5, 6, 7, 8].map(num => {
                  const id = `chamber-${num}`;
                  const isActive = selectedLockers.includes(id);
                  const safeColor = SAFE_COLORS[id] || SAFE_COLORS['chamber-8'];
                  const count = lockerCounts[id] || 0;

                  return (
                    <button
                      key={id}
                      onClick={() => toggleLocker(id)}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-200 cursor-pointer group text-left
                        ${isActive 
                          ? `${safeColor.alphaBg} ${safeColor.alphaBorder} ${safeColor.text} shadow-sm` 
                          : 'bg-panel-elevated/20 border-line/30 text-text-muted opacity-50 hover:opacity-100 hover:border-line'}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-2.5 h-2.5 rounded-full ${isActive ? `${safeColor.solid} animate-pulse` : 'bg-muted'}`} />
                        <span className="text-xs font-black tracking-widest uppercase">SAFE-0{num}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {count > 0 && (
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${isActive ? 'bg-black/20 text-text' : 'bg-muted/30 text-text-muted'}`}>
                            {count}
                          </span>
                        )}
                        {isActive && <CheckCircle2 className="w-3.5 h-3.5 shrink-0 opacity-70" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Legend & Accessibility Notice */}
            <div className="mt-8 pt-6 border-t border-line/20">
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-3.5 h-3.5 text-emerald-500/70" />
                <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">Status Legend</span>
              </div>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-[10px] font-bold text-text-muted">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,184,129,0.5)]" />
                    <span className="uppercase">Fresh / Optimal</span>
                  </div>
                  <span className="opacity-60">{allEvents.filter(e => e.latestQualityScore === 'fresh').length}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-bold text-text-muted">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                    <span className="uppercase">Aging / Alert</span>
                  </div>
                  <span className="opacity-60">{allEvents.filter(e => e.latestQualityScore === 'aging').length}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-bold text-text-muted">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" />
                    <span className="uppercase">Spoilt / Critical</span>
                  </div>
                  <span className="opacity-60">{allEvents.filter(e => e.latestQualityScore === 'spoilt').length}</span>
                </div>
              </div>

              <div className="mt-6 p-3 rounded-xl bg-panel-elevated/40 border border-line/30 text-[10px] text-text-muted leading-relaxed">
                💡 <span className="font-bold text-text">Pro tip:</span> Click any day header to zoom in, or use <strong>Agenda List</strong> to filter donations with zero clutter.
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════
              VIEW 1: WEEK GRID VIEW (Smart Collision Stacking)
             ══════════════════════════════════════════════════════════════ */}
          {view === "week" && (
            <div className="flex-1 overflow-x-auto">
              <div className="min-w-[820px] h-full flex flex-col">
                {/* Day Headers */}
                <div className="grid grid-cols-7 border-b border-line/20 bg-panel/10">
                  {currentWeek.map((day, idx) => {
                    const isToday = day.toDateString() === new Date().toDateString();
                    const isDaySelected = day.toDateString() === selectedDayDate.toDateString();
                    const countForDay = allEvents.filter(e => new Date(e.createdAt).toDateString() === day.toDateString()).length;

                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          setSelectedDayDate(day);
                        }}
                        onDoubleClick={() => {
                          setSelectedDayDate(day);
                          setView("day");
                        }}
                        className={`p-4 text-center border-r border-line/10 last:border-r-0 transition-all cursor-pointer group relative text-left sm:text-center
                          ${isToday ? 'bg-emerald-500/10' : ''}
                          ${isDaySelected ? 'ring-2 ring-emerald-500/50 ring-inset bg-emerald-500/5' : 'hover:bg-white/[0.03]'}`}
                        title="Click to select date, double-click for Day Focus"
                      >
                        <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-1 ${isToday ? 'text-emerald-500' : 'text-text-muted'}`}>
                          {weekDays[idx]}
                        </p>
                        <div className="flex items-center justify-center gap-2">
                          <p className={`text-xl font-black ${isToday ? 'text-emerald-600 dark:text-emerald-400' : 'text-text'}`}>
                            {day.getDate()}
                          </p>
                          {countForDay > 0 && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              {countForDay}
                            </span>
                          )}
                        </div>
                        {isDaySelected && (
                          <div className="mt-1 flex items-center justify-center gap-1 text-[8px] font-bold text-emerald-400 opacity-90 uppercase tracking-wider">
                            <span>Selected</span>
                            <ArrowRight className="w-2.5 h-2.5 group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Time Grid */}
                <div className="flex-1 relative overflow-y-auto max-h-[560px] custom-scrollbar bg-panel/20">
                  <div className="flex h-full min-h-[720px]">
                    {/* Time Labels */}
                    <div className="w-16 border-r border-line/20 bg-panel/30 relative shrink-0">
                      {[0, 3, 6, 9, 12, 15, 18, 21].map((hour) => (
                        <div key={hour} className="h-[90px] relative flex justify-end pr-2 border-b border-line/10 last:border-b-0">
                          <span className="text-[9px] font-black text-text-muted opacity-50 -translate-y-2 uppercase">
                            {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Days Columns */}
                    <div className="flex-1 grid grid-cols-7 relative">
                      {currentWeek.map((day, dayIdx) => {
                        const isToday = day.toDateString() === now.toDateString();
                        const isDaySelected = day.toDateString() === selectedDayDate.toDateString();

                        return (
                          <div 
                            key={dayIdx} 
                            className={`relative border-r border-line/20 last:border-r-0 group/col 
                              ${isToday ? 'bg-emerald-500/[0.03]' : ''} 
                              ${isDaySelected ? 'bg-emerald-500/[0.02]' : ''}`}
                          >
                            {/* Grid Lines */}
                            {[0, 3, 6, 9, 12, 15, 18, 21].map((hour) => (
                              <div key={hour} className="h-[90px] border-b border-line/15 w-full hover:bg-white/[0.02] transition-colors" />
                            ))}

                            {/* Current Time Indicator */}
                            {isToday && (
                              <div 
                                className="absolute left-0 right-0 h-0.5 bg-emerald-500 z-30 pointer-events-none"
                                style={{ top: `${(now.getHours() * 30) + (now.getMinutes() / 60 * 30)}px` }}
                              >
                                <div className="absolute -left-1.5 -top-1 w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_#10B981]" />
                              </div>
                            )}

                            {/* Events for this day */}
                            {(() => {
                              const dayEvents = allEvents.filter(e => new Date(e.createdAt).toDateString() === day.toDateString());
                              const layoutMap = getEventLayouts(dayEvents);

                              return dayEvents.filter((e, idx, self) => {
                                const layout = layoutMap.get(e.id);
                                if (!layout) return false;
                                if (layout.isStack) {
                                  // Render only 1 stack card per grouped cluster
                                  return self.findIndex(x => x.id === layout.stackEvents[0].id) === idx;
                                }
                                return true;
                              }).map((event) => {
                                const layout = layoutMap.get(event.id);
                                if (!layout) return null;

                                const createdDate = new Date(event.createdAt);
                                const isRetrieved = event.status === 'retrieved';
                                const safeColor = SAFE_COLORS[event.lockerId] || SAFE_COLORS['chamber-8'];
                                const qualityColor = event.latestQualityScore === 'fresh' 
                                  ? 'bg-emerald-400' 
                                  : event.latestQualityScore === 'aging' 
                                    ? 'bg-amber-400' 
                                    : 'bg-rose-400';

                                // ── CASE A: GROUPED STACK CARD (3+ donations in this time slot) ──
                                if (layout.isStack) {
                                  const freshCount = layout.stackEvents.filter((item: DonationEntry) => item.latestQualityScore === 'fresh').length;
                                  const agingCount = layout.stackEvents.filter((item: DonationEntry) => item.latestQualityScore === 'aging').length;
                                  const critCount = layout.stackEvents.filter((item: DonationEntry) => item.latestQualityScore === 'spoilt').length;

                                  return (
                                    <motion.button
                                      key={`stack-${event.id}`}
                                      onClick={() => {
                                        setSelectedStack(layout.stackEvents);
                                        setStackSearchQuery("");
                                        setStackFilterStatus("all");
                                      }}
                                      whileHover={{ scale: 1.02, y: -2 }}
                                      whileTap={{ scale: 0.98 }}
                                      className="absolute p-2 rounded-2xl bg-gradient-to-br from-[#122822] to-[#1c3830] border-2 border-emerald-500/60 text-white shadow-xl hover:shadow-2xl hover:border-emerald-400 cursor-pointer overflow-hidden flex flex-col justify-between group/stack transition-all duration-200 z-20 text-left"
                                      style={{ 
                                        top: `${layout.top}px`, 
                                        left: `${layout.left}%`,
                                        width: `${layout.width}%`,
                                        height: `${layout.height}px`
                                      }}
                                      title={`Stack of ${layout.stackSize} donations. Click to inspect.`}
                                      aria-label={`Stack of ${layout.stackSize} donations. Click to inspect.`}
                                    >
                                      {/* Header: Stack count badge + Quality dots */}
                                      <div className="flex items-center justify-between w-full">
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-500/25 border border-emerald-400/30 text-[9px] font-black uppercase tracking-wider text-emerald-300">
                                          <Layers className="w-3 h-3 text-emerald-300 animate-pulse" />
                                          <span>{layout.stackSize} Items</span>
                                        </div>

                                        <div className="flex items-center gap-1">
                                          {freshCount > 0 && <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" title={`${freshCount} Fresh`} />}
                                          {agingCount > 0 && <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_#fbbf24]" title={`${agingCount} Aging`} />}
                                          {critCount > 0 && <span className="w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_6px_#f87171]" title={`${critCount} Critical`} />}
                                        </div>
                                      </div>

                                      {/* Center: Headline & Subtitle */}
                                      <div className="my-auto py-0.5 overflow-hidden">
                                        <p className="text-[11px] font-black text-white truncate drop-shadow-sm">
                                          {layout.stackEvents[0].foodName}
                                          {layout.stackSize > 1 ? ` +${layout.stackSize - 1}` : ''}
                                        </p>
                                        <p className="text-[8px] font-bold text-emerald-300/80 uppercase tracking-widest truncate">
                                          Click to browse stack →
                                        </p>
                                      </div>

                                      {/* Bottom: Time range */}
                                      <div className="flex items-center gap-1 text-[8px] font-semibold text-emerald-200/70">
                                        <Clock className="w-2.5 h-2.5" />
                                        <span>
                                          {createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                      </div>
                                    </motion.button>
                                  );
                                }

                                // ── CASE B: INDIVIDUAL DONATION CARD (1 or 2 items) ──
                                const blockStyle = isRetrieved 
                                  ? 'bg-slate-800/90 border border-slate-600/50 text-slate-200' 
                                  : `${safeColor.solid} border border-white/20 text-white`;

                                return (
                                  <motion.button
                                    key={event.id}
                                    onClick={() => setSelectedEvent(event)}
                                    whileHover={{ scale: 1.02, y: -2 }}
                                    whileTap={{ scale: 0.98 }}
                                    className={`absolute p-2 rounded-2xl ${blockStyle} shadow-lg hover:shadow-xl cursor-pointer overflow-hidden flex flex-col justify-between group/event transition-all duration-200 text-left z-10`}
                                    style={{ 
                                      top: `${layout.top}px`, 
                                      left: `${layout.left}%`,
                                      width: `${layout.width}%`,
                                      height: `${layout.height}px`
                                    }}
                                    title={`${event.foodName} (${event.lockerId.replace('chamber-', 'SAFE-')}) - Click for details`}
                                    aria-label={`${event.foodName} (${event.lockerId.replace('chamber-', 'SAFE-')}) - Click for details`}
                                  >
                                    <div className="flex items-start justify-between w-full">
                                      <div className="flex items-center gap-1.5 overflow-hidden w-full">
                                        <div className={`shrink-0 w-2 h-2 rounded-full border border-white/40 ${qualityColor} shadow-md`} />
                                        <h4 className="font-black truncate text-[11px] drop-shadow-md text-white leading-tight">
                                          {event.foodName}
                                        </h4>
                                      </div>
                                      {isRetrieved && <CheckCircle2 className="shrink-0 w-3 h-3 text-emerald-300 ml-1" />}
                                    </div>

                                    <div className="flex items-center justify-between w-full mt-auto pt-1 opacity-80 text-[8px] font-bold">
                                      <span className="uppercase tracking-widest truncate">
                                        {event.lockerId.replace('chamber-', 'SAFE-')}
                                      </span>
                                      <span className="flex items-center gap-1 shrink-0">
                                        <Clock className="w-2.5 h-2.5" />
                                        {createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                  </motion.button>
                                );
                              });
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              VIEW 2: DAY FOCUS VIEW (Spacious Hourly Rows, Zero Cramping)
             ══════════════════════════════════════════════════════════════ */}
          {view === "day" && (
            <div className="flex-1 p-6 md:p-8 overflow-y-auto max-h-[700px] custom-scrollbar bg-panel/10">
              <div className="max-w-5xl mx-auto space-y-6">
                {/* Day Header Banner */}
                <div className="p-6 rounded-3xl bg-panel-elevated/50 border border-line/40 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">Day Timeline Focus</span>
                    <h4 className="text-2xl font-black text-text mt-1">
                      {selectedDayDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </h4>
                    <p className="text-xs text-text-muted mt-1">
                      {dayFocusEvents.length} items recorded across active SAFE units
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setView("week")}
                      className="px-4 py-2.5 rounded-xl bg-panel hover:bg-white/10 text-text font-bold text-xs uppercase tracking-wider border border-line/40 transition-colors cursor-pointer"
                    >
                      ← Back to Week Grid
                    </button>
                  </div>
                </div>

                {/* Day Events Feed */}
                {dayFocusEvents.length === 0 ? (
                  <div className="p-16 rounded-3xl bg-panel-elevated/20 border border-line/20 text-center flex flex-col items-center justify-center">
                    <Clock className="w-12 h-12 text-text-muted opacity-30 mb-4" />
                    <h5 className="text-lg font-black text-text">No Donations Scheduled</h5>
                    <p className="text-xs text-text-muted mt-1 max-w-sm">
                      There are no active or historical donations recorded for this day across the selected SAFE units.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {dayFocusEvents.map((event) => {
                      const safeColor = SAFE_COLORS[event.lockerId] || SAFE_COLORS['chamber-8'];
                      const isRetrieved = event.status === 'retrieved';
                      const qualityColor = event.latestQualityScore === 'fresh' 
                        ? 'bg-emerald-500 text-emerald-400' 
                        : event.latestQualityScore === 'aging' 
                          ? 'bg-amber-500 text-amber-400' 
                          : 'bg-rose-500 text-rose-400';
                      const qualityLabel = getQualityLabel(event.latestQualityScore as any).toUpperCase();

                      return (
                        <motion.div
                          key={event.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-5 rounded-3xl bg-panel-elevated/60 border border-line/40 hover:border-emerald-500/40 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-5 group shadow-sm hover:shadow-md"
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-14 h-14 rounded-2xl ${safeColor.solid} text-white flex items-center justify-center shrink-0 shadow-md`}>
                              <Package className="w-7 h-7" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                                <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-lg ${safeColor.alphaBg} ${safeColor.text} border ${safeColor.alphaBorder}`}>
                                  {event.lockerId.replace('chamber-', 'SAFE-0')}
                                </span>
                                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border ${
                                  event.latestQualityScore === 'fresh' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                                  event.latestQualityScore === 'aging' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                                  'bg-rose-500/10 border-rose-500/30 text-rose-400'
                                }`}>
                                  {qualityLabel}
                                </span>
                                {event.dietTag && (
                                  <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg bg-panel border border-line/40 text-text-muted">
                                    {event.dietTag}
                                  </span>
                                )}
                                {isRetrieved ? (
                                  <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Retrieved
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
                                    Active in safe
                                  </span>
                                )}
                              </div>
                              <h4 className="text-lg font-black text-text tracking-tight">{event.foodName}</h4>
                              <p className="text-xs text-text-muted mt-0.5">
                                Donor: <span className="font-bold text-text">{event.donorName}</span> • Deposited at {new Date(event.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                            <button
                              onClick={() => setSelectedEvent(event)}
                              className="px-5 py-2.5 rounded-xl bg-panel hover:bg-emerald-500 hover:text-white border border-line/60 hover:border-emerald-500 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer"
                            >
                              <Eye className="w-4 h-4" />
                              <span>Inspect Audit</span>
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              VIEW 3: AGENDA LIST VIEW (Search, Filter, Full Accessibility)
             ══════════════════════════════════════════════════════════════ */}
          {view === "agenda" && (
            <div className="flex-1 p-6 md:p-8 overflow-y-auto max-h-[700px] custom-scrollbar bg-panel/10">
              <div className="max-w-5xl mx-auto space-y-6">
                {/* Search & Filter Bar */}
                <div className="p-6 rounded-3xl bg-panel-elevated/50 border border-line/40 space-y-4">
                  <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
                      <input
                        type="text"
                        value={agendaSearchQuery}
                        onChange={(e) => setAgendaSearchQuery(e.target.value)}
                        placeholder="Search donations by food name, donor, contact, or SAFE..."
                        className="w-full pl-11 pr-4 py-3 rounded-2xl bg-panel border border-line/60 focus:border-emerald-500 focus:outline-none text-text text-sm"
                      />
                      {agendaSearchQuery && (
                        <button
                          onClick={() => setAgendaSearchQuery("")}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Status filter */}
                      <div className="flex items-center bg-panel p-1 rounded-xl border border-line/40 text-xs">
                        {(["all", "active", "retrieved"] as const).map((status) => (
                          <button
                            key={status}
                            onClick={() => setAgendaStatusFilter(status)}
                            className={`px-3 py-1.5 rounded-lg font-black uppercase tracking-wider text-[10px] transition-all cursor-pointer ${
                              agendaStatusFilter === status ? 'bg-emerald-500 text-white shadow-sm' : 'text-text-muted hover:text-text'
                            }`}
                          >
                            {status === "all" ? "All Status" : status}
                          </button>
                        ))}
                      </div>

                      {/* Quality filter */}
                      <div className="flex items-center bg-panel p-1 rounded-xl border border-line/40 text-xs">
                        {(["all", "fresh", "aging", "spoilt"] as const).map((q) => (
                          <button
                            key={q}
                            onClick={() => setAgendaQualityFilter(q)}
                            className={`px-3 py-1.5 rounded-lg font-black uppercase tracking-wider text-[10px] transition-all cursor-pointer ${
                              agendaQualityFilter === q ? 'bg-emerald-500 text-white shadow-sm' : 'text-text-muted hover:text-text'
                            }`}
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-text-muted pt-1 border-t border-line/20">
                    <span>Showing <strong className="text-text">{agendaEvents.length}</strong> matching donations</span>
                    {selectedLockers.length < 8 && (
                      <span className="text-[10px] font-bold text-amber-500">
                        Filtering by {selectedLockers.length} Safe Units
                      </span>
                    )}
                  </div>
                </div>

                {/* Grouped Chronological Feed */}
                {Object.keys(agendaGroupedByDate).length === 0 ? (
                  <div className="p-16 rounded-3xl bg-panel-elevated/20 border border-line/20 text-center flex flex-col items-center justify-center">
                    <Search className="w-12 h-12 text-text-muted opacity-30 mb-4" />
                    <h5 className="text-lg font-black text-text">No Donations Found</h5>
                    <p className="text-xs text-text-muted mt-1 max-w-sm">
                      No donations match your current search query or active filter settings.
                    </p>
                  </div>
                ) : (
                  Object.entries(agendaGroupedByDate).map(([dateStr, items]) => (
                    <div key={dateStr} className="space-y-3">
                      <div className="flex items-center gap-3 px-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <h5 className="text-xs font-black uppercase tracking-[0.2em] text-text-muted">
                          {dateStr}
                        </h5>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-panel-elevated border border-line/40 text-emerald-400">
                          {items.length} Items
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        {items.map((event) => {
                          const safeColor = SAFE_COLORS[event.lockerId] || SAFE_COLORS['chamber-8'];
                          const isRetrieved = event.status === 'retrieved';
                          const qualityLabel = getQualityLabel(event.latestQualityScore as any).toUpperCase();

                          return (
                            <div
                              key={event.id}
                              onClick={() => setSelectedEvent(event)}
                              className="p-4 rounded-2xl bg-panel-elevated/50 border border-line/40 hover:border-emerald-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer group"
                            >
                              <div className="flex items-center gap-4">
                                <div className={`w-11 h-11 rounded-xl ${safeColor.solid} text-white flex items-center justify-center shrink-0`}>
                                  <Package className="w-5 h-5" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${safeColor.alphaBg} ${safeColor.text} border ${safeColor.alphaBorder}`}>
                                      {event.lockerId.replace('chamber-', 'SAFE-0')}
                                    </span>
                                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md border ${
                                      event.latestQualityScore === 'fresh' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                                      event.latestQualityScore === 'aging' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                                      'bg-rose-500/10 border-rose-500/30 text-rose-400'
                                    }`}>
                                      {qualityLabel}
                                    </span>
                                    <span className="text-[10px] text-text-muted">
                                      {new Date(event.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  <h6 className="font-black text-sm text-text group-hover:text-emerald-400 transition-colors">
                                    {event.foodName}
                                  </h6>
                                  <p className="text-[11px] text-text-muted">
                                    Donor: {event.donorName} {event.categoryLabel ? `• ${event.categoryLabel}` : ''}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 justify-end">
                                {isRetrieved ? (
                                  <span className="text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Retrieved
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
                                    Active
                                  </span>
                                )}
                                <ChevronRight className="w-4 h-4 text-text-muted group-hover:translate-x-1 transition-transform" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          MODAL 1: DISTRIBUTION STACK VIEW (Clean list of all items)
         ══════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {selectedStack && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
              onClick={() => setSelectedStack(null)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-panel border border-line rounded-[2.5rem] overflow-hidden shadow-2xl p-6 md:p-8 flex flex-col max-h-[85vh]"
            >
              {/* Stack Header */}
              <div className="flex items-start justify-between pb-6 border-b border-line/20">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <Layers className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black tracking-tight text-text">
                      Distribution Stack ({selectedStack.length} Donations)
                    </h3>
                    <p className="text-xs text-text-muted mt-0.5">
                      Multiple food deposits clustered in this time window
                    </p>
                  </div>
                </div>

                <button 
                  onClick={() => setSelectedStack(null)}
                  className="w-10 h-10 rounded-xl bg-muted/10 hover:bg-muted/20 flex items-center justify-center text-text-muted hover:text-text transition-colors cursor-pointer"
                  title="Close (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Stack Search & Filter */}
              <div className="py-4 space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input
                    type="text"
                    value={stackSearchQuery}
                    onChange={(e) => setStackSearchQuery(e.target.value)}
                    placeholder="Search inside this stack..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-panel-elevated border border-line/40 text-xs text-text focus:outline-none focus:border-emerald-500"
                  />
                  {stackSearchQuery && (
                    <button
                      onClick={() => setStackSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {(["all", "fresh", "aging", "retrieved"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setStackFilterStatus(f)}
                      className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                        stackFilterStatus === f
                          ? "bg-emerald-500 text-white shadow-sm"
                          : "bg-panel-elevated/60 text-text-muted hover:text-text"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stack Items List */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                {filteredStackEvents.length === 0 ? (
                  <div className="py-12 text-center text-text-muted text-xs">
                    No items in this stack match your search.
                  </div>
                ) : (
                  filteredStackEvents.map((event) => {
                    const safeColor = SAFE_COLORS[event.lockerId] || SAFE_COLORS['chamber-8'];
                    const qualityColor = event.latestQualityScore === 'fresh' ? 'bg-emerald-500' : event.latestQualityScore === 'aging' ? 'bg-amber-500' : 'bg-rose-500';
                    const qualityLabel = getQualityLabel(event.latestQualityScore as any).toUpperCase();
                    const isRetrieved = event.status === 'retrieved';
                    
                    return (
                      <button
                        key={event.id}
                        onClick={() => {
                          setSelectedEvent(event);
                          setSelectedStack(null);
                        }}
                        className="w-full p-4 rounded-2xl bg-panel-elevated/40 border border-line hover:border-emerald-500/50 hover:bg-panel-elevated transition-all flex items-center justify-between group text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-xl ${safeColor.solid} flex items-center justify-center text-white shrink-0 shadow-md`}>
                            <Package className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                                {event.lockerId.replace('chamber-', 'SAFE-0')}
                              </span>
                              <div className={`w-2 h-2 rounded-full ${qualityColor}`} />
                              <span className="text-[9px] font-black uppercase tracking-widest opacity-60">
                                {qualityLabel}
                              </span>
                              {isRetrieved && (
                                <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                                  Retrieved
                                </span>
                              )}
                            </div>
                            <h4 className="text-base font-black text-text group-hover:text-emerald-400 transition-colors">
                              {event.foodName}
                            </h4>
                            <span className="text-xs text-text-muted">
                              Donor: {event.donorName} • {new Date(event.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-text-muted group-hover:text-emerald-400 transition-colors">
                          <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">Inspect</span>
                          <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════
          MODAL 2: EVENT DETAILS MODAL (Full Biometrics & Governance)
         ══════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {selectedEvent && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-xl"
              onClick={() => setSelectedEvent(null)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="relative w-full max-w-4xl bg-panel border border-line rounded-[3rem] overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
            >
              {/* Header */}
              <div className="relative h-44 bg-emerald-500 overflow-hidden shrink-0">
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
                <div className="absolute inset-0 bg-black/10" />
                <div className="relative z-10 p-8 flex flex-col justify-end h-full">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-[10px] font-black uppercase tracking-widest text-white">
                      {selectedEvent.lockerId.replace('chamber-', 'Mission Safe ')}
                    </div>
                    {selectedEvent.status === 'retrieved' && (
                      <div className="px-3 py-1 rounded-full bg-white text-emerald-600 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3" />
                        Distribution Complete
                      </div>
                    )}
                  </div>
                  <h3 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-none mb-2 truncate">
                    {selectedEvent.foodName}
                  </h3>
                  <div className="flex items-center gap-4 text-white/80 text-xs">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span className="font-bold uppercase tracking-widest">{formatDateTime(selectedEvent.createdAt)}</span>
                    </div>
                    <div className="w-1.5 h-1.5 rounded-full bg-white/40" />
                    <span className="font-black uppercase tracking-widest">{selectedEvent.categoryLabel}</span>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedEvent(null)}
                  className="absolute top-6 right-6 w-11 h-11 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white transition-all backdrop-blur-md z-20 cursor-pointer"
                  title="Close (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8 overflow-y-auto custom-scrollbar">
                {/* Donor Section */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
                      <Heart className="w-5 h-5" />
                    </div>
                    <h4 className="text-lg font-black tracking-tight">Donor Profile</h4>
                  </div>
                  
                  <div className="space-y-4">
                    {(selectedEvent.donorImageUrl || selectedEvent.donorImageBase64) && (
                      <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden border border-line/40 relative group shadow-xl bg-black">
                        <img 
                          src={selectedEvent.donorImageUrl || selectedEvent.donorImageBase64} 
                          alt="Donor Biometric" 
                          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 transform scale-x-[-1]"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent pointer-events-none" />
                        <div className="absolute bottom-4 left-4 flex items-center gap-2">
                          <ShieldCheck className="w-5 h-5 text-emerald-400" />
                          <span className="text-xs font-black uppercase tracking-widest text-white drop-shadow-md">Verified Scan</span>
                        </div>
                      </div>
                    )}
                    <DetailItem icon={<User className="w-4 h-4" />} label="Verified Donor" value={selectedEvent.donorName} />
                    <DetailItem icon={<Mail className="w-4 h-4" />} label="Contact Stream" value={selectedEvent.donorContact} />
                    <div className="p-4 rounded-2xl bg-panel-elevated/40 border border-line/40">
                      <p className="text-[9px] font-black uppercase tracking-widest text-text-muted mb-2">Dietary & Allergens</p>
                      <div className="flex flex-wrap gap-2 mb-3">
                        <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${selectedEvent.dietTag === 'veg' ? 'bg-emerald-500/20 text-emerald-600' : 'bg-amber-500/20 text-amber-600'}`}>
                          {selectedEvent.dietTag}
                        </span>
                      </div>
                      <p className="text-xs font-medium leading-relaxed italic text-text-muted">
                        "{selectedEvent.allergensNotes || 'No specific allergen notes provided by donor.'}"
                      </p>
                    </div>
                  </div>
                </div>

                {/* Receiver Section */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600">
                      <Package className="w-5 h-5" />
                    </div>
                    <h4 className="text-lg font-black tracking-tight">Receiver Matrix</h4>
                  </div>
                  
                  <div className="space-y-4">
                    {selectedEvent.status === 'retrieved' && selectedEvent.receiver ? (
                      <>
                        {(selectedEvent.receiver.receiverImageUrl || selectedEvent.receiver.receiverImageBase64) && (
                          <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden border border-line/40 relative group shadow-xl bg-black">
                            <img 
                              src={selectedEvent.receiver.receiverImageUrl || selectedEvent.receiver.receiverImageBase64} 
                              alt="Receiver Biometric" 
                              className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 transform scale-x-[-1]"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent pointer-events-none" />
                            <div className="absolute bottom-4 left-4 flex items-center gap-2">
                              <ShieldCheck className="w-5 h-5 text-emerald-400" />
                              <span className="text-xs font-black uppercase tracking-widest text-white drop-shadow-md">Verified Scan</span>
                            </div>
                          </div>
                        )}
                        <DetailItem
                          icon={<Clock className="w-4 h-4" />}
                          label="Collection Time"
                          value={formatDateTime(selectedEvent.receiver.retrievedAt)}
                        />
                        <DetailItem
                          icon={<ShieldCheck className="w-4 h-4" />}
                          label="Freshness at Retrieval"
                          value={getQualityLabel(selectedEvent.receiver.qualityScoreAtRetrieval as any).toUpperCase()}
                          color={selectedEvent.receiver.qualityScoreAtRetrieval === 'fresh' ? 'emerald' : selectedEvent.receiver.qualityScoreAtRetrieval === 'aging' ? 'amber' : 'rose'}
                        />
                        <DetailItem
                          icon={<User className="w-4 h-4" />}
                          label="Access Mode"
                          value={selectedEvent.receiver.retrievedBy === 'admin_override' ? "ADMIN OVERRIDE" : "Community Receiver"}
                          highlight={selectedEvent.receiver.retrievedBy === 'admin_override'}
                        />
                      </>
                    ) : (
                      <div className="py-10 flex flex-col items-center justify-center text-center opacity-40">
                        <Clock className="w-10 h-10 mb-4 animate-pulse text-emerald-500" />
                        <p className="text-xs font-black uppercase tracking-widest">Pending Distribution</p>
                        <p className="text-[10px] font-medium mt-1">Item is currently secure in {selectedEvent.lockerId.replace('chamber-', 'SAFE-')}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* System Status / Fleet Governance Section */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <h4 className="text-lg font-black tracking-tight">Fleet Governance</h4>
                  </div>

                  <div className="space-y-4">
                    {selectedEvent.adminOverride ? (
                      <div className="p-5 rounded-3xl bg-rose-500/10 border border-rose-500/30">
                        <div className="flex items-center gap-3 mb-3">
                          <AlertCircle className="w-5 h-5 text-rose-500" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-rose-600">Administrative Override</span>
                        </div>
                        <div className="space-y-2">
                          <p className="text-[11px] font-black text-rose-500/80 uppercase tracking-widest">Authorized by</p>
                          <p className="text-sm font-black text-rose-400">{selectedEvent.adminOverride.adminCredentials}</p>
                          <p className="text-[11px] font-black text-rose-500/80 uppercase tracking-widest mt-3">Override Timestamp</p>
                          <p className="text-sm font-black text-text">{formatDateTime(selectedEvent.adminOverride.overrideAt)}</p>
                          <p className="text-[10px] font-medium leading-relaxed opacity-60 mt-2">
                            This asset was forcibly released under administrative authority.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-5 rounded-3xl bg-emerald-500/10 border border-emerald-500/30">
                        <div className="flex items-center gap-3 mb-3">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Standard Compliance</span>
                        </div>
                        <p className="text-[11px] font-medium leading-relaxed opacity-70">
                          {selectedEvent.status === 'retrieved'
                            ? "This distribution followed standard community retrieval protocols. All biometric and safety checks were verified."
                            : "Item is currently in safe storage awaiting community retrieval."}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center gap-3 p-4 rounded-2xl border border-line/20 opacity-60">
                      <Info className="w-4 h-4 text-emerald-500" />
                      <span className="text-[9px] font-black uppercase tracking-widest">Audit Ref: {selectedEvent.id.split('-')[0].toUpperCase()}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 bg-panel-elevated/50 border-t border-line/20 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2 opacity-60">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest">System Logs Synced</span>
                </div>
                <button 
                  onClick={() => setSelectedEvent(null)}
                  className="px-8 py-3 rounded-2xl bg-panel border border-line hover:border-emerald-500/40 text-text font-black text-xs uppercase tracking-widest transition-all cursor-pointer"
                >
                  Dismiss Terminal
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DetailItem({ icon, label, value, color, highlight }: { icon: any, label: string, value: string, color?: string, highlight?: boolean }) {
  return (
    <div className={`p-4 rounded-2xl border transition-all ${highlight ? 'bg-amber-500/10 border-amber-500/30' : 'bg-panel-elevated/40 border-line/40'}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`text-emerald-500 ${color === 'amber' ? 'text-amber-500' : color === 'rose' ? 'text-rose-500' : ''}`}>
          {icon}
        </div>
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-text-muted opacity-60">{label}</span>
      </div>
      <p className={`text-sm font-black tracking-tight ${highlight ? 'text-amber-600 dark:text-amber-400' : 'text-text'} ${color === 'emerald' ? 'text-emerald-600' : color === 'amber' ? 'text-amber-600' : ''}`}>
        {value}
      </p>
    </div>
  );
}
