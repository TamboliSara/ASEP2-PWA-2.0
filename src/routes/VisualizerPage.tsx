import React, { useState, useCallback, useEffect } from 'react';
import LockerModel from '../components/3d/LockerModel';
import { motion, useScroll, useTransform } from 'framer-motion';

const PHASE_TITLES = [
  'SAFE — Smart Automated Food Exchange',
  'Phase 1 — Main Doors Opening',
  'Phase 2 — 8 Internal SAFEs Revealed',
  'Phase 3 — SAFE Compartment Doors Opening',
  'Phase 4 — BME688 Sensor Close-Up',
];

const PHASE_DESCRIPTIONS = [
  'Scroll down to explore the internal architecture',
  'Fridge main doors swing open to reveal internal compartments',
  'Each SAFE is an independent secure food storage unit',
  'Individual doors with solenoid locks provide autonomous access',
  'BME688 gas/temperature/humidity sensor monitors food freshness',
];

export const VisualizerPage: React.FC = () => {
  const { scrollYProgress } = useScroll();
  const fadeOut = useTransform(scrollYProgress, [0, 0.04], [1, 0]);

  const [progress, setProgress] = useState(0);
  const [currentPhase, setCurrentPhase] = useState(0);
  const [mousePos, setMousePos] = useState({ x: -100, y: -100 });
  const handleProgress = useCallback((p: number) => setProgress(Math.round(p * 100)), []);
  const handlePhase = useCallback((p: number) => setCurrentPhase(p), []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div style={{ width: '100%', position: 'relative', cursor: 'none' }}>
      <LockerModel onProgressChange={handleProgress} onPhaseChange={handlePhase} />

      {/* ── Scroll prompt ── */}
      <motion.div style={{
        position: 'fixed', bottom: 36, left: '50%', transform: 'translateX(-50%)',
        color: 'rgba(255,255,255,0.5)', fontFamily: "'Inter', sans-serif",
        fontSize: 11, letterSpacing: 3, zIndex: 50, pointerEvents: 'none',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        opacity: fadeOut, textTransform: 'uppercase',
      }}>
        <span>Scroll to Explore</span>
        <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}>
          <svg width="16" height="24" viewBox="0 0 16 24" fill="none">
            <rect x="5.5" y="0" width="5" height="14" rx="2.5" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
            <circle cx="8" cy="5" r="1.5" fill="rgba(0,243,255,0.6)">
              <animate attributeName="cy" values="5;9;5" dur="1.8s" repeatCount="indefinite" />
            </circle>
            <path d="M4 17 L8 21 L12 17" stroke="rgba(255,255,255,0.3)" strokeWidth="1" fill="none" />
          </svg>
        </motion.div>
      </motion.div>

      {/* ── Phase title (top-left) ── */}
      <div style={{
        position: 'fixed', top: 100, left: 32, zIndex: 50, pointerEvents: 'none',
        fontFamily: "'Inter', sans-serif", maxWidth: 340,
      }}>
        <motion.div
          key={currentPhase}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div style={{
            fontSize: 11, letterSpacing: 3, color: '#00f3ff', textTransform: 'uppercase',
            fontWeight: 600, marginBottom: 6,
          }}>
            {currentPhase === 0 ? 'OVERVIEW' : `PHASE ${currentPhase} / 4`}
          </div>
          <div style={{
            fontSize: 16, fontWeight: 300, color: 'rgba(255,255,255,0.85)',
            letterSpacing: 1, lineHeight: 1.5, marginBottom: 8,
          }}>
            {PHASE_TITLES[currentPhase]}
          </div>
          <div style={{
            fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6,
          }}>
            {PHASE_DESCRIPTIONS[currentPhase]}
          </div>
        </motion.div>
      </div>

      {/* ── Right-side progress rail ── */}
      <div style={{
        position: 'fixed', right: 28, top: '50%', transform: 'translateY(-50%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        zIndex: 50, pointerEvents: 'none',
      }}>
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} style={{
            width: 6, height: i === currentPhase ? 24 : 6, borderRadius: 3,
            background: i === currentPhase ? '#00f3ff' : i < currentPhase ? 'rgba(0,243,255,0.4)' : 'rgba(255,255,255,0.1)',
            transition: 'all 0.4s ease',
          }} />
        ))}
      </div>

      {/* ── Bottom-right telemetry ── */}
      <div style={{
        position: 'fixed', bottom: 28, right: 28, zIndex: 50, pointerEvents: 'none',
        fontFamily: "'JetBrains Mono', 'Consolas', monospace",
        fontSize: 9, color: 'rgba(255,255,255,0.2)', textAlign: 'right',
        letterSpacing: 1, lineHeight: 2,
      }}>
        <div>SYS: ONLINE</div>
        <div>ENGINE: WEBGL 2.0</div>
        <div style={{ color: 'rgba(0,243,255,0.4)' }}>PROGRESS: {progress}%</div>
      </div>

      {/* ── Left scan bars ── */}
      <div style={{
        position: 'fixed', top: '50%', left: 20, transform: 'translateY(-50%)',
        display: 'flex', flexDirection: 'column', gap: 14,
        zIndex: 50, pointerEvents: 'none',
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
        position: 'fixed', bottom: 28, left: 28, zIndex: 60,
        display: 'flex', gap: 10, alignItems: 'center',
      }}>
        <a
          href="https://app.spline.design/file/142d9f0c-1287-4696-9b02-ae598b5f2d1d"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            background: 'rgba(15, 23, 42, 0.75)',
            border: '1px solid rgba(0, 243, 255, 0.3)',
            borderRadius: 8,
            padding: '6px 12px',
            color: '#00f3ff',
            fontSize: 11,
            fontWeight: 500,
            textDecoration: 'none',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'all 0.2s ease',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#00f3ff'; e.currentTarget.style.boxShadow = '0 0 12px rgba(0,243,255,0.4)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(0, 243, 255, 0.3)'; e.currentTarget.style.boxShadow = 'none'; }}
        >
          <span>🧊</span>
          <span>Spline 3D Fridge</span>
        </a>
        <a
          href="https://app.spline.design/file/e1997a5b-dccc-4942-9d66-b7ba6503e9d9"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            background: 'rgba(15, 23, 42, 0.75)',
            border: '1px solid rgba(148, 163, 184, 0.25)',
            borderRadius: 8,
            padding: '6px 12px',
            color: 'rgba(255, 255, 255, 0.8)',
            fontSize: 11,
            fontWeight: 500,
            textDecoration: 'none',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'all 0.2s ease',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.6)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.25)'; e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)'; }}
        >
          <span>📦</span>
          <span>Sample Chamber</span>
        </a>
      </div>


      {/* ── Interactive Custom Cursor / Crosshair ── */}
      <motion.div
        animate={{
          x: mousePos.x - 16,
          y: mousePos.y - 16,
        }}
        transition={{ type: 'spring', stiffness: 500, damping: 28, mass: 0.5 }}
        style={{
          position: 'fixed', top: 0, left: 0, width: 32, height: 32, zIndex: 100, pointerEvents: 'none',
          display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}
      >
        <div style={{ position: 'absolute', width: 4, height: 4, background: '#00f3ff', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', width: '100%', height: 1, background: 'rgba(0,243,255,0.3)', top: '50%' }} />
        <div style={{ position: 'absolute', width: 1, height: '100%', background: 'rgba(0,243,255,0.3)', left: '50%' }} />
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          style={{ position: 'absolute', width: 32, height: 32, border: '1px dashed rgba(0,243,255,0.2)', borderRadius: '50%' }} 
        />
      </motion.div>
    </div>
  );
};
