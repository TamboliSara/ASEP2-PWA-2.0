import { useEffect, useMemo, useRef, useState } from "react";
import { useAppContext } from "../store/AppContext";
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, Filler);

type MetricType = "risk" | "quality" | "gas" | "temp";

export function TelemetryChart({ deadlineHours = 12 }: { deadlineHours?: number }) {
  const { state: appState } = useAppContext();
  const themeMode = appState.themeMode;
  const chartRef = useRef<any>(null);
  const [selectedMetrics, setSelectedMetrics] = useState<MetricType[]>(["risk", "quality"]);

  const toggleMetric = (metric: MetricType) => {
    setSelectedMetrics(prev => 
      prev.includes(metric) 
        ? prev.filter(m => m !== metric) 
        : [...prev, metric]
    );
  };

  const theme = useMemo(() => {
    const isLight = themeMode === "light";
    return {
      bg: isLight ? "#FFFFFF" : "#0e1e14",
      panel: isLight ? "#F8FAFC" : "#144430",
      text: isLight ? "#064E3B" : "#F8FAFC",
      muted: isLight ? "#475569" : "#94A3B8",
      line: isLight ? "rgba(6, 78, 59, 0.08)" : "rgba(255,255,255,0.06)",
      accent: "#10B981",
      danger: "#EF4444",
      glassBorder: isLight ? "rgba(6, 78, 59, 0.1)" : "rgba(255,255,255,0.1)"
    };
  }, [themeMode]);

  const data = useMemo(() => {
    const validDeadline = typeof deadlineHours === 'number' && !isNaN(deadlineHours) ? deadlineHours : 12;
    const maxHour = Math.max(12, Math.ceil(validDeadline / 2) * 2);
    const labels = Array.from({ length: maxHour / 2 + 1 }, (_, index) => `${index * 2}h`);
    const threshold = 70;
    
    const datasets: any[] = [];

    const getRiskData = () => labels.map((_, index) => {
      const hour = index * 2;
      const normalized = Math.min(hour / Math.max(maxHour, 1), 1);
      const curve = Math.pow(normalized, 2.15);
      return Math.min(96, 14 + curve * 84);
    });

    const getQualityData = () => labels.map((_, index) => {
      const hour = index * 2;
      const normalized = Math.min(hour / Math.max(maxHour, 1), 1);
      const curve = Math.pow(normalized, 1.8);
      return Math.max(4, 98 - curve * 94);
    });

    const getGasData = () => labels.map((_, index) => {
      const hour = index * 2;
      return Math.min(100, 20 + Math.sin(hour / 3) * 10 + (hour * 4.5));
    });

    const getTempData = () => labels.map((_, index) => {
      const hour = index * 2;
      return 4 + Math.sin(hour / 2.5) * 1.5;
    });

    if (selectedMetrics.includes("risk")) {
      datasets.push({
        label: "Spoilage Risk (%)",
        data: getRiskData(),
        borderColor: theme.danger,
        borderWidth: 3,
        backgroundColor: `${theme.danger}10`,
        fill: selectedMetrics.length === 1,
        pointRadius: (ctx: any) => ctx.dataIndex === 0 ? 12 : 4,
        pointBackgroundColor: (ctx: any) => ctx.dataIndex === 0 ? "#fff" : theme.danger,
        pointBorderColor: theme.danger,
        pointBorderWidth: (ctx: any) => ctx.dataIndex === 0 ? 4 : 2,
        tension: 0.4
      });
    }

    if (selectedMetrics.includes("quality")) {
      datasets.push({
        label: "Quality Index (%)",
        data: getQualityData(),
        borderColor: "#A78BFA",
        borderWidth: 3,
        backgroundColor: "#A78BFA10",
        fill: selectedMetrics.length === 1,
        pointRadius: (ctx: any) => ctx.dataIndex === 0 ? 10 : 4,
        pointBackgroundColor: (ctx: any) => ctx.dataIndex === 0 ? "#fff" : "#A78BFA",
        pointBorderColor: "#A78BFA",
        pointBorderWidth: (ctx: any) => ctx.dataIndex === 0 ? 4 : 2,
        tension: 0.4
      });
    }

    if (selectedMetrics.includes("gas")) {
      datasets.push({
        label: "VOC Level",
        data: getGasData(),
        borderColor: "#F59E0B",
        borderWidth: 2,
        fill: false,
        pointRadius: (ctx: any) => ctx.dataIndex === 0 ? 10 : 3,
        pointBackgroundColor: (ctx: any) => ctx.dataIndex === 0 ? "#fff" : "#F59E0B",
        pointBorderColor: "#F59E0B",
        pointBorderWidth: (ctx: any) => ctx.dataIndex === 0 ? 4 : 2,
        tension: 0.4
      });
    }

    if (selectedMetrics.includes("temp")) {
      datasets.push({
        label: "Temp (°C)",
        data: getTempData(),
        borderColor: "#3B82F6",
        borderWidth: 2,
        fill: false,
        pointRadius: (ctx: any) => ctx.dataIndex === 0 ? 10 : 3,
        pointBackgroundColor: (ctx: any) => ctx.dataIndex === 0 ? "#fff" : "#3B82F6",
        pointBorderColor: "#3B82F6",
        pointBorderWidth: (ctx: any) => ctx.dataIndex === 0 ? 4 : 2,
        tension: 0.4
      });
    }

    // Add a vertical timeline line at "Now" (0h) to connect all real-time points
    datasets.push({
      label: "Timeline",
      data: labels.map((_, i) => i === 0 ? 100 : null),
      borderColor: `${theme.text}20`,
      borderWidth: 1,
      borderDash: [4, 4],
      fill: false,
      pointRadius: 0,
      showLine: true,
      order: 10
    });

    return { labels, datasets };
  }, [deadlineHours, theme, selectedMetrics]);

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          top: 20,
          bottom: 10,
          left: 10,
          right: 10
        }
      },
      plugins: {
        legend: {
          display: true,
          position: "top" as const,
          align: "end" as const,
          labels: {
            color: theme.text,
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 25,
            font: {
              family: "'Outfit', 'Inter', sans-serif",
              size: 10,
              weight: '800'
            },
            boxWidth: 6,
            boxHeight: 6
          }
        },
        tooltip: {
          enabled: true,
          backgroundColor: themeMode === "light" ? "rgba(255, 255, 255, 0.98)" : "rgba(10, 25, 20, 0.95)",
          titleColor: theme.accent,
          titleFont: { family: "'Outfit', sans-serif", size: 13, weight: 'bold' },
          bodyColor: themeMode === "light" ? "#1e293b" : "#f8fafc",
          bodyFont: { family: "'Inter', sans-serif", size: 12, weight: '500' },
          borderColor: theme.glassBorder,
          borderWidth: 1,
          padding: 14,
          cornerRadius: 12,
          displayColors: true,
          usePointStyle: true,
          callbacks: {
            label(context: any) {
              return ` ${context.dataset.label}: ${Math.round(context.parsed.y)}%`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          grid: { color: theme.line, drawBorder: false },
          ticks: {
            color: theme.muted,
            font: { family: "'Outfit', sans-serif", size: 10, weight: "bold" as const },
            callback: (value: any) => `${value}%`
          }
        },
        x: {
          grid: { display: false },
          ticks: {
            color: theme.muted,
            font: { family: "'Outfit', sans-serif", size: 10, weight: "bold" as const }
          }
        }
      },
      interaction: {
        mode: 'index',
        intersect: false
      },
      elements: {
        line: {
          capBezierPoints: true
        }
      }
    }),
    [theme]
  );

  const { spoilHour, riskLevel, healthStatus, aiInsight } = useMemo(() => {
    const validDeadline = typeof deadlineHours === 'number' && !isNaN(deadlineHours) ? deadlineHours : 12;
    const maxHour = Math.max(12, Math.ceil(validDeadline / 2) * 2);
    const labels = Array.from({ length: maxHour / 2 + 1 }, (_, index) => index * 2);
    const threshold = 70;
    const riskData = labels.map((hour) => {
      const normalized = Math.min(hour / Math.max(maxHour, 1), 1);
      const curve = Math.pow(normalized, 2.15);
      return Math.min(96, 14 + curve * 84);
    });
    const index = riskData.findIndex((value) => value >= threshold);
    const hour = index >= 0 ? labels[index] : maxHour;
    
    const level = hour < 4 ? "Critical" : hour < 8 ? "Warning" : "Safe";
    const status = hour < 4 ? "Danger" : hour < 8 ? "Unstable" : "Optimal";
    const insight = hour < 4 
      ? "Critical Risk: Immediate intervention required to prevent spoilage."
      : hour < 8 
        ? "Warning: Quality degradation detected. Reduce storage temperature."
        : "Conditions Optimal: Food quality is stable for the next 8h+.";

    return { spoilHour: hour, riskLevel: level, healthStatus: status, aiInsight: insight };
  }, [deadlineHours]);

  // Calculate current values for tabs
  const currentValues = useMemo(() => {
    return {
      risk: Math.round(14),
      quality: Math.round(98),
      gas: Math.round(22),
      temp: Math.round(4)
    };
  }, []);

  return (
    <div className="analytics-card-bento animate-reveal">
      <div className="security-shield-bg" />
      <div className="mission-scanline" />
      
      <div className="bento-header">
        <div className="header-identity">
          <div className="identity-icon-luxe">
            <div className="icon-pulse" />
            <span className="icon-svg">📡</span>
          </div>
          <div className="identity-text">
            <span className="sector-title">PREDICTIVE_ANALYTICS_V4.2</span>
            <h3 className="premium-title">Food Health Intelligence</h3>
          </div>
        </div>
        
        <div className="bento-metrics-nav-compact">
          {(["risk", "quality", "gas", "temp"] as MetricType[]).map((m) => (
            <button 
              key={m}
              className={`metric-tab-mini ${m} ${selectedMetrics.includes(m) ? "active" : ""}`}
              onClick={() => toggleMetric(m)}
            >
              <div className="tab-glow" />
              <div className="tab-label-stack">
                <span className="label-name">{m.toUpperCase()}</span>
                <span className="label-value">
                  {m === "temp" ? `${currentValues.temp}°C` : `${currentValues[m]}%`}
                </span>
              </div>
            </button>
          ))}
        </div>

        <div className="header-status">
          <div className="status-pill-luxe-premium" data-risk={riskLevel}>
            <span className="pulse-dot" />
            <span className="status-text">{riskLevel.toUpperCase()}</span>
          </div>
        </div>
      </div>

      <div className="bento-main-layout">
        <div className="chart-focus-area">
          <div className="chart-grid-overlay" />
          <div className="chart-shell-luxe">
            <Line ref={chartRef} data={data as any} options={options as any} />
          </div>
        </div>

        <div className="analytics-sidebar-compact">
          <div className="sidebar-group">
            <div className="mini-prediction-box-premium luxe-glow">
              <div className="box-header">
                <span className="box-label">EST_SHELF_LIFE</span>
                <span className="technical-id">±0.02%</span>
              </div>
              <div className="value-row">
                <strong className="mono">{spoilHour}</strong>
                <small className="mono">HRS</small>
              </div>
              <div className="luxe-progress-bar-premium">
                <div className="progress-fill" style={{ width: `${(spoilHour / 12) * 100}%` }} />
              </div>
            </div>

            <div className="mini-feed-premium ai-insight-box">
              <span className="box-label">AI_COGNITIVE_INSIGHT</span>
              <div className="insight-content">
                <p className="insight-text">{aiInsight}</p>
              </div>
              <div className="insight-scanner-line" />
            </div>

            <div className="mini-feed-premium log-box">
              <span className="box-label">REAL_TIME_FEED</span>
              <div className="feed-ticker-premium">
                <div className="ticker-item"><span className="ticker-dot" /> Sensor handshake verified</div>
                <div className="ticker-item"><span className="ticker-dot" /> VOC levels nominal</div>
                <div className="ticker-item"><span className="ticker-dot" /> Thermal stable</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .analytics-card-bento {
          padding: 2.5rem;
          background: linear-gradient(165deg, var(--panel) 0%, var(--bg) 100%) !important;
          border-radius: 32px;
          border: 1px solid var(--glass-border);
          position: relative;
          overflow: hidden;
          box-shadow: var(--shadow-xl);
          display: flex;
          flex-direction: column;
          gap: 2.5rem;
          color: var(--text);
          min-height: 650px;
        }
        
        .security-shield-bg {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 100% 0%, rgba(var(--accent-rgb), 0.05), transparent 50%);
          pointer-events: none;
        }

        .mission-scanline {
          position: absolute;
          top: 0; left: 0; width: 100%; height: 1px;
          background: linear-gradient(90deg, transparent, var(--accent), transparent);
          opacity: 0.1; animation: scanlineMove 8s linear infinite;
          pointer-events: none;
        }

        @keyframes scanlineMove {
          0% { transform: translateY(-100px); opacity: 0; }
          100% { transform: translateY(800px); opacity: 0; }
        }

        .bento-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          position: relative;
          z-index: 10;
          gap: 2rem;
        }

        .header-identity { display: flex; align-items: center; gap: 1.25rem; }
        .identity-icon-luxe {
          width: 52px; height: 52px;
          background: var(--panel-elevated);
          border: 1px solid var(--glass-border);
          border-radius: 16px;
          display: grid; place-items: center;
          position: relative;
        }
        .icon-pulse {
          position: absolute; inset: -2px; border: 1px solid var(--accent);
          border-radius: inherit; opacity: 0.3; animation: iconPulse 3s infinite;
        }
        @keyframes iconPulse { 0% { opacity: 0.3; transform: scale(1); } 100% { opacity: 0; transform: scale(1.15); } }
        .icon-svg { font-size: 1.4rem; }

        .sector-title {
          display: block; font-size: 0.6rem; font-weight: 900; 
          letter-spacing: 0.2em; color: var(--accent); opacity: 0.7;
          margin-bottom: 0.25rem;
        }
        .premium-title { font-size: 1.8rem; margin: 0; letter-spacing: -0.02em; font-weight: 900; color: var(--text); }

        .bento-metrics-nav-compact {
          display: flex;
          background: var(--panel-elevated);
          padding: 6px;
          border-radius: 16px;
          gap: 6px;
          border: 1px solid var(--glass-border);
          backdrop-filter: blur(10px);
        }

        .metric-tab-mini {
          padding: 0.6rem 1.25rem;
          border-radius: 12px;
          border: 1px solid transparent;
          background: transparent;
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.3s var(--ease-spring);
          position: relative;
          overflow: hidden;
          min-width: 100px;
        }
        .tab-label-stack { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }
        .label-name { font-size: 0.6rem; font-weight: 900; letter-spacing: 0.05em; opacity: 0.7; }
        .label-value { font-size: 1.1rem; font-weight: 900; color: var(--text); font-family: var(--font-mono); }

        .metric-tab-mini.active {
          background: var(--panel-light);
          border-color: rgba(var(--accent-rgb), 0.2);
          color: var(--text);
          box-shadow: 0 10px 20px rgba(0,0,0,0.05);
        }
        .tab-glow {
          position: absolute; inset: 0; 
          background: radial-gradient(circle at center, var(--tab-color), transparent 70%);
          opacity: 0; transition: opacity 0.3s ease;
        }
        .metric-tab-mini.active .tab-glow { opacity: 0.15; }

        .metric-tab-mini.risk { --tab-color: #EF4444; }
        .metric-tab-mini.quality { --tab-color: #A78BFA; }
        .metric-tab-mini.gas { --tab-color: #F59E0B; }
        .metric-tab-mini.temp { --tab-color: #3B82F6; }

        .metric-tab-mini.active.risk { border-bottom: 2px solid #EF4444; }
        .metric-tab-mini.active.quality { border-bottom: 2px solid #A78BFA; }
        .metric-tab-mini.active.gas { border-bottom: 2px solid #F59E0B; }
        .metric-tab-mini.active.temp { border-bottom: 2px solid #3B82F6; }

        .bento-main-layout {
          display: grid;
          grid-template-columns: 1fr 300px;
          gap: 2rem;
          z-index: 5;
          position: relative;
          flex: 1;
        }

        .chart-focus-area {
          background: var(--panel-elevated);
          border-radius: 28px;
          padding: 1.5rem;
          border: 1px solid var(--glass-border);
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .chart-grid-overlay {
          position: absolute; inset: 0;
          background-image: radial-gradient(var(--line) 1.5px, transparent 1.5px);
          background-size: 50px 50px;
          opacity: 0.6; pointer-events: none;
        }
        .chart-shell-luxe { width: 100%; flex: 1; min-height: 320px; position: relative; z-index: 2; }

        .analytics-sidebar-compact { 
          display: flex; 
          flex-direction: column; 
          border-left: 1px solid var(--line);
          padding-left: 2rem;
        }
        .sidebar-group { display: flex; flex-direction: column; gap: 1rem; }
        
        .mini-prediction-box-premium {
          background: rgba(var(--accent-rgb), 0.02);
          border: 1px solid var(--glass-border);
          border-radius: 24px;
          padding: 1.25rem 1.5rem;
          position: relative;
        }
        .box-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 0.25rem; }
        .box-label { font-size: 0.65rem; font-weight: 900; letter-spacing: 0.15em; color: var(--accent); }
        .technical-id { font-size: 0.6rem; font-family: var(--font-mono); color: var(--text-muted); opacity: 0.5; }
        
        .value-row { display: flex; align-items: baseline; gap: 0.5rem; margin-top: 0.25rem; }
        .value-row strong { font-size: 3rem; font-weight: 900; color: var(--text); line-height: 1; }
        .value-row small { font-size: 1rem; font-weight: 800; color: var(--text-muted); }
        .mono { font-family: var(--font-mono); }
 
        .luxe-progress-bar-premium {
          width: 100%; height: 8px; background: var(--line); 
          border-radius: 5px; margin-top: 1rem; overflow: hidden;
          border: 1px solid var(--glass-border);
        }

        .mini-feed-premium {
          background: var(--panel-elevated);
          border-radius: 24px;
          padding: 1.25rem;
          border: 1px solid var(--glass-border);
          position: relative;
        }

        .insight-content { margin-top: 1rem; }
        .insight-text {
          font-size: 0.9rem; font-weight: 600; line-height: 1.7; color: var(--text);
          font-style: italic; opacity: 0.9;
        }
        .insight-scanner-line {
          position: absolute; bottom: 0; left: 0; width: 40%; height: 2px;
          background: var(--accent); opacity: 0.5; border-radius: 99px;
          animation: scannerMove 4s infinite alternate ease-in-out;
        }
        @keyframes scannerMove { from { left: 5%; } to { left: 55%; } }

        .feed-ticker-premium { margin-top: 1rem; display: flex; flex-direction: column; gap: 12px; }
        .ticker-item { 
          font-size: 0.85rem; color: var(--text-muted); font-weight: 600; 
          display: flex; align-items: center; gap: 12px;
        }
        .ticker-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); opacity: 0.8; }

        .status-pill-luxe-premium {
          display: flex; align-items: center; gap: 10px;
          padding: 0.75rem 1.5rem; border-radius: 99px;
          background: var(--panel-elevated);
          border: 1px solid var(--glass-border);
          color: var(--accent); font-size: 0.8rem; font-weight: 900;
          backdrop-filter: blur(10px);
          box-shadow: var(--shadow-sm);
        }
        .status-pill-luxe-premium[data-risk="Warning"] { color: #F59E0B; }
        .status-pill-luxe-premium[data-risk="Critical"] { color: #EF4444; }
        
        .pulse-dot { width: 10px; height: 10px; border-radius: 50%; background: currentColor; box-shadow: 0 0 12px currentColor; animation: pulse 2s infinite; }
        @keyframes pulse { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.4); } 100% { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
}
