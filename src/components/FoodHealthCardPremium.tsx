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
}

type MetricType = 'RISK' | 'QUALITY' | 'GAS' | 'TEMP';

export function FoodHealthCardPremium({
  risk = 14,
  quality = 98,
  gas = 22,
  temp = 4,
  shelfLifeHours = 10,
  insight = "Conditions Optimal: Food quality is stable for the next 8h+.",
  className = "",
  variant = 'default'
}: FoodHealthCardPremiumProps) {
  
  const isCompact = variant === 'compact';
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [activeMetrics, setActiveMetrics] = useState<MetricType[]>(['RISK', 'QUALITY', 'TEMP']);

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
    quality: isDarkMode ? '#8B5CF6' : '#6D28D9',
    gas: '#F59E0B',
    temp: '#3B82F6',
  };

  // Chart Data Generation
  const chartData = useMemo(() => {
    const labels = ['0h', '2h', '4h', '6h', '8h', '10h', '12h'];
    
    const datasets = [];

    if (activeMetrics.includes('RISK')) {
      datasets.push({
        label: 'Risk (%)',
        data: [14, 15, 22, 33, 49, 71, 96],
        borderColor: colors.risk,
        borderWidth: 3,
        pointBackgroundColor: isDarkMode ? '#fff' : colors.risk,
        pointBorderColor: colors.risk,
        pointBorderWidth: 2,
        pointRadius: (ctx: any) => ctx.dataIndex === 0 ? 6 : 2,
        pointHoverRadius: 6,
        tension: 0.4,
        fill: true,
        backgroundColor: 'rgba(255, 61, 61, 0.05)',
      });
    }

    if (activeMetrics.includes('QUALITY')) {
      datasets.push({
        label: 'Quality (%)',
        data: [98, 94, 85, 71, 53, 30, 4],
        borderColor: colors.quality,
        borderWidth: 3,
        pointBackgroundColor: isDarkMode ? '#fff' : colors.quality,
        pointBorderColor: colors.quality,
        pointBorderWidth: 2,
        pointRadius: (ctx: any) => ctx.dataIndex === 0 ? 6 : 2,
        pointHoverRadius: 6,
        tension: 0.4,
        fill: true,
        backgroundColor: isDarkMode ? 'rgba(139, 92, 246, 0.05)' : 'rgba(109, 40, 217, 0.05)',
      });
    }

    if (activeMetrics.includes('GAS')) {
      datasets.push({
        label: 'Gas (ppm)',
        data: [22, 24, 28, 35, 42, 55, 70],
        borderColor: colors.gas,
        borderWidth: 3,
        pointBackgroundColor: isDarkMode ? '#fff' : colors.gas,
        pointBorderColor: colors.gas,
        pointBorderWidth: 2,
        pointRadius: (ctx: any) => ctx.dataIndex === 0 ? 6 : 2,
        pointHoverRadius: 6,
        tension: 0.4,
        fill: true,
        backgroundColor: 'rgba(245, 158, 11, 0.05)',
      });
    }

    if (activeMetrics.includes('TEMP')) {
      datasets.push({
        label: 'Temp (°C)',
        data: [4.8, 4.9, 5.1, 5.0, 5.2, 5.5, 6.0],
        borderColor: colors.temp,
        borderWidth: 3,
        yAxisID: 'yTemp',
        pointBackgroundColor: isDarkMode ? '#fff' : colors.temp,
        pointBorderColor: colors.temp,
        pointBorderWidth: 2,
        pointRadius: (ctx: any) => ctx.dataIndex === 0 ? 6 : 2,
        pointHoverRadius: 6,
        tension: 0.4,
        fill: true,
        backgroundColor: 'rgba(59, 130, 246, 0.05)',
      });
    }

    return { labels, datasets };
  }, [activeMetrics, isDarkMode, colors]);

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
        beginAtZero: true,
        display: activeMetrics.includes('TEMP'),
        grid: { drawOnChartArea: false },
        ticks: {
          color: colors.textMuted,
          font: { family: "'Outfit', sans-serif", size: 9, weight: 'bold' },
          callback: (value: any) => `${value}°C`
        },
        title: {
          display: true,
          text: 'Temperature',
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
      className={`relative rounded-[2rem] overflow-hidden group shadow-xl transition-all duration-500 ${isCompact ? 'p-5 md:p-6' : 'p-8 md:p-10'} ${className}`}
      style={{
        background: isDarkMode 
          ? `linear-gradient(135deg, ${colors.panel} 0%, ${colors.panelElevated} 100%)`
          : `linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)`,
        border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
        zIndex: 1,
        isolation: 'isolate'
      }}
    >
      {/* Background Polish */}
      <div className={`absolute inset-0 opacity-[0.02] pointer-events-none mix-blend-overlay ${isDarkMode ? "bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" : "bg-[url('https://www.transparenttextures.com/patterns/white-diamond.png')]"}`} />
      
      {/* Header Section */}
      <div className={`relative z-10 flex flex-col lg:flex-row justify-between items-start gap-4 ${isCompact ? 'mb-6' : 'mb-10'}`}>
        <div className="flex items-center gap-4">
          <div className={`rounded-xl flex items-center justify-center shadow-md ${isDarkMode ? 'bg-accent/10 border border-accent/20' : 'bg-white border border-accent/15'}`}>
            <div className={`${isCompact ? 'p-2.5' : 'p-3.5'}`}>
               <ShieldCheck className={`${isCompact ? 'w-6 h-6' : 'w-8 h-8'} text-accent animate-pulse`} />
            </div>
          </div>
          <div className="space-y-0.5">
            <span className={`text-[9px] font-black tracking-[0.4em] uppercase block ${isDarkMode ? 'text-accent/80' : 'text-accent'}`}>
              [INTERACTIVE_DIAGNOSTICS]
            </span>
            <h2 className={`${isCompact ? 'text-xl md:text-2xl' : 'text-3xl md:text-4xl'} font-black tracking-tight`} style={{ color: colors.text }}>
              Food Health Intelligence
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatMini 
            label="RISK" 
            value={`${risk}%`} 
            color="text-red-500" 
            bg={isDarkMode ? "bg-red-500/10" : "bg-red-50"} 
            isCompact={isCompact} 
            isDarkMode={isDarkMode} 
            isActive={activeMetrics.includes('RISK')}
            onClick={() => toggleMetric('RISK')}
          />
          <StatMini 
            label="QUALITY" 
            value={`${quality}%`} 
            color={isDarkMode ? "text-purple-400" : "text-purple-600"} 
            bg={isDarkMode ? "bg-purple-500/10" : "bg-purple-50"} 
            isCompact={isCompact} 
            isDarkMode={isDarkMode} 
            isActive={activeMetrics.includes('QUALITY')}
            onClick={() => toggleMetric('QUALITY')}
          />
          <StatMini 
            label="GAS" 
            value={`${gas}%`} 
            color={isDarkMode ? "text-amber-500" : "text-amber-600"} 
            bg={isDarkMode ? "bg-amber-500/10" : "bg-amber-50"} 
            isCompact={isCompact} 
            isDarkMode={isDarkMode} 
            isActive={activeMetrics.includes('GAS')}
            onClick={() => toggleMetric('GAS')}
          />
          <StatMini 
            label="TEMP" 
            value={`${temp}°C`} 
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
          className={`${isCompact ? 'lg:col-span-3 min-h-[350px] p-6' : 'lg:col-span-2 min-h-[480px] p-8'} relative rounded-2xl shadow-inner flex flex-col group/chart overflow-hidden`}
          style={{
            background: colors.chartBg,
            border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'}`
          }}
        >
          <div className="flex justify-between items-center mb-6 relative z-10">
            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-accent" />
              <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-text-muted' : 'text-slate-500'}`}>Interactive Prognosis Stream</span>
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
              <span className="text-[9px] font-black uppercase text-accent tracking-widest">Active</span>
              <div className="flex gap-1">
                {[1,2,3,4].map(i => (
                  <div key={i} className={`w-1 h-3 rounded-full ${i <= 3 ? 'bg-accent/40' : (isDarkMode ? 'bg-white/5' : 'bg-black/5')}`} />
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Side Panels */}
        <div className={`flex flex-col ${isCompact ? 'gap-4' : 'gap-6'}`}>
          {/* Estimated Shelf Life */}
          <motion.div 
            className={`${isCompact ? 'p-6' : 'p-8'} rounded-2xl relative overflow-hidden group/shelf shadow-lg border`}
            style={{
              background: isDarkMode ? 'rgba(20, 184, 166, 0.05)' : '#FFFFFF',
              borderColor: isDarkMode ? 'rgba(20, 184, 166, 0.15)' : 'rgba(0, 0, 0, 0.05)'
            }}
          >
            <div className="flex justify-between items-center mb-2">
              <span className={`text-[10px] font-black tracking-widest uppercase text-accent`}>SHELF_LIFE</span>
            </div>
            <div className={`flex items-baseline gap-1 ${isCompact ? 'mb-4' : 'mb-6'}`}>
              <strong className={`${isCompact ? 'text-4xl' : 'text-6xl'} font-black tracking-tighter font-mono`} style={{ color: colors.text }}>{shelfLifeHours}</strong>
              <span className={`${isCompact ? 'text-lg' : 'text-xl'} font-black uppercase tracking-widest`} style={{ color: colors.textMuted }}>hrs</span>
            </div>
            <div className={`h-1.5 w-full rounded-full overflow-hidden border shadow-inner ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-100 border-slate-200'}`}>
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${(shelfLifeHours/12)*100}%` }}
                transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] }}
                className="h-full bg-accent"
              />
            </div>
          </motion.div>

          {/* AI Cognitive Insight */}
          <motion.div 
            className={`${isCompact ? 'p-6' : 'p-8'} rounded-2xl relative overflow-hidden flex-1 shadow-lg border`}
            style={{
              background: isDarkMode ? 'rgba(255, 255, 255, 0.02)' : '#FFFFFF',
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Brain className={`w-4 h-4 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`} />
              <span className={`text-[10px] font-black tracking-widest uppercase ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>AI_INSIGHT</span>
            </div>
            <p className={`${isCompact ? 'text-xs' : 'text-base'} font-bold leading-relaxed italic opacity-95`} style={{ color: colors.text }}>
              "{insight}"
            </p>
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
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      animate={{ rotate: 0 }} // Explicitly prevent rotation
      onClick={onClick}
      className={`${isCompact ? 'px-3 py-2 min-w-[80px]' : 'px-4 py-3 min-w-[100px]'} rounded-xl flex flex-col items-start gap-0.5 transition-all shadow-sm border cursor-pointer outline-none ${isActive ? 'border-accent shadow-[0_0_15px_rgba(20,184,166,0.2)]' : 'opacity-60 grayscale-[0.5] hover:opacity-100 hover:grayscale-0'}`}
      style={{ 
        background: isActive ? bg : (isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'),
        borderColor: isActive ? '#14B8A6' : (isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)')
      }}
    >
      <span className="text-[7px] font-black tracking-widest uppercase" style={{ color: isDarkMode ? '#fff' : '#0F172A' }}>{label}</span>
      <span className={`${isCompact ? 'text-xs' : 'text-sm'} font-black ${color} tracking-tight`}>{value}</span>
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
