import React, { useState, useCallback, useEffect } from 'react';
import LockerModel from '../components/3d/LockerModel';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useAppContext } from '../store/AppContext';
import type { ThemeMode } from '../types/domain';

const PHASE_TITLES = [
  'SAFE — Smart Automated Food Exchange',
  'Phase 1 — Main Doors Opening',
  'Phase 2 — 8 Internal SAFEs Revealed',
  'Phase 3 — Autonomous Solenoid Access',
  'Phase 4 — BME688 AI Sensor Architecture',
];

const PHASE_DESCRIPTIONS = [
  'Scroll or drag to explore the complete patent-pending smart food locker architecture',
  'Dual tempered-glass doors swing open to reveal internal autonomous compartments',
  'Each SAFE operates as an independent secure unit with individual environmental tracking',
  '12V solenoid locks engage via ESP32-S3 and I²C multiplexer for contactless retrieval',
  'Integrated Bosch BME688 sensor monitors TVOC, temperature, humidity & food freshness',
];

const PHASE_SCROLL_PERCENTAGES = [0, 0.18, 0.42, 0.68, 0.95];

export const VisualizerPage: React.FC = () => {
  const { scrollYProgress } = useScroll();
  const fadeOut = useTransform(scrollYProgress, [0, 0.05], [1, 0]);

  const { state: appState, dispatch } = useAppContext();
  const [progress, setProgress] = useState(0);
  const [currentPhase, setCurrentPhase] = useState(0);
  const [mousePos, setMousePos] = useState({ x: -100, y: -100 });

  const handleProgress = useCallback((p: number) => setProgress(Math.round(p * 100)), []);
  const handlePhase = useCallback((p: number) => setCurrentPhase(p), []);

  // Ensure full viewport coverage and dark theme by default on visualizer
  useEffect(() => {
    document.documentElement.classList.add('visualizer-mode');
    const prevZoom = document.documentElement.style.zoom;
    document.documentElement.style.zoom = '1';
    window.dispatchEvent(new Event('resize'));

    // Capture main system theme before setting visualizer default
    const storedSystemTheme = (localStorage.getItem('safe_main_system_theme') as ThemeMode) || (appState.themeMode === 'light' ? 'light' : 'dark');
    if (!localStorage.getItem('safe_main_system_theme')) {
      localStorage.setItem('safe_main_system_theme', storedSystemTheme);
    }

    // Always ensure visualizer opens in dark theme by default (no matter what is the theme in main system)
    if (appState.themeMode !== 'dark') {
      dispatch({ type: 'set-theme-mode', themeMode: 'dark' });
    }

    return () => {
      document.documentElement.classList.remove('visualizer-mode');
      document.documentElement.style.zoom = prevZoom || '';
      window.dispatchEvent(new Event('resize'));

      // Restore main system's original theme when navigating away from visualizer
      const themeToRestore = (localStorage.getItem('safe_main_system_theme') as ThemeMode) || storedSystemTheme || 'light';
      dispatch({ type: 'set-theme-mode', themeMode: themeToRestore });
    };
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const scrollToPhase = (targetPhase: number) => {
    const targetProgress = PHASE_SCROLL_PERCENTAGES[targetPhase];
    const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({
      top: targetProgress * totalHeight,
      behavior: 'smooth'
    });
  };

  return (
    <div style={{ width: '100%', minHeight: '100vh', position: 'relative' }}>
      <LockerModel onProgressChange={handleProgress} onPhaseChange={handlePhase} />

      {/* ── Scroll prompt ── */}
      <motion.div style={{
        position: 'fixed', bottom: 36, left: '50%', transform: 'translateX(-50%)',
        color: 'rgba(255,255,255,0.6)', fontFamily: "'Inter', sans-serif",
        fontSize: 11, letterSpacing: 3, zIndex: 40, pointerEvents: 'none',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        opacity: fadeOut, textTransform: 'uppercase',
      }}>
        <span>Scroll or Drag to Explore</span>
        <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}>
          <svg width="16" height="24" viewBox="0 0 16 24" fill="none">
            <rect x="5.5" y="0" width="5" height="14" rx="2.5" stroke="rgba(0,243,255,0.4)" strokeWidth="1.2" />
            <circle cx="8" cy="5" r="1.5" fill="#00f3ff">
              <animate attributeName="cy" values="5;9;5" dur="1.8s" repeatCount="indefinite" />
            </circle>
            <path d="M4 17 L8 21 L12 17" stroke="rgba(0,243,255,0.5)" strokeWidth="1.2" fill="none" />
          </svg>
        </motion.div>
      </motion.div>

      {/* ── Phase title HUD Card (top-left) ── */}
      <div style={{
        position: 'fixed', top: 110, left: 28, zIndex: 45, pointerEvents: 'auto',
        fontFamily: "'Inter', sans-serif", maxWidth: 380,
        background: 'rgba(6, 12, 18, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(0, 243, 255, 0.25)',
        borderRadius: 14,
        padding: '16px 20px',
        boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6)',
      }}>
        <motion.div
          key={currentPhase}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{
              fontSize: 10, letterSpacing: 2.5, color: '#00f3ff', textTransform: 'uppercase',
              fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00f3ff', boxShadow: '0 0 8px #00f3ff' }} />
              {currentPhase === 0 ? 'OVERVIEW' : `PHASE ${currentPhase} OF 4`}
            </div>

            {/* Quick Phase Jump Pills */}
            <div style={{ display: 'flex', gap: 4 }}>
              {[0, 1, 2, 3, 4].map(idx => (
                <button
                  key={idx}
                  onClick={() => scrollToPhase(idx)}
                  style={{
                    background: currentPhase === idx ? '#00f3ff' : 'rgba(255,255,255,0.1)',
                    color: currentPhase === idx ? '#000' : 'rgba(255,255,255,0.6)',
                    border: 'none',
                    borderRadius: 4,
                    width: 20,
                    height: 20,
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                  }}
                  title={`Jump to Phase ${idx}`}
                >
                  {idx}
                </button>
              ))}
            </div>
          </div>

          <div style={{
            fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.95)',
            letterSpacing: 0.5, lineHeight: 1.4, marginBottom: 8,
          }}>
            {PHASE_TITLES[currentPhase]}
          </div>
          <div style={{
            fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6,
          }}>
            {PHASE_DESCRIPTIONS[currentPhase]}
          </div>
        </motion.div>
      </div>

      {/* ── Right-side progress rail with interactive click jump ── */}
      <div style={{
        position: 'fixed', right: 28, top: '50%', transform: 'translateY(-50%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        zIndex: 45, pointerEvents: 'auto',
        background: 'rgba(6, 12, 18, 0.65)',
        backdropFilter: 'blur(16px)',
        padding: '12px 8px',
        borderRadius: 20,
        border: '1px solid rgba(0, 243, 255, 0.2)',
      }}>
        {[0, 1, 2, 3, 4].map(i => (
          <button
            key={i}
            onClick={() => scrollToPhase(i)}
            style={{
              width: 8, 
              height: i === currentPhase ? 28 : 8, 
              borderRadius: 4,
              background: i === currentPhase ? '#00f3ff' : i < currentPhase ? 'rgba(0,243,255,0.45)' : 'rgba(255,255,255,0.15)',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
              boxShadow: i === currentPhase ? '0 0 10px rgba(0,243,255,0.6)' : 'none',
            }}
            title={`Phase ${i}: ${PHASE_TITLES[i]}`}
          />
        ))}
      </div>

      {/* ── Bottom-right telemetry HUD card ── */}
      <div style={{
        position: 'fixed', bottom: 28, right: 28, zIndex: 45, pointerEvents: 'none',
        fontFamily: "'JetBrains Mono', 'Consolas', monospace",
        fontSize: 10, color: 'rgba(255,255,255,0.45)', textAlign: 'right',
        letterSpacing: 1, lineHeight: 1.8,
        background: 'rgba(6, 12, 18, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(0, 243, 255, 0.25)',
        borderRadius: 12,
        padding: '12px 18px',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, color: '#10b981', fontWeight: 600 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 8px #10b981' }} />
          <span>SYS: ONLINE</span>
        </div>
        <div>ENGINE: THREE.JS / WEBGL 2.0</div>
        <div style={{ color: '#00f3ff', fontWeight: 700 }}>DISASSEMBLY: {progress}%</div>
      </div>

      {/* ── Left scan bars ── */}
      <div style={{
        position: 'fixed', top: '50%', left: 20, transform: 'translateY(-50%)',
        display: 'flex', flexDirection: 'column', gap: 14,
        zIndex: 40, pointerEvents: 'none',
      }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 2, height: 32, background: 'rgba(255,255,255,0.06)',
            borderRadius: 1, position: 'relative', overflow: 'hidden',
          }}>
            <motion.div
              animate={{ y: ['-100%', '100%'] }}
              transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.4, ease: 'linear' }}
              style={{
                width: '100%', height: '50%', position: 'absolute',
                background: 'linear-gradient(to bottom, transparent, #00f3ff, transparent)',
              }}
            />
          </div>
        ))}
      </div>

      {/* ── Spline 3D Cloud CAD Links ── */}
      <div style={{
        position: 'fixed', bottom: 28, left: 28, zIndex: 45,
        display: 'flex', gap: 10, alignItems: 'center',
      }}>
        <a
          href="https://app.spline.design/file/142d9f0c-1287-4696-9b02-ae598b5f2d1d"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            background: 'rgba(6, 12, 18, 0.85)',
            border: '1px solid rgba(0, 243, 255, 0.35)',
            borderRadius: 10,
            padding: '8px 14px',
            color: '#00f3ff',
            fontSize: 12,
            fontWeight: 600,
            textDecoration: 'none',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.2s ease',
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
          }}
          onMouseEnter={(e) => { 
            e.currentTarget.style.borderColor = '#00f3ff'; 
            e.currentTarget.style.boxShadow = '0 0 16px rgba(0,243,255,0.5)'; 
          }}
          onMouseLeave={(e) => { 
            e.currentTarget.style.borderColor = 'rgba(0, 243, 255, 0.35)'; 
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.4)'; 
          }}
        >
          <span>🧊</span>
          <span>Spline 3D Fridge</span>
        </a>
        <a
          href="https://app.spline.design/file/e1997a5b-dccc-4942-9d66-b7ba6503e9d9"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            background: 'rgba(6, 12, 18, 0.85)',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            borderRadius: 10,
            padding: '8px 14px',
            color: 'rgba(255, 255, 255, 0.85)',
            fontSize: 12,
            fontWeight: 600,
            textDecoration: 'none',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.2s ease',
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
          }}
          onMouseEnter={(e) => { 
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.7)'; 
            e.currentTarget.style.color = '#fff'; 
          }}
          onMouseLeave={(e) => { 
            e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.3)'; 
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.85)'; 
          }}
        >
          <span>📦</span>
          <span>Sample Chamber</span>
        </a>
      </div>

      {/* ── High-Tech Cyber Cursor Reticle ── */}
      <div
        style={{
          position: 'fixed',
          top: mousePos.y - 12,
          left: mousePos.x - 12,
          width: 24,
          height: 24,
          zIndex: 90,
          pointerEvents: 'none',
          display: mousePos.x > 0 ? 'flex' : 'none',
          justifyContent: 'center',
          alignItems: 'center',
          opacity: 0.75,
        }}
      >
        <div style={{ position: 'absolute', width: 4, height: 4, background: '#00f3ff', borderRadius: '50%', boxShadow: '0 0 6px #00f3ff' }} />
        <div style={{ position: 'absolute', width: 20, height: 20, border: '1px dashed rgba(0,243,255,0.4)', borderRadius: '50%' }} />
      </div>
    </div>
  );
};
