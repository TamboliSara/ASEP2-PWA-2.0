import { motion } from "framer-motion";
import { Scale, Package, Thermometer, Droplets, ShieldCheck, Ban, Beef, CupSoda, Info, X } from "lucide-react";
import { TextReveal } from "./TextReveal";

interface SafetyCapacityCardProps {
  onClose?: () => void;
}

export function SafetyCapacityCard({ onClose }: SafetyCapacityCardProps) {
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
            <h2 className="text-2xl font-black tracking-tight text-text uppercase">Safety & Capacity</h2>
          </div>
        </TextReveal>
        <TextReveal direction="right" distance={20} delay={0.2}>
          <div className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#064e3b] border border-[#059669]/30 text-white shadow-xl">
            <ShieldCheck className="w-4 h-4 text-[#34d399]" />
            <span className="text-xs font-black tracking-widest uppercase">Certified Safe</span>
          </div>
        </TextReveal>
      </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          {[
            { icon: Scale, label: "Max Weight", val: "12", unit: "kg" },
            { icon: Package, label: "Volume", val: "20", unit: "L" },
            { icon: Thermometer, label: "Temp Zone", val: "2 – 8", unit: "°C" },
            { icon: Droplets, label: "Humidity", val: "75", unit: "%", prefix: "≤" },
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
      <div className="p-8 rounded-[2.5rem] bg-accent-warm/10 border border-accent-warm/30 shadow-inner">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-1.5 rounded-lg bg-accent-warm/20">
            <Ban className="w-5 h-5 text-accent-warm" />
          </div>
          <h3 className="text-sm font-black tracking-widest uppercase text-accent-warm">Restrictions</h3>
        </div>
        
        <div className="flex flex-wrap gap-3">
          {[
            { icon: Beef, label: "Raw Meat" },
            { icon: CupSoda, label: "Liquids" },
            { icon: Info, label: "Allergens" },
          ].map((res, idx) => (
            <div key={idx} className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-panel/60 border border-accent-warm/20 text-accent-warm shadow-sm hover:bg-panel transition-colors">
              <res.icon className="w-4 h-4" />
              <span className="text-xs font-black tracking-wider uppercase">{res.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
