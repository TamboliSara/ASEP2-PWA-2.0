import { motion } from "framer-motion";
import { Scale, Package, Thermometer, Droplets, ShieldCheck, Ban, Beef, CupSoda, Info, X, Wind } from "lucide-react";
import { TextReveal } from "../effects/TextReveal";
import { useTranslation } from "../../store/useTranslation";

interface SafetyCapacityCardProps {
  onClose?: () => void;
}

export function SafetyCapacityCard({ onClose }: SafetyCapacityCardProps) {
  const { t } = useTranslation();

  return (
    <div className="relative w-full max-w-2xl bg-panel/95 backdrop-blur-3xl border border-line/50 rounded-[2.5rem] overflow-hidden shadow-[0_32px_120px_-20px_rgba(0,0,0,0.4)] p-8 md:p-10">
      {onClose && (
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2.5 rounded-full bg-panel border border-line hover:bg-accent/10 text-text-muted hover:text-accent transition-all z-20 shadow-sm"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <TextReveal direction="left" distance={20} delay={0.1}>
          <div className="flex items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-accent/10 border border-accent/20 shadow-inner">
              <ShieldCheck className="w-6 h-6 text-accent" />
            </div>
            <h2 className="text-2xl font-black tracking-tight text-text uppercase">{t("donorSafetyGuidelines", "Safety & Capacity")}</h2>
          </div>
        </TextReveal>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
        {[
          { icon: Scale, label: t("maxWeight", "Max Weight"), val: "12", unit: "kg" },
          { icon: Package, label: t("volume", "Volume"), val: "20", unit: "L" },
          { icon: Thermometer, label: t("tempZone", "Temp Zone"), val: "2 – 8", unit: "°C" },
          { icon: Droplets, label: t("humidityLabel", "Humidity"), val: "75", unit: "%", prefix: "≤" },
        ].map((stat, idx) => (
          <TextReveal key={idx} direction="up" distance={15} delay={0.1 + idx * 0.05}>
            <div className="flex items-center gap-5 p-6 rounded-3xl bg-panel-elevated/80 border border-line/60 hover:border-accent/40 transition-all group shadow-sm hover:shadow-md h-full">
              <div className="p-4 rounded-2xl bg-accent/10 group-hover:bg-accent/20 transition-colors shadow-inner">
                <stat.icon className="w-7 h-7 text-accent" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-accent/70 mb-1">{stat.label}</p>
                <div className="flex items-baseline gap-1">
                  {stat.prefix && <span className="text-sm font-black text-text">{stat.prefix}</span>}
                  <span className="text-3xl font-black text-text tracking-tighter">{stat.val}</span>
                  <span className="text-sm font-bold text-accent">{stat.unit}</span>
                </div>
              </div>
            </div>
          </TextReveal>
        ))}
      </div>

      {/* Restrictions Section */}
      <div className="p-6 md:p-8 rounded-[2.5rem] bg-accent-warm/10 border border-accent-warm/30 shadow-inner">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-1.5 rounded-lg bg-accent-warm/20">
            <Ban className="w-5 h-5 text-accent-warm" />
          </div>
          <div className="flex flex-col">
            <h3 className="text-sm font-black tracking-widest uppercase text-accent-warm leading-none">{t("restrictions", "Restrictions")}</h3>
            <p className="text-[9px] font-bold text-accent-warm/70 mt-1.5 uppercase tracking-wider">{t("avoidVacuumSeals", "Avoid vacuum seals for sensor ventilation")}</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { icon: Beef, label: t("rawMeat", "Raw Meat") },
            { icon: CupSoda, label: t("liquids", "Liquids") },
            { icon: Wind, label: t("airtightSeals", "Airtight Seals"), isCritical: true },
            { icon: Info, label: t("allergens", "Allergens") },
          ].map((res, idx) => {
            const isHighlighted = res.isCritical;
            return (
              <motion.div 
                key={idx} 
                initial={isHighlighted ? { scale: 0.95, opacity: 0.8 } : {}}
                animate={isHighlighted ? { 
                  scale: [1, 1.05, 1],
                  opacity: 1,
                  boxShadow: [
                    "0 0 0px rgba(var(--accent-warm-rgb), 0)",
                    "0 0 20px rgba(var(--accent-warm-rgb), 0.4)",
                    "0 0 0px rgba(var(--accent-warm-rgb), 0)"
                  ]
                } : {}}
                transition={isHighlighted ? { 
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                } : {}}
                className={`relative flex items-center gap-3 px-6 py-3 rounded-2xl transition-all duration-500 ${
                  isHighlighted 
                    ? "bg-accent-warm/20 border-2 border-accent-warm shadow-lg z-10 text-accent-warm" 
                    : "bg-panel/60 border border-accent-warm/20 text-accent-warm shadow-sm hover:bg-panel"
                }`}
              >
                <res.icon className={`w-4 h-4 ${isHighlighted ? "animate-bounce" : ""}`} />
                <span className="text-xs font-black tracking-wider uppercase">{res.label}</span>
                {isHighlighted && (
                  <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-accent-warm text-[8px] font-black text-white rounded-full shadow-sm">{t("critical", "CRITICAL")}</span>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
