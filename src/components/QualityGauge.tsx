import { useEffect, useState } from "react";

interface QualityGaugeProps {
  hoursRemaining: number;
  totalDuration?: number; // default to 24 hours for normalization
}

export function QualityGauge({ hoursRemaining, totalDuration = 24 }: QualityGaugeProps) {
  const [needleRotation, setNeedleRotation] = useState(-90);
  const normalizedValue = Math.max(0, Math.min(1, hoursRemaining / totalDuration));
  const qualityScore = Math.round(normalizedValue * 100);

  useEffect(() => {
    // Semicircle is 180 degrees. From -90 (Spoiled) to 90 (Fresh).
    const rotation = (normalizedValue * 180) - 90;
    setNeedleRotation(rotation);
  }, [normalizedValue]);

  // Smooth color interpolation: 0 (Red) -> 0.5 (Yellow) -> 1 (Green)
  const getInterpolatedColor = (val: number) => {
    const r = val < 0.5 ? 224 : Math.round(224 - (val - 0.5) * 2 * (224 - 52));
    const g = val < 0.5 ? Math.round(90 + val * 2 * (211 - 90)) : 211;
    const b = val < 0.5 ? Math.round(74 + val * 2 * (153 - 74)) : 153;
    return `rgb(${r}, ${g}, ${b})`;
  };

  const currentColor = getInterpolatedColor(normalizedValue);

  // Generate tick marks - from -180 to 0 to cover the top semicircle
  const ticks = Array.from({ length: 21 }).map((_, i) => {
    const angleDeg = (i * 9) - 180;
    const angleRad = (angleDeg * Math.PI) / 180;
    const isMajor = i % 5 === 0; // Ticks at 0, 45, 90, 135, 180 equivalent
    const r1 = 82;
    const r2 = isMajor ? 92 : 88;
    const x1 = 100 + Math.cos(angleRad) * r1;
    const y1 = 110 + Math.sin(angleRad) * r1;
    const x2 = 100 + Math.cos(angleRad) * r2;
    const y2 = 110 + Math.sin(angleRad) * r2;
    return (
      <line 
        key={i} 
        x1={x1} y1={y1} x2={x2} y2={y2} 
        stroke="currentColor" 
        strokeWidth={isMajor ? 1.5 : 1} 
        opacity={isMajor ? 0.4 : 0.15} 
      />
    );
  });

  return (
    <div className="quality-gauge-premium">
      <div className="gauge-visual-wrapper">
        <svg viewBox="0 0 200 140" className="quality-gauge-svg">
          <defs>
            <linearGradient id="gaugeGradientMain" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#E05A4A" />
              <stop offset="50%" stopColor="#E8931A" />
              <stop offset="100%" stopColor="#34D399" />
            </linearGradient>
            <filter id="gaugeGlowLuxe" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="needleTipGlow">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background Track with glass effect */}
          <path
            d="M 30 110 A 70 70 0 0 1 170 110"
            fill="none"
            stroke="var(--glass-border)"
            strokeWidth="14"
            strokeLinecap="round"
            opacity="0.1"
          />

          {/* Continuous Gradient Track */}
          <path
            d="M 30 110 A 70 70 0 0 1 170 110"
            fill="none"
            stroke="url(#gaugeGradientMain)"
            strokeWidth="12"
            strokeLinecap="round"
            opacity="0.1"
          />

          {/* Dynamic Progress Arc */}
          <path
            d={`M 30 110 A 70 70 0 0 1 ${100 + Math.cos(((needleRotation - 90) * Math.PI) / 180) * 70} ${110 + Math.sin(((needleRotation - 90) * Math.PI) / 180) * 70}`}
            fill="none"
            stroke={currentColor}
            strokeWidth="12"
            strokeLinecap="round"
            filter="url(#gaugeGlowLuxe)"
            className="gauge-progress-arc-luxe"
          />

          {/* Tick Marks */}
          <g className="gauge-ticks" style={{ color: "var(--text)" }}>
            {ticks}
          </g>

          {/* Needle System */}
          <g transform="translate(100, 110)">
            <g className="needle-group" style={{ 
              transform: `rotate(${needleRotation}deg)`,
              transition: "transform 2.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
            }}>
              <line
                x1="0" y1="0" x2="0" y2="-70"
                stroke={currentColor}
                strokeWidth="2.5"
                strokeLinecap="round"
                opacity="0.5"
                filter="url(#needleTipGlow)"
              />
              <path
                d="M -1.5 0 L 0 -72 L 1.5 0 Z"
                fill="var(--text)"
              />
              <circle cx="0" cy="-70" r="4.5" fill={currentColor} filter="url(#needleTipGlow)" />
              <circle cx="0" cy="-70" r="2" fill="white" opacity="0.9" />
            </g>
            
            {/* Elegant Hub */}
            <circle cx="0" cy="0" r="34" fill="var(--panel-elevated)" stroke="var(--glass-border)" strokeWidth="1" />
            <circle cx="0" cy="0" r="28" fill="var(--bg)" opacity="0.4" />
            <circle cx="0" cy="0" r="12" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          </g>

          {/* Correctly Positioned Labels */}
          <text x="20" y="132" className="gauge-label-luxe" textAnchor="middle" style={{ fill: "var(--danger)" }}>SPOILED</text>
          <text x="100" y="32" className="gauge-label-luxe" textAnchor="middle" style={{ fill: "var(--text)" }}>OPTIMAL</text>
          <text x="180" y="132" className="gauge-label-luxe" textAnchor="middle" style={{ fill: "var(--accent)" }}>FRESH</text>
        </svg>

        <div className="gauge-score-overlay-luxe">
          <span className="score-value-premium" style={{ color: currentColor }}>{qualityScore}</span>
          <span className="score-label-premium">QUALITY INDEX</span>
        </div>
      </div>

      <style>{`
        .quality-gauge-premium {
          width: 100%;
          max-width: 360px;
          margin: 0 auto;
          position: relative;
        }
        .gauge-visual-wrapper {
          position: relative;
          width: 100%;
          filter: drop-shadow(0 20px 40px rgba(0,0,0,0.25));
        }
        .quality-gauge-svg {
          width: 100%;
          height: auto;
          overflow: visible;
        }
        .gauge-label-luxe {
          font-size: 7px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          font-family: 'Outfit', sans-serif;
        }
        .gauge-score-overlay-luxe {
          position: absolute;
          bottom: 25px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          pointer-events: none;
        }
        .score-value-premium {
          font-size: 3rem;
          font-weight: 900;
          line-height: 1;
          font-family: 'Outfit', sans-serif;
          letter-spacing: -0.05em;
          transition: color 1s ease;
          text-shadow: 0 4px 15px rgba(0,0,0,0.15);
        }
        .score-label-premium {
          font-size: 0.5rem;
          font-weight: 800;
          color: var(--text-muted);
          letter-spacing: 0.35em;
          margin-top: 6px;
          opacity: 0.95;
          white-space: nowrap;
        }
        .gauge-progress-arc-luxe {
          transition: stroke 1s ease, d 2.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .gauge-ticks {
          transition: opacity 0.5s ease;
        }
      `}</style>
    </div>
  );
}




