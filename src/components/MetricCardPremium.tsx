import { motion } from "framer-motion";
import { type ReactNode } from "react";
import { Clock, TrendingUp, TrendingDown, Activity } from "lucide-react";

interface MetricCardPremiumProps {
  title: string;
  subtitle: string;
  value: string | number;
  trend?: string;
  trendDirection?: "up" | "down" | "neutral";
  icon: ReactNode;
  bgIcon: ReactNode;
  statusText?: string;
  accentColor?: string;
  index?: number;
}

export function MetricCardPremium({
  title,
  subtitle,
  value,
  trend,
  trendDirection = "neutral",
  icon,
  bgIcon,
  statusText = "LIVE",
  accentColor = "var(--accent)",
  index = 0
}: MetricCardPremiumProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.8, 
        delay: index * 0.1, 
        ease: [0.16, 1, 0.3, 1] as const
      }}
      whileHover={{ y: -5, scale: 1.01 }}
      className="relative overflow-hidden group rounded-[2rem] border border-line/40 bg-panel/40 backdrop-blur-3xl shadow-2xl p-7 flex flex-col justify-between min-h-[220px]"
    >
      {/* Glossy overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />
      
      {/* Animated Scanline */}
      <motion.div 
        initial={{ top: "-100%" }}
        animate={{ top: "200%" }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        className="absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent z-20 pointer-events-none opacity-30 group-hover:opacity-60 transition-opacity"
      />

      {/* Technical Corner Brackets */}
      <div className="absolute top-4 left-4 w-4 h-4 border-t border-l border-white/10 rounded-tl-sm pointer-events-none group-hover:border-accent/40 transition-colors" />
      <div className="absolute top-4 right-4 w-4 h-4 border-t border-r border-white/10 rounded-tr-sm pointer-events-none group-hover:border-accent/40 transition-colors" />
      <div className="absolute bottom-4 left-4 w-4 h-4 border-b border-l border-white/10 rounded-bl-sm pointer-events-none group-hover:border-accent/40 transition-colors" />
      <div className="absolute bottom-4 right-4 w-4 h-4 border-b border-r border-white/10 rounded-br-sm pointer-events-none group-hover:border-accent/40 transition-colors" />

      {/* Background Decorative Icon */}
      <div className="absolute -bottom-6 -right-6 opacity-[0.03] group-hover:opacity-[0.08] transition-all duration-700 pointer-events-none transform group-hover:rotate-12 group-hover:scale-110">
        <div className="text-white">
          {bgIcon}
        </div>
      </div>

      {/* Content Header */}
      <div className="relative z-10 flex justify-between items-start mb-4">
        <div className="space-y-1">
          <p className="text-[10px] font-black tracking-[0.2em] uppercase text-text-muted/60 flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-accent animate-pulse" />
            {title}
          </p>
          <h4 className="text-sm font-black text-text tracking-tight">{subtitle}</h4>
        </div>
        
        <div 
          className="w-12 h-12 rounded-2xl bg-panel-elevated/80 border border-line/50 flex items-center justify-center shadow-lg group-hover:shadow-[0_0_20px_rgba(20,184,166,0.2)] transition-all duration-500"
          style={{ borderColor: `color-mix(in srgb, ${accentColor} 30%, transparent)` }}
        >
          <div className="transform group-hover:scale-110 transition-transform duration-500" style={{ color: accentColor }}>
            {icon}
          </div>
        </div>
      </div>

      {/* Main Value Section */}
      <div className="relative z-10 flex items-end justify-between gap-4 mt-auto">
        <div className="space-y-2">
          <strong className="text-5xl font-black tracking-tighter font-mono text-text drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
            {value}
          </strong>
          
          {trend && (
            <div className={`flex items-center gap-1.5 font-black text-[10px] uppercase tracking-widest
              ${trendDirection === 'up' ? 'text-success' : trendDirection === 'down' ? 'text-danger' : 'text-text-muted'}`}>
              {trendDirection === 'up' ? <TrendingUp className="w-3 h-3" /> : trendDirection === 'down' ? <TrendingDown className="w-3 h-3" /> : <Activity className="w-3 h-3" />}
              <span>{trend}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-3">
          <div className="px-3 py-1 rounded-lg bg-panel-elevated/60 border border-line/40 backdrop-blur-md shadow-sm">
            <span className="text-[9px] font-black text-text uppercase tracking-widest opacity-80">{statusText}</span>
          </div>
          
          <div className="flex items-center gap-2 opacity-40 group-hover:opacity-70 transition-opacity">
            <Clock className="w-3 h-3 text-accent" />
            <span className="text-[9px] font-mono font-bold uppercase tracking-tighter text-text">
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent group-hover:via-accent/60 transition-all duration-700" />
      
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity pointer-events-none" 
        style={{ backgroundImage: `radial-gradient(${accentColor} 0.5px, transparent 0.5px)`, backgroundSize: '12px 12px' }} 
      />
    </motion.div>
  );
}
