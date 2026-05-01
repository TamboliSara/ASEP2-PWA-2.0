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
      <div className="sensor-matrix-bg">
        {Array.from({ length: 96 }).map((_, i) => (
          <div key={i} className="matrix-dot" style={{ animationDelay: `${Math.random() * 5}s` }} />
        ))}
      </div>
      
      <div className="bento-header">
        <div className="header-identity">
          <div className="identity-icon-luxe">
            <div className="icon-pulse" />
            <span className="icon-svg">📡</span>
          </div>
          <div className="identity-text">
            <p className="eyebrow">Predictive Analytics v4.2</p>
            <h3>Food Health Intelligence</h3>
          </div>
        </div>
        
        <div className="bento-metrics-nav-compact">
          {(["risk", "quality", "gas", "temp"] as MetricType[]).map((m) => (
            <button 
              key={m}
              className={`metric-tab-mini ${m} ${selectedMetrics.includes(m) ? "active" : ""}`}
              onClick={() => toggleMetric(m)}
              title={m.charAt(0).toUpperCase() + m.slice(1)}
            >
              <span className="tab-indicator" />
              <div className="tab-label-stack">
                <span className="label-name">{m === "risk" ? "Risk" : m === "quality" ? "Quality" : m === "gas" ? "Gas" : "Temp"}</span>
                <span className="label-value">
                  {m === "temp" ? `${currentValues.temp}°C` : `${currentValues[m]}%`}
                </span>
              </div>
            </button>
          ))}
        </div>

        <div className="header-status">
          <div className="status-pill-luxe" data-risk={riskLevel}>
            <span className="pulse-dot" />
            {riskLevel}
          </div>
        </div>
      </div>

      <div className="bento-main-layout">
        <div className="chart-focus-area">
          <div className="chart-shell-luxe">
            <Line ref={chartRef} data={data as any} options={options as any} />
          </div>
        </div>

        <div className="analytics-sidebar-compact">
          <div className="mini-prediction-box luxe-glow">
            <span className="box-label">EST. SHELF LIFE</span>
            <div className="value-row">
              <strong>{spoilHour}</strong>
              <small>HRS</small>
            </div>
            <div className="luxe-progress-bar">
              <div className="progress-fill" style={{ width: `${(spoilHour / 12) * 100}%` }} />
            </div>
          </div>

          <div className="mini-feed ai-insight-box">
            <span className="box-label">AI INSIGHT</span>
            <p className="insight-text">{aiInsight}</p>
            <div className="insight-sparkle" />
          </div>

          <div className="mini-feed log-box">
            <span className="box-label">LIVE FEED</span>
            <div className="feed-ticker">
              <div className="ticker-item">● Sensor handshake verified</div>
              <div className="ticker-item">● VOC levels nominal</div>
              <div className="ticker-item">● Thermal stable</div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .analytics-card-bento {
          padding: 1.5rem 2rem;
          background: var(--panel-elevated);
          border-radius: 40px;
          border: 1px solid var(--glass-border);
          position: relative;
          overflow: hidden;
          box-shadow: 0 40px 100px rgba(0, 0, 0, 0.4);
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          max-width: 100%;
          box-sizing: border-box;
          color: var(--text);
        }
        
        .sensor-matrix-bg {
          position: absolute;
          inset: 0;
          display: grid;
          grid-template-columns: repeat(12, 1fr);
          grid-template-rows: repeat(8, 1fr);
          opacity: 0.05;
          pointer-events: none;
        }
        .matrix-dot {
          width: 2px; height: 2px; background: var(--accent); border-radius: 50%;
          justify-self: center; align-self: center;
          animation: matrixPulse 5s infinite;
        }
        @keyframes matrixPulse { 0%, 100% { opacity: 0.2; } 50% { opacity: 1; } }

        .bento-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          position: relative;
          z-index: 2;
          gap: 2rem;
        }
        .header-identity { display: flex; align-items: center; gap: 1rem; }
        .identity-icon-luxe {
          width: 44px; height: 44px;
          background: rgba(var(--accent-rgb), 0.08);
          border-radius: 12px;
          display: grid; place-items: center;
          position: relative;
        }
        .icon-pulse {
          position: absolute; inset: -4px; border: 2px solid var(--accent);
          border-radius: inherit; opacity: 0.2; animation: iconPulse 3s infinite;
        }
        @keyframes iconPulse { 0% { opacity: 0.2; transform: scale(1); } 100% { opacity: 0; transform: scale(1.2); } }
        .identity-text h3 { font-size: 1.3rem; margin: 0; letter-spacing: -0.02em; color: var(--text); font-weight: 900; }
        .eyebrow { font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--accent); opacity: 0.8; margin-bottom: 2px; font-weight: 800; }

        .bento-metrics-nav-compact {
          display: flex;
          background: rgba(0, 0, 0, 0.1);
          padding: 3px;
          border-radius: 10px;
          gap: 3px;
          border: 1px solid var(--glass-border);
        }
        [data-theme-mode="light"] .bento-metrics-nav-compact { background: rgba(0, 0, 0, 0.05); }

        .metric-tab-mini {
          padding: 0.4rem 0.8rem;
          border-radius: 7px;
          border: none;
          background: transparent;
          color: var(--text-muted);
          font-size: 0.7rem;
          font-weight: 800;
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .tab-indicator { width: 6px; height: 6px; border-radius: 50%; border: 1.5px solid currentColor; margin-top: 2px; }
        .tab-label-stack { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; }
        .label-name { font-size: 0.7rem; font-weight: 800; }
        .label-value { font-size: 0.55rem; font-weight: 900; opacity: 0.6; font-family: 'Outfit', sans-serif; }
        .metric-tab-mini.active { background: rgba(255, 255, 255, 0.08); color: var(--text); }
        [data-theme-mode="light"] .metric-tab-mini.active { background: rgba(0, 0, 0, 0.05); }

        .metric-tab-mini.active.risk { color: #EF4444; }
        .metric-tab-mini.active.quality { color: #A78BFA; }
        .metric-tab-mini.active.gas { color: #F59E0B; }
        .metric-tab-mini.active.temp { color: #3B82F6; }
        .metric-tab-mini.active .tab-indicator { background: currentColor; }

        .bento-main-layout {
          display: grid;
          grid-template-columns: 1fr 200px;
          gap: 1.25rem;
        }
        @media (max-width: 1100px) { .bento-main-layout { grid-template-columns: 1fr; } }

        .chart-focus-area {
          background: rgba(0, 0, 0, 0.05);
          border-radius: 24px;
          padding: 1.25rem;
          border: 1px solid var(--glass-border);
          min-height: 350px;
        }
        [data-theme-mode="light"] .chart-focus-area { background: rgba(0, 0, 0, 0.02); }
        .chart-shell-luxe { width: 100%; height: 100%; min-height: 320px; }

        .analytics-sidebar-compact {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .mini-prediction-box {
          background: rgba(var(--accent-rgb), 0.03);
          border: 1px solid var(--glass-border);
          border-radius: 18px;
          padding: 1.25rem 1rem;
          text-align: center;
          position: relative;
        }
        .luxe-progress-bar {
          width: 100%; height: 4px; background: rgba(0,0,0,0.1); 
          border-radius: 2px; margin-top: 1rem; overflow: hidden;
        }
        .progress-fill { height: 100%; background: var(--accent); border-radius: inherit; transition: width 1s ease; }
        .luxe-glow::after {
          content: ""; position: absolute; inset: 0; 
          background: radial-gradient(circle at top right, rgba(var(--accent-rgb), 0.1), transparent);
          pointer-events: none;
        }

        .ai-insight-box {
          background: linear-gradient(135deg, rgba(var(--accent-rgb), 0.08) 0%, rgba(0,0,0,0.1) 100%);
          border-color: rgba(var(--accent-rgb), 0.2);
          position: relative;
          overflow: hidden;
        }
        .insight-text {
          font-size: 0.7rem; font-weight: 600; line-height: 1.4; margin-top: 0.75rem; color: var(--text);
          font-style: italic;
        }
        .insight-sparkle {
          position: absolute; top: -10px; right: -10px; width: 40px; height: 40px;
          background: radial-gradient(circle, var(--accent) 0%, transparent 70%);
          opacity: 0.2; filter: blur(5px);
        }

        .mini-feed {
          background: rgba(0, 0, 0, 0.05);
          border-radius: 18px;
          padding: 1.25rem 1rem;
          border: 1px solid var(--glass-border);
          flex: 1;
        }
        [data-theme-mode="light"] .mini-feed { background: rgba(0, 0, 0, 0.02); }
        .box-label { font-size: 0.55rem; font-weight: 900; letter-spacing: 0.1em; color: var(--text-muted); text-transform: uppercase; }
        .feed-ticker { margin-top: 0.5rem; display: flex; flex-direction: column; gap: 6px; }
        .ticker-item { font-size: 0.7rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500; }

        .status-pill-luxe {
          display: flex; align-items: center; gap: 6px;
          padding: 0.4rem 0.8rem; border-radius: 99px;
          background: rgba(var(--accent-rgb), 0.1);
          color: var(--accent); font-size: 0.65rem; font-weight: 900; text-transform: uppercase;
        }
        .status-pill-luxe[data-risk="Safe"] { color: var(--accent); }
        .status-pill-luxe[data-risk="Warning"] { color: #F59E0B; background: rgba(245, 158, 11, 0.1); }
        .status-pill-luxe[data-risk="Critical"] { color: #EF4444; background: rgba(239, 68, 68, 0.1); }
        .pulse-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; box-shadow: 0 0 8px currentColor; animation: pulse 2s infinite; }
        @keyframes pulse { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.2); } 100% { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
}
