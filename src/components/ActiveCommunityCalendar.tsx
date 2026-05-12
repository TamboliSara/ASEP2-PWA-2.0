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
  AlertCircle
} from "lucide-react";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { db } from "../services/firebase";
import { formatDateTime } from "../utils/format";
import { TextReveal } from "./TextReveal";
import { ScrollReveal } from "./ScrollReveal";
import { generateCalendarPDF } from "../utils/pdfGenerator";
import { getQualityLabel } from "../utils/safety";
import { FileText } from "lucide-react";

interface DonationEntry {
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
  const [selectedEvent, setSelectedEvent] = useState<DonationEntry | null>(null);
  const [donations, setDonations] = useState<DonationEntry[]>([]);
  const [selectedLockers, setSelectedLockers] = useState<string[]>(["chamber-1", "chamber-2", "chamber-3", "chamber-4", "chamber-5", "chamber-6", "chamber-7", "chamber-8"]);
  const [view, setView] = useState<"week" | "month">("week");
  const [now, setNow] = useState(new Date());
  const [selectedStack, setSelectedStack] = useState<DonationEntry[] | null>(null);

  const handleExportPDF = () => {
    generateCalendarPDF({
      generatedBy: "Admin User",
      timestamp: new Date().toISOString(),
      events: allEvents,
      weekRange: `${currentWeek[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${currentWeek[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    });
  };


  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);


  // ── Firestore Listener — donations is the single source of truth ─────────
  useEffect(() => {
    if (!db) return;

    // Only listen to donations/; retrieval + admin override data is embedded there by syncRetrieval
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

  // ── All events come directly from the donations collection ───────────────
  const allEvents = useMemo(() => {
    return donations.filter(d => selectedLockers.includes(d.lockerId));
  }, [donations, selectedLockers]);

  // ── Layout Calculation ──────────────────────────────────────────
  const getEventLayouts = (dayEvents: any[]) => {
    if (dayEvents.length === 0) return new Map();

    const layoutItems = [...dayEvents].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).map(event => {
      const start = new Date(event.createdAt);
      const top = (start.getHours() * 30) + (start.getMinutes() / 60 * 30);
      
      let height = 45; // 1.5h default
      if (event.retrievedAt) {
        const dur = (new Date(event.retrievedAt).getTime() - new Date(event.createdAt).getTime()) / (1000 * 60 * 60) * 30;
        if (dur > 45) height = dur;
      }

      return {
        id: event.id,
        event,
        isStack: false,
        top,
        height,
        bottom: top + height,
        colIdx: 0
      };
    });

    // 2. Cluster items that overlap visually
    const clusters: any[][] = [];
    layoutItems.forEach(item => {
      let foundCluster = false;
      for (const cluster of clusters) {
        if (cluster.some(cItem => item.top < cItem.bottom && item.bottom > cItem.top)) {
          cluster.push(item);
          foundCluster = true;
          break;
        }
      }
      if (!foundCluster) clusters.push([item]);
    });

    // 3. Assign columns and calculate horizontal layout
    const layoutMap = new Map();
    clusters.forEach(cluster => {
      const columns: any[][] = [];
      cluster.forEach(item => {
        let colIdx = 0;
        while (columns[colIdx] && columns[colIdx].some(cItem => item.top < cItem.bottom && item.bottom > cItem.top)) {
          colIdx++;
        }
        if (!columns[colIdx]) columns[colIdx] = [];
        columns[colIdx].push(item);
        item.colIdx = colIdx;
      });

      const totalCols = columns.length;
      cluster.forEach(item => {
        layoutMap.set(item.id, {
          isStack: false,
          stackSize: 1,
          stackEvents: [item.event],
          left: (item.colIdx / totalCols) * 100,
          width: 100 / totalCols,
          top: item.top,
          height: item.height
        });
      });
    });

    return layoutMap;
  };

  // ── Calendar Helpers ──────────────────────────────────────────────
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

  const currentWeek = getWeekRange(currentDate);

  const prevWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  };

  const nextWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  };

  const toggleLocker = (id: string) => {
    setSelectedLockers(prev => 
      prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]
    );
  };

  return (
    <div className="active-community-calendar mt-8">
      <div className="obsidian-card premium-noise !p-0 rounded-[2.5rem] border border-emerald-500/20 overflow-hidden shadow-2xl">
        {/* Calendar Header */}
        <div className="p-8 border-b border-line/40 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-panel/30 backdrop-blur-xl">
          <div className="flex items-center gap-6">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shadow-[0_0_20px_rgba(16,184,129,0.1)]"
            >
              <CalendarIcon className="w-7 h-7 text-emerald-500" />
            </motion.div>
            <div>
              <TextReveal mode="words" direction="left" distance={10} delay={0.1}>
                <h3 className="text-2xl font-black tracking-tight text-text">Contribution Timeline</h3>
              </TextReveal>
              <TextReveal mode="words" direction="left" distance={15} delay={0.2}>
                <p className="text-text-muted text-sm font-medium">Monitoring fleet distributions and retrieval history</p>
              </TextReveal>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-end md:items-center gap-6">
            <div className="flex items-center gap-4 mr-4">
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-text-muted opacity-60">Week Total</p>
                <p className="text-xl font-black text-emerald-500">{allEvents.length} <span className="text-sm text-text">Items</span></p>
              </div>
              <div className="w-px h-8 bg-line/40" />
              <div className="text-left">
                <p className="text-[10px] font-black uppercase tracking-widest text-text-muted opacity-60">Pending</p>
                <p className="text-xl font-black text-amber-500">{allEvents.filter(e => e.status !== 'retrieved').length} <span className="text-sm text-text">Active</span></p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button 
                onClick={handleExportPDF}
                className="group flex items-center gap-2 px-6 py-4 rounded-2xl bg-panel-elevated border border-line hover:border-emerald-500/40 text-text-muted hover:text-emerald-500 transition-all shadow-lg"
              >
                <FileText className="w-4 h-4" />
                <span className="font-black text-xs uppercase tracking-widest">Export PDF</span>
              </button>

              <div className="flex items-center bg-panel-elevated/50 rounded-2xl p-1 border border-line/40 shadow-inner">

              <button 
                onClick={prevWeek}
                className="p-3 rounded-xl hover:bg-white/10 text-text-muted transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="px-6 py-2 font-black text-sm uppercase tracking-widest text-text">
                {currentWeek[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {currentWeek[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <button 
                onClick={nextWeek}
                className="p-3 rounded-xl hover:bg-white/10 text-text-muted transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            
            <button 
              onClick={() => setCurrentDate(new Date())}
              className="px-6 py-4 rounded-2xl bg-emerald-500 text-white font-black text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
            >
              Today
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row min-h-[600px]">
          {/* Sidebar Filters */}
          <div className="w-full lg:w-72 border-r border-line/40 p-6 bg-panel/10">
            <div className="flex items-center gap-2 mb-6">
              <Layers className="w-4 h-4 text-emerald-500" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-600/60 dark:text-emerald-500/60">Fleet Units</span>
            </div>
            
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(num => {
                const id = `chamber-${num}`;
                const isActive = selectedLockers.includes(id);
                const safeColor = SAFE_COLORS[id] || SAFE_COLORS['chamber-8'];
                return (
                  <button
                    key={id}
                    onClick={() => toggleLocker(id)}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-300
                      ${isActive 
                        ? `${safeColor.alphaBg} ${safeColor.alphaBorder} ${safeColor.text}` 
                        : 'bg-transparent border-line/40 text-text-muted opacity-40 hover:opacity-100'}`}
                  >
                    <div className={`w-3 h-3 rounded-full ${isActive ? `${safeColor.solid} animate-pulse` : 'bg-muted'}`} />
                    <span className="text-xs font-black tracking-widest uppercase">SAFE-0{num}</span>
                    {isActive && <CheckCircle2 className="w-3 h-3 ml-auto opacity-60" />}
                  </button>
                );
              })}
            </div>

            <div className="mt-8 pt-8 border-t border-line/20">
              <div className="flex items-center gap-2 mb-4">
                <Info className="w-4 h-4 text-emerald-500/50" />
                <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">Legend</span>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-bold text-text-muted uppercase">Fresh / Optimal</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="text-[10px] font-bold text-text-muted uppercase">Aging / Alert</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-rose-500" />
                  <span className="text-[10px] font-bold text-text-muted uppercase">Spoilt / Critical</span>
                </div>
              </div>
            </div>
          </div>

          {/* Week Grid */}
          <div className="flex-1 overflow-x-auto">
            <div className="min-w-[800px] h-full flex flex-col">
              {/* Day Headers */}
              <div className="grid grid-cols-7 border-b border-line/20">
                {currentWeek.map((day, idx) => {
                  const isToday = day.toDateString() === new Date().toDateString();
                  return (
                    <div key={idx} className={`p-4 text-center border-r border-line/10 last:border-r-0 ${isToday ? 'bg-emerald-500/5' : ''}`}>
                      <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-1 ${isToday ? 'text-emerald-500' : 'text-text-muted'}`}>
                        {weekDays[idx]}
                      </p>
                      <p className={`text-xl font-black ${isToday ? 'text-emerald-600 dark:text-emerald-400' : 'text-text'}`}>
                        {day.getDate()}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Time Grid */}
              <div className="flex-1 relative overflow-y-auto max-h-[500px] custom-scrollbar bg-panel/20">
                <div className="flex h-full min-h-[720px]">
                  {/* Time Labels */}
                  <div className="w-16 border-r border-line/20 bg-panel/30 relative">
                    {[0, 3, 6, 9, 12, 15, 18, 21].map((hour) => (
                      <div key={hour} className="h-[90px] relative flex justify-end pr-2 border-b border-line/10 last:border-b-0">
                        <span className="text-[9px] font-black text-text-muted opacity-40 -translate-y-2 uppercase">
                          {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Days Columns */}
                  <div className="flex-1 grid grid-cols-7">
                    {currentWeek.map((day, dayIdx) => {
                      const isToday = day.toDateString() === now.toDateString();
                      return (
                        <div key={dayIdx} className={`relative border-r border-line/20 last:border-r-0 group/col ${isToday ? 'bg-emerald-500/[0.03]' : ''}`}>
                          {/* Grid Lines */}
                          {[0, 3, 6, 9, 12, 15, 18, 21].map((hour) => (
                            <div key={hour} className="h-[90px] border-b border-line/15 w-full hover:bg-white/[0.02] transition-colors" />
                          ))}

                          {/* Current Time Indicator */}
                          {isToday && (
                            <div 
                              className="absolute left-0 right-0 h-0.5 bg-emerald-500 z-20 pointer-events-none"
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
                              // If it's a stack, only render the first one as a group
                              const layout = layoutMap.get(e.id);
                              if (layout.isStack) {
                                return self.findIndex(x => x.id === layout.stackEvents[0].id) === idx;
                              }
                              return true;
                            }).map((event, eIdx) => {
                              const createdDate = new Date(event.createdAt);
                              const layout = layoutMap.get(event.id) || { isStack: false, left: 0, width: 100, top: 0, height: 60 };
                              
                              const isRetrieved = event.status === 'retrieved';
                              const safeColor = SAFE_COLORS[event.lockerId] || SAFE_COLORS['chamber-8'];
                              const qualityColor = event.latestQualityScore === 'fresh' ? 'bg-emerald-400' : event.latestQualityScore === 'aging' ? 'bg-amber-400' : 'bg-rose-400';
                              
                              const blockStyle = layout.isStack 
                                ? 'bg-panel-elevated/90 backdrop-blur-md border-emerald-500/40 border-2 text-text' 
                                : isRetrieved 
                                  ? 'bg-slate-800/80 backdrop-blur-sm border border-slate-600/50 text-slate-200' 
                                  : `${safeColor.solid} border border-white/20 text-white`;
                              
                              return (
                                <motion.button
                                  key={event.id}
                                  layoutId={`event-${event.id}`}
                                  onClick={() => layout.isStack ? setSelectedStack(layout.stackEvents) : setSelectedEvent(event)}
                                  whileHover={{ scale: 1.05, zIndex: 60, filter: "brightness(1.05)" }}
                                  className={`absolute p-2 rounded-2xl ${blockStyle} shadow-xl cursor-pointer overflow-hidden flex flex-col group/event transition-all duration-300 min-h-[var(--event-h)] w-[var(--event-w)] hover:!h-auto hover:!w-max hover:min-w-[160px] hover:!shadow-2xl`}
                                  style={{ 
                                    top: `${layout.top}px`, 
                                    left: `${layout.left + 1}%`,
                                    '--event-h': `${Math.max(48, layout.height)}px`,
                                    '--event-w': `${layout.width - 2}%`
                                  } as React.CSSProperties}
                                >
                                  {layout.isStack && (
                                    <div className="absolute top-0 right-0 px-2 py-1 bg-emerald-500 text-[7px] font-black uppercase tracking-tighter rounded-bl-lg shadow-lg z-20 whitespace-nowrap">
                                      {layout.stackSize} Items
                                    </div>
                                  )}
                                  
                                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-black/10 pointer-events-none" />
                                  <div className="absolute inset-0 bg-gradient-to-tr from-white/0 to-white/20 opacity-0 group-hover/event:opacity-100 transition-opacity pointer-events-none" />
                                  
                                  <div className="relative z-10 flex flex-col items-start gap-1 w-full h-full">
                                    <div className="flex items-start justify-between w-full">
                                      <div className="flex items-start gap-1.5 overflow-hidden w-full">
                                        <div className={`shrink-0 w-2 h-2 rounded-full border border-white/40 ${qualityColor} shadow-md mt-1`} />
                                        <div className="flex flex-col w-full min-w-0">
                                          <h4 className={`font-black truncate w-full text-left drop-shadow-md leading-tight ${layout.isStack ? 'text-text text-xs' : isRetrieved ? 'text-slate-100 text-[11px]' : 'text-white text-[11px]'}`}>
                                            {layout.isStack ? 'Multiple' : event.foodName}
                                          </h4>
                                          {!layout.isStack && (
                                            <span className="text-[8px] font-black uppercase tracking-widest opacity-80 drop-shadow-md truncate mt-0.5">
                                              {event.lockerId.replace('chamber-', 'SAFE-')}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      {event.status === 'retrieved' && <CheckCircle2 className="shrink-0 w-3 h-3 opacity-80 text-emerald-400 ml-1" />}
                                    </div>
                                    
                                    {/* Default compact time (hidden on hover if expanded info is shown) */}
                                    <div className="flex items-center gap-1.5 mt-auto opacity-70 group-hover/event:hidden">
                                      <Clock className="w-2.5 h-2.5" />
                                      <span className="text-[8px] font-bold">
                                        {createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>

                                    {/* Expanded Details (Visible only on hover) */}
                                    <div className="hidden group-hover/event:flex flex-col gap-1.5 mt-3 pt-3 border-t border-white/20 w-full text-left">
                                      {!layout.isStack && (
                                        <>
                                          <div className="flex justify-between items-center text-[9px] opacity-80 gap-4">
                                            <span className="font-bold">Donor: {event.donorName}</span>
                                            <span>{event.categoryLabel}</span>
                                          </div>
                                          {isRetrieved && event.receiver && (
                                            <div className="flex justify-between items-center text-[9px] text-emerald-300 dark:text-emerald-400 gap-4">
                                              <span className="font-bold">Exit Score: {event.receiver.qualityScoreAtRetrieval?.toUpperCase()}</span>
                                              <span>{new Date(event.receiver.retrievedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                          )}
                                        </>
                                      )}
                                      {layout.isStack && (
                                        <div className="text-[9px] opacity-80 font-bold text-emerald-400">
                                          Click to view all {layout.stackSize} items
                                        </div>
                                      )}
                                      <div className="flex items-center gap-1.5 mt-1 opacity-70">
                                        <Clock className="w-2.5 h-2.5" />
                                        <span className="text-[8px] font-bold">
                                          {createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                      </div>
                                    </div>
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
      </div>

      </div>

      {/* Event Details Modal */}
      <AnimatePresence>
        {selectedEvent && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
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
              className="relative w-full max-w-4xl bg-panel border border-line rounded-[3rem] overflow-hidden shadow-2xl"
            >
              {/* Header */}
              <div className="relative h-48 bg-emerald-500 overflow-hidden">
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
                <div className="absolute inset-0 bg-black/10" />
                <div className="relative z-10 p-10 flex flex-col justify-end h-full">
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
                  <h3 className="text-5xl font-black text-white tracking-tight leading-none mb-2">{selectedEvent.foodName}</h3>
                  <div className="flex items-center gap-4 text-white/80">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm font-bold uppercase tracking-widest">{formatDateTime(selectedEvent.createdAt)}</span>
                    </div>
                    <div className="w-1.5 h-1.5 rounded-full bg-white/40" />
                    <span className="text-sm font-black uppercase tracking-widest">{selectedEvent.categoryLabel}</span>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedEvent(null)}
                  className="absolute top-8 right-8 w-12 h-12 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white transition-all backdrop-blur-md z-20"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Content */}
              <div className="p-10 grid grid-cols-1 md:grid-cols-3 gap-8">
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
                      <div className="py-10 flex flex-col items-center justify-center text-center opacity-30">
                        <Clock className="w-10 h-10 mb-4 animate-pulse" />
                        <p className="text-xs font-black uppercase tracking-widest">Pending Distribution</p>
                        <p className="text-[9px] font-medium mt-1">Item is currently secure in {selectedEvent.lockerId.replace('chamber-', 'SAFE-')}</p>
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
                    {/* Admin Override panel — shown when override occurred */}
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
                            This asset was forcibly released under administrative authority. The override is logged and flagged for routine verification.
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

                    <div className="flex items-center gap-3 p-4 rounded-2xl border border-line/20 opacity-40">
                      <Info className="w-4 h-4" />
                      <span className="text-[9px] font-black uppercase tracking-widest">Audit Ref: {selectedEvent.id.split('-')[0].toUpperCase()}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-8 bg-panel-elevated/50 border-t border-line/20 flex justify-between items-center">
                <div className="flex items-center gap-2 opacity-40">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest">System Logs Synced</span>
                </div>
                <button 
                  onClick={() => setSelectedEvent(null)}
                  className="px-8 py-4 rounded-2xl bg-panel border border-line hover:border-emerald-500/40 text-text font-black text-xs uppercase tracking-widest transition-all"
                >
                  Dismiss Terminal
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Stack View Modal */}
      <AnimatePresence>
        {selectedStack && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
              onClick={() => setSelectedStack(null)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-xl bg-panel border border-line rounded-[2.5rem] overflow-hidden shadow-2xl p-8"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-black tracking-tight text-text">Distribution Stack</h3>
                  <p className="text-sm text-text-muted">Multiple events occurring at this time</p>
                </div>
                <button 
                  onClick={() => setSelectedStack(null)}
                  className="w-10 h-10 rounded-xl bg-muted/10 flex items-center justify-center hover:bg-muted/20"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {selectedStack.map((event) => {
                  const safeColor = SAFE_COLORS[event.lockerId] || SAFE_COLORS['chamber-8'];
                  const qualityColor = event.latestQualityScore === 'fresh' ? 'bg-emerald-500' : event.latestQualityScore === 'aging' ? 'bg-amber-500' : 'bg-rose-500';
                  const qualityLabel = getQualityLabel(event.latestQualityScore as any).toUpperCase();
                  
                  return (
                    <button
                      key={event.id}
                      onClick={() => {
                        setSelectedEvent(event);
                        setSelectedStack(null);
                      }}
                      className="w-full p-6 rounded-2xl bg-panel-elevated/40 border border-line hover:border-emerald-500/40 transition-all flex items-center justify-between group text-left"
                    >
                      <div className="flex items-center gap-6">
                        <div className={`w-12 h-12 rounded-xl ${safeColor.solid} flex items-center justify-center text-white`}>
                          <Package className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-500">{event.lockerId.replace('chamber-', 'SAFE ')}</span>
                            <div className={`w-2 h-2 rounded-full ${qualityColor}`} />
                            <span className="text-[9px] font-black uppercase tracking-widest opacity-40">{qualityLabel}</span>
                          </div>
                          <h4 className="text-lg font-black text-text">{event.foodName}</h4>
                          <span className="text-xs text-text-muted">{new Date(event.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-text-muted group-hover:translate-x-1 transition-transform" />
                    </button>
                  );
                })}
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
