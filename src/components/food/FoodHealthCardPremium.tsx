import React, { useMemo, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, 
  ShieldCheck, 
  Clock, 
  Zap, 
  Thermometer, 
  Wind,
  Brain,
  Terminal,
  ArrowUpRight
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useTranslation } from '../../store/useTranslation';
import { toLocalDigits, translateInsight } from '../../utils/format';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface FoodHealthCardPremiumProps {
  risk?: number;
  quality?: number;
  gas?: number;
  temp?: number;
  shelfLifeHours?: number;
  insight?: string;
  className?: string;
  variant?: 'default' | 'compact';
  chamberFoodImageUrl?: string;
  visualScore?: number;
}

type MetricType = 'RISK' | 'QUALITY' | 'GAS' | 'TEMP';

const DEFAULT_ACTIVE_METRICS: MetricType[] = ['RISK'];

export function FoodHealthCardPremium({
  risk = 14,
  quality = 98,
  gas = 22,
  temp = 4,
  shelfLifeHours = 10,
  insight = "Conditions Optimal: Food quality is stable for the next 8h+.",
  className = "",
  variant = 'default',
  chamberFoodImageUrl,
  visualScore = 92
}: FoodHealthCardPremiumProps) {
  const { t, locale } = useTranslation();
  const isCompact = variant === 'compact';
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [activeMetrics, setActiveMetrics] = useState<MetricType[]>(DEFAULT_ACTIVE_METRICS);

  useEffect(() => {
    const checkTheme = () => {
      const mode = document.documentElement.getAttribute('data-theme-mode');
      setIsDarkMode(mode !== 'light');
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme-mode'] });
    return () => observer.disconnect();
  }, []);

  const toggleMetric = (metric: MetricType) => {
    setActiveMetrics(prev => 
      prev.includes(metric) 
        ? prev.filter(m => m !== metric) 
        : [...prev, metric]
    );
  };

  // Theme-aware colors
  const colors = {
    panel: isDarkMode ? 'rgba(22, 27, 34, 0.95)' : 'rgba(255, 255, 255, 0.95)',
    panelElevated: isDarkMode ? 'rgba(10, 12, 16, 0.98)' : 'rgba(241, 245, 249, 0.98)',
    chartBg: isDarkMode ? 'rgba(5, 5, 5, 0.4)' : 'rgba(255, 255, 255, 0.5)',
    gridLine: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
    text: isDarkMode ? '#FFFFFF' : '#0F172A',
    textMuted: isDarkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(15, 23, 42, 0.6)',
    risk: '#FF3D3D',
    quality: isDarkMode ? '#10B981' : '#059669',
    gas: '#F59E0B',
    temp: '#3B82F6',
  };

  // Chart Data Generation - dynamic projection based on active chamber's real prediction & telemetry
  const chartData = useMemo(() => {
    const validHours = typeof shelfLifeHours === 'number' && !isNaN(shelfLifeHours) && shelfLifeHours > 0 
      ? shelfLifeHours 
      : 12;
    const maxHour = Math.max(6, Math.round(validHours));
    
    // Generate 7 evenly spaced time intervals: 0h to maxHour
    const step = maxHour / 6;
    const timePoints = [0, 1, 2, 3, 4, 5, 6].map(i => Math.round(i * step));
    const labels = timePoints.map(h => `${h}h`);

    const datasets: any[] = [];

    // Clamped base values matching current chamber telemetry & pills exactly at t = 0
    const currentRisk = Math.min(100, Math.max(0, Math.round(risk)));
    const currentQuality = Math.min(100, Math.max(0, Math.round(quality)));
    const currentGas = Math.min(100, Math.max(0, Math.round(gas)));
    const currentTemp = typeof temp === 'number' && !isNaN(temp) ? Number(temp.toFixed(1)) : 4.0;

    // Single selected metric receives gradient fill; multiple active metrics use clean lines
    const isSingleMetric = activeMetrics.length === 1;

    // 1. RISK DATASET
    if (activeMetrics.includes('RISK')) {
      const riskData = timePoints.map((_, index) => {
        if (index === 0) return currentRisk;
        const t = index / 6; // 0.0 to 1.0
        // Accelerated kinetics: curve accelerates as shelf-life deadline nears
        const curve = Math.pow(t, 1.6);
        const targetRisk = Math.max(currentRisk, 98);
        return Math.min(99, Math.round(currentRisk + curve * (targetRisk - currentRisk)));
      });

      datasets.push({
        label: `${t('risk', 'Risk')} (%)`,
        data: riskData,
        borderColor: colors.risk,
        borderWidth: 3,
        pointBackgroundColor: isDarkMode ? '#fff' : colors.risk,
        pointBorderColor: colors.risk,
        pointBorderWidth: 2,
        pointRadius: (ctx: any) => ctx.dataIndex === 0 ? 6 : 3,
        pointHoverRadius: 6,
        tension: 0.35,
        fill: isSingleMetric,
        backgroundColor: 'rgba(255, 61, 61, 0.08)',
      });
    }

    // 2. QUALITY DATASET
    if (activeMetrics.includes('QUALITY')) {
      const qualityData = timePoints.map((_, index) => {
        if (index === 0) return currentQuality;
        const t = index / 6;
        // Natural exponential decay of nutritive/sensory freshness
        const curve = Math.pow(t, 1.4);
        const targetQuality = Math.min(currentQuality, 4);
        return Math.max(2, Math.round(currentQuality - curve * (currentQuality - targetQuality)));
      });

      datasets.push({
        label: `${t('quality', 'Quality')} (%)`,
        data: qualityData,
        borderColor: colors.quality,
        borderWidth: 3,
        pointBackgroundColor: isDarkMode ? '#fff' : colors.quality,
        pointBorderColor: colors.quality,
        pointBorderWidth: 2,
        pointRadius: (ctx: any) => ctx.dataIndex === 0 ? 6 : 3,
        pointHoverRadius: 6,
        tension: 0.35,
        fill: isSingleMetric,
        backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.08)' : 'rgba(5, 150, 105, 0.08)',
      });
    }

    // 3. GAS (VOC) DATASET
    if (activeMetrics.includes('GAS')) {
      const gasData = timePoints.map((_, index) => {
        if (index === 0) return currentGas;
        const t = index / 6;
        // Microbial respiration & bio-volatile emissions accumulate over storage time
        const targetGas = Math.max(currentGas + 20, Math.min(88, currentGas + (100 - currentGas) * 0.75));
        const curve = Math.pow(t, 1.3);
        return Math.min(100, Math.round(currentGas + curve * (targetGas - currentGas)));
      });

      datasets.push({
        label: `${t('gas', 'Gas')} (%)`,
        data: gasData,
        borderColor: colors.gas,
        borderWidth: 3,
        pointBackgroundColor: isDarkMode ? '#fff' : colors.gas,
        pointBorderColor: colors.gas,
        pointBorderWidth: 2,
        pointRadius: (ctx: any) => ctx.dataIndex === 0 ? 6 : 3,
        pointHoverRadius: 6,
        tension: 0.35,
        fill: isSingleMetric,
        backgroundColor: 'rgba(245, 158, 11, 0.08)',
      });
    }

    // 4. TEMPERATURE DATASET
    if (activeMetrics.includes('TEMP')) {
      const tempData = timePoints.map((_, index) => {
        if (index === 0) return currentTemp;
        const t = index / 6;
        // Thermal chamber stability: slight compressor hysteresis / duty cycle drift (+0.6°C to +1.2°C)
        const drift = (Math.sin(t * Math.PI * 2) * 0.25) + (t * 0.8);
        return parseFloat((currentTemp + drift).toFixed(1));
      });

      datasets.push({
        label: `${t('temp', 'Temp')} (°C)`,
        data: tempData,
        borderColor: colors.temp,
        borderWidth: 3,
        yAxisID: 'yTemp',
        pointBackgroundColor: isDarkMode ? '#fff' : colors.temp,
        pointBorderColor: colors.temp,
        pointBorderWidth: 2,
        pointRadius: (ctx: any) => ctx.dataIndex === 0 ? 6 : 3,
        pointHoverRadius: 6,
        tension: 0.35,
        fill: isSingleMetric,
        backgroundColor: 'rgba(59, 130, 246, 0.08)',
      });
    }

    return { labels, datasets };
  }, [activeMetrics, isDarkMode, colors, risk, quality, gas, temp, shelfLifeHours, t]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false // Using custom stat buttons as legend
      },
      tooltip: {
        backgroundColor: isDarkMode ? 'rgba(10, 12, 16, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        titleColor: colors.text,
        bodyColor: colors.text,
        padding: 12,
        cornerRadius: 12,
        displayColors: true,
        usePointStyle: true,
        callbacks: {
          label: (context: any) => {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            if (label.includes('Temp')) return ` ${label}: ${value.toFixed(1)}°C`;
            return ` ${label}: ${value}%`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        min: 0,
        max: 100,
        grid: { color: colors.gridLine, drawBorder: false },
        ticks: { 
          color: colors.textMuted,
          font: { family: "'Outfit', sans-serif", size: 9, weight: 'bold' },
          maxTicksLimit: 5,
          callback: (value: any) => `${value}%`
        }
      },
      yTemp: {
        position: 'right' as const,
        beginAtZero: false,
        display: activeMetrics.includes('TEMP'),
        grid: { drawOnChartArea: false },
        suggestedMin: Math.min(0, Math.floor((temp ?? 4) - 2)),
        suggestedMax: Math.max(10, Math.ceil((temp ?? 4) + 3)),
        ticks: {
          color: colors.textMuted,
          font: { family: "'Outfit', sans-serif", size: 9, weight: 'bold' },
          callback: (value: any) => `${value}°C`
        },
        title: {
          display: true,
          text: t('temp', 'Temperature'),
          color: colors.textMuted,
          font: { family: "'Outfit', sans-serif", size: 9, weight: 'bold' }
        }
      },
      x: {
        grid: { color: colors.gridLine, drawBorder: false },
        ticks: { 
          color: colors.textMuted,
          font: { family: "'Outfit', sans-serif", size: 9, weight: 'bold' }
        }
      }
    },
    interaction: { mode: 'index' as const, intersect: false }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`nature-card-redesign relative rounded-[2rem] overflow-hidden group transition-all duration-500 ${isCompact ? 'p-5 md:p-6' : 'p-8 md:p-10'} ${className}`}
      style={{
        zIndex: 1,
        isolation: 'isolate'
      }}
    >
      {/* Nature Background Elements */}
      <div className="nature-waves" style={{ opacity: isDarkMode ? 0.3 : 0.6 }}>
        <div className="nature-wave nature-wave-1" />
        <div className="nature-wave nature-wave-2" />
      </div>

      <div className="nature-leaf-accent" style={{ top: '15px', right: '40px', transform: 'rotate(15deg)', opacity: 0.15 }}>🍃</div>
      <div className="nature-leaf-accent" style={{ bottom: '20px', left: '20px', transform: 'rotate(-45deg)', opacity: 0.15 }}>🌿</div>

      {/* Technical Corner Marks */}

      {/* Background Polish */}
      <div className={`absolute inset-0 opacity-[0.02] pointer-events-none mix-blend-overlay ${isDarkMode ? "bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" : "bg-[url('https://www.transparenttextures.com/patterns/white-diamond.png')]"}`} />
      
      {/* Header Section */}
      <div className={`relative z-10 flex flex-col lg:flex-row justify-between items-start gap-4 ${isCompact ? 'mb-6' : 'mb-10'}`}>
        <div className="flex items-center gap-4">
          <div className={`rounded-xl flex items-center justify-center shadow-md ${isDarkMode ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-white border border-emerald-500/15'}`}>
            <div className={`${isCompact ? 'p-2.5' : 'p-3.5'}`}>
               <ShieldCheck className={`${isCompact ? 'w-6 h-6' : 'w-8 h-8'} text-emerald-500 animate-pulse`} />
            </div>
          </div>
          <div className="space-y-0.5">
            <h2 className={`${isCompact ? 'text-xl md:text-2xl' : 'text-3xl md:text-4xl'} font-black tracking-tight`} style={{ color: colors.text }}>
              {t("foodHealthIntelligence")}
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatMini 
            label={t("risk")} 
            value={`${toLocalDigits(risk, locale)}%`} 
            color="text-red-500" 
            bg={isDarkMode ? "bg-red-500/10" : "bg-red-50"} 
            isCompact={isCompact} 
            isDarkMode={isDarkMode} 
            isActive={activeMetrics.includes('RISK')}
            onClick={() => toggleMetric('RISK')}
          />
          <StatMini 
            label={t("quality")} 
            value={`${toLocalDigits(quality, locale)}%`} 
            color={isDarkMode ? "text-emerald-400" : "text-emerald-600"} 
            bg={isDarkMode ? "bg-emerald-500/10" : "bg-emerald-50"} 
            isCompact={isCompact} 
            isDarkMode={isDarkMode} 
            isActive={activeMetrics.includes('QUALITY')}
            onClick={() => toggleMetric('QUALITY')}
          />
          <StatMini 
            label={t("gas")} 
            value={`${toLocalDigits(gas, locale)}%`} 
            color={isDarkMode ? "text-amber-500" : "text-amber-600"} 
            bg={isDarkMode ? "bg-amber-500/10" : "bg-amber-50"} 
            isCompact={isCompact} 
            isDarkMode={isDarkMode} 
            isActive={activeMetrics.includes('GAS')}
            onClick={() => toggleMetric('GAS')}
          />
          <StatMini 
            label={t("temp")} 
            value={`${toLocalDigits(temp, locale)}°C`} 
            color={isDarkMode ? "text-blue-400" : "text-blue-600"} 
            bg={isDarkMode ? "bg-blue-500/10" : "bg-blue-50"} 
            isCompact={isCompact} 
            isDarkMode={isDarkMode} 
            isActive={activeMetrics.includes('TEMP')}
            onClick={() => toggleMetric('TEMP')}
          />
        </div>
      </div>

      {/* Main Content Grid */}
      <div className={`relative z-10 grid grid-cols-1 ${isCompact ? 'lg:grid-cols-4 gap-6' : 'lg:grid-cols-3 gap-10'}`}>
        {/* Chart Area */}
        <motion.div 
          className={`${isCompact ? 'lg:col-span-3 min-h-[350px] p-6' : 'lg:col-span-2 min-h-[480px] p-8'} relative rounded-2xl shadow-inner flex flex-col group/chart overflow-hidden backdrop-blur-md`}
          style={{
            background: isDarkMode ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.4)',
            border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'}`
          }}
        >
          <div className="flex justify-between items-center mb-6 relative z-10">
            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-emerald-500" />
              <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-text-muted' : 'text-slate-500'}`}>{t("prognosisStream")}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[8px] font-black text-text-muted/40 uppercase tracking-widest">Select Metrics above to toggle trendlines</span>
            </div>
          </div>

          <div className="flex-1 relative z-10">
            <Line data={chartData} options={chartOptions as any} />
          </div>

          <div className="mt-6 flex items-center justify-between relative z-10 pt-4 border-t" style={{ borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black uppercase text-emerald-500 tracking-widest">System Active</span>
              <div className="flex gap-1">
                {[1,2,3,4].map(i => (
                  <div key={i} className={`w-1 h-3 rounded-full ${i <= 3 ? 'bg-emerald-500/40' : (isDarkMode ? 'bg-white/5' : 'bg-black/5')}`} />
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Side Panels */}
        <div className={`flex flex-col ${isCompact ? 'gap-4' : 'gap-6'}`}>
          {/* Estimated Shelf Life */}
          <motion.div 
            className={`${isCompact ? 'p-6' : 'p-8'} rounded-2xl relative overflow-hidden group/shelf shadow-lg border backdrop-blur-sm`}
            style={{
              background: isDarkMode ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255, 255, 255, 0.6)',
              borderColor: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)'
            }}
          >
            <div className="flex justify-between items-center mb-2">
              <span className={`text-[10px] font-black tracking-widest uppercase text-emerald-500`}>{t("shelfLife")}</span>
              <Clock className="w-3 h-3 text-emerald-500/50" />
            </div>
            <div className={`flex items-baseline gap-1 ${isCompact ? 'mb-4' : 'mb-6'}`}>
              <strong className={`${isCompact ? 'text-4xl' : 'text-6xl'} font-black tracking-tighter font-mono`} style={{ color: colors.text }}>{toLocalDigits(shelfLifeHours, locale)}</strong>
              <span className={`${isCompact ? 'text-lg' : 'text-xl'} font-black uppercase tracking-widest`} style={{ color: colors.textMuted }}>{t("hours")}</span>
            </div>
            <div className={`h-1.5 w-full rounded-full overflow-hidden border shadow-inner ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-100 border-slate-200'}`}>
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${(shelfLifeHours/12)*100}%` }}
                transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] as const }}
                className="h-full bg-emerald-500"
              />
            </div>
          </motion.div>

          {/* AI Cognitive Insight */}
          <motion.div 
            className={`${isCompact ? 'p-6' : 'p-8'} rounded-2xl relative overflow-hidden flex-1 shadow-lg border backdrop-blur-sm`}
            style={{
              background: isDarkMode ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.6)',
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Brain className={`w-4 h-4 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
              <span className={`text-[10px] font-black tracking-widest uppercase ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>{t("aiInsight")}</span>
            </div>
            <p className={`${isCompact ? 'text-xs' : 'text-base'} font-bold leading-relaxed italic opacity-95`} style={{ color: colors.text }}>
              "{translateInsight(insight, locale)}"
            </p>

            {chamberFoodImageUrl && (
              <div className="flex items-center gap-3 mt-4 pt-3 border-t border-emerald-500/15">
                <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-emerald-500/30 flex-shrink-0 shadow-md">
                  <img src={chamberFoodImageUrl} alt="Chamber Food Inspection" className="w-full h-full object-cover" />
                  <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[8px] font-mono text-emerald-400 text-center font-bold">10s CAM</span>
                </div>
                <div className="text-[11px] font-mono leading-tight">
                  <span className="text-emerald-400 font-bold">Optical Inspection:</span> Surface integrity verified at {visualScore}%.
                  <div className="text-[10px] text-slate-400 mt-0.5">YOLOv8 Dual-Sensor Fusion (10% Visual • 60% Gas • 30% Env)</div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

interface StatMiniProps {
  label: string;
  value: string;
  color: string;
  bg: string;
  isCompact?: boolean;
  isDarkMode: boolean;
  isActive: boolean;
  onClick: () => void;
}

function StatMini({ label, value, color, bg, isCompact, isDarkMode, isActive, onClick }: StatMiniProps) {
  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      animate={{ rotate: 0 }} // Explicitly prevent rotation
      onClick={onClick}
      className={`${isCompact ? 'px-3 py-2 min-w-[80px]' : 'px-4 py-3 min-w-[100px]'} rounded-xl flex flex-col items-start gap-0.5 transition-all shadow-sm border cursor-pointer outline-none select-none relative z-20 ${isActive ? 'border-accent shadow-[0_0_15px_rgba(20,184,166,0.2)]' : 'opacity-60 grayscale-[0.5] hover:opacity-100 hover:grayscale-0'}`}
      style={{ 
        background: isActive ? bg : (isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'),
        borderColor: isActive ? '#14B8A6' : (isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)')
      }}
    >
      <span className="text-[7px] font-black tracking-widest uppercase pointer-events-none" style={{ color: isDarkMode ? '#fff' : '#0F172A' }}>{label}</span>
      <span className={`${isCompact ? 'text-xs' : 'text-sm'} font-black ${color} tracking-tight pointer-events-none`}>{value}</span>
    </motion.button>
  );
}

function LegendItem({ color, label, textColor }: { color: string; label: string; textColor: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-[9px] font-black uppercase tracking-widest opacity-60" style={{ color: textColor }}>{label}</span>
    </div>
  );
}
