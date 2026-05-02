import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "../store/useTranslation";
import { useAppContext } from "../store/AppContext";
import type { DonationRecord } from "../types/domain";

const heroPalette = [
  ["#f4dfbf", "#e2b07f", "#1f694e"],
  ["#f2e2ca", "#b7d196", "#50815d"],
  ["#f1d4bb", "#c28057", "#6d3e2e"],
  ["#efe3ce", "#dbc1a1", "#0f5747"]
];

function pickPalette(seed: string) {
  const total = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return heroPalette[total % heroPalette.length];
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function visualType(name: string) {
  const normalized = name.toLowerCase();
  if (/(coffee|tea|latte|shake|juice|smoothie|milk|lassi)/.test(normalized)) return "cup";
  if (/(apple|orange|banana|fruit|produce|mango|guava|papaya|pear)/.test(normalized)) return "fruit";
  if (/(wrap|roll|bread|baked|croissant|bun|sandwich|burger)/.test(normalized)) return "bento";
  return "bowl";
}

function foodEmoji(name: string): string {
  const n = name.toLowerCase();
  if (/(rice|biryani|pulao)/.test(n)) return "🍚";
  if (/(bread|bun|sandwich|burger|wrap|roll|croissant)/.test(n)) return "🥪";
  if (/(pasta|noodle|spaghetti|mac)/.test(n)) return "🍝";
  if (/(dal|lentil|soup|curry|stew)/.test(n)) return "🍲";
  if (/(salad|green|veggie|vegetable)/.test(n)) return "🥗";
  if (/(fruit|apple|orange|banana|mango|guava)/.test(n)) return "🍱";
  if (/(coffee|tea|latte|chai)/.test(n)) return "☕";
  if (/(juice|shake|smoothie|milk|lassi)/.test(n)) return "🥤";
  if (/(paneer|cheese|dairy|yogurt|curd)/.test(n)) return "🧀";
  if (/(chicken|meat|fish|egg|non.?veg)/.test(n)) return "🍗";
  if (/(sweet|dessert|cake|halwa|kheer|pudding)/.test(n)) return "🍮";
  return "🍽️";
}

function DietIcon({ tag }: { tag?: string }) {
  if (!tag) return null;
  if (tag === "veg") return <span className="diet-dot is-veg" title="Vegetarian" />;
  if (tag === "non_veg") return <span className="diet-dot is-non-veg" title="Non-Vegetarian" />;
  if (tag === "vegan") return <span className="diet-dot is-vegan" title="Vegan" />;
  return null;
}

function getBadges(item: DonationRecord | undefined, t: (key: string) => string) {
  return [
    { label: item?.categoryLabel ?? t("ready"), icon: null },
    { label: item?.dietTag?.replace("_", " ") ?? t("communityReady"), icon: <DietIcon tag={item?.dietTag} /> },
    { label: item?.allergensNotes ? t("allergensNoted") : t("noAllergens"), icon: null }
  ];
}

export function FoodHeroV2({
  donation,
  items,
  onActiveItemChange,
  onPrevLocker,
  onNextLocker
}: {
  donation?: DonationRecord;
  items?: DonationRecord[];
  onActiveItemChange?: (item?: DonationRecord) => void;
  onPrevLocker?: () => void;
  onNextLocker?: () => void;
}) {
  const { t } = useTranslation();
  const { state } = useAppContext();
  const heroItems = useMemo(() => {
    const list = items?.length ? items : donation ? [donation] : [];
    return list.length ? list : undefined;
  }, [donation, items]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [heroItems?.[0]?.id]);

  const activeItem = heroItems?.[activeIndex] ?? donation;
  const previews = heroItems?.filter((_, index) => index !== activeIndex).slice(0, 2) ?? [];
  const palette = pickPalette(activeItem?.foodName ?? "SAFE");
  const heroShape = visualType(activeItem?.foodName ?? "SAFE");
  const badges = getBadges(activeItem, t);

  useEffect(() => {
    onActiveItemChange?.(activeItem);
  }, [activeItem, onActiveItemChange]);

  function cycle(direction: -1 | 1) {
    if (!heroItems?.length) return;
    setActiveIndex((current) => (current + direction + heroItems.length) % heroItems.length);
  }

  if (!activeItem) {
    return (
      <section className="food-hero-luxe is-empty">
        <div className="empty-state-content">
          <div className="empty-locker-illustration-premium">
            <div className="illustration-glow" />
            <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="lockerGrad" x1="40" y1="40" x2="160" y2="180" gradientUnits="userSpaceOnUse">
                  <stop stopColor="var(--accent)" stopOpacity="0.2" />
                  <stop offset="1" stopColor="var(--accent)" stopOpacity="0.05" />
                </linearGradient>
              </defs>
              <rect x="40" y="40" width="120" height="140" rx="24" fill="url(#lockerGrad)" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="6 4" />
              <path d="M160 60L185 50V170L160 180" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="100" cy="110" r="32" fill="rgba(255,255,255,0.03)" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="4 4" />
              <path d="M90 110H110M100 100V120" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
          <div className="empty-copy-stack">
            <h3>{t("lockerReadyHeadline") || "Locker is Ready"}</h3>
            <p>{t("lockerReadyBody") || "Cleared for collection"}</p>
          </div>
          <button className="premium-action-button" type="button" onClick={() => window.location.href = "/donate"}>
            <span className="btn-label">{t("donateNow") || "Start Donation"}</span>
            <span className="btn-icon">→</span>
          </button>

          {/* Safe Navigation Controller */}
          <div className="safe-navigation-controller is-empty-state">
            <button type="button" className="safe-nav-trigger is-prev" onClick={onPrevLocker} aria-label="Previous safe">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            
            <div className="safe-index-display">
              <div className="index-glow" />
              <span className="index-label">SAFE</span>
              <strong className="index-current">
                {((state.lockers.findIndex(l => l.lockerId === state.selectedLockerId) + 1) || 1).toString().padStart(2, '0')}
              </strong>
              <span className="index-total">/ {state.lockers.length.toString().padStart(2, '0')}</span>
            </div>

            <button type="button" className="safe-nav-trigger is-next" onClick={onNextLocker} aria-label="Next safe">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
          </div>
        </div>
        <style>{`
          .food-hero-luxe.is-empty {
            display: grid;
            place-items: center;
            text-align: center;
            background: radial-gradient(circle at center, rgba(82, 196, 106, 0.08), transparent 70%);
            min-height: 420px;
          }
          .empty-state-content {
            display: grid;
            gap: 1.25rem;
            max-width: 360px;
            padding: 2.5rem 2rem;
            animation: fadeIn 0.8s ease-out;
          }
          .empty-locker-illustration-premium {
            position: relative;
            width: 160px;
            height: 160px;
            margin: 0 auto;
            animation: floatLuxe 6s ease-in-out infinite;
          }
          .illustration-glow {
            position: absolute;
            inset: 20%;
            background: var(--accent);
            filter: blur(60px);
            opacity: 0.15;
            border-radius: 50%;
          }
          @keyframes floatLuxe {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            50% { transform: translateY(-15px) rotate(1deg); }
          }
          .empty-copy-stack h3 {
            font-size: 2.5rem;
            font-weight: 900;
            letter-spacing: -0.04em;
            margin: 0 0 0.5rem;
            background: linear-gradient(135deg, var(--text) 20%, var(--accent));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }
          .empty-copy-stack p {
            font-size: 1.15rem;
            color: var(--text-muted);
            opacity: 0.7;
          }
          .premium-action-button {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 1rem;
            padding: 1.25rem 2.5rem;
            background: var(--accent);
            color: #08120d;
            border: none;
            border-radius: 99px;
            font-size: 1.1rem;
            font-weight: 800;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.2, 1, 0.3, 1);
            box-shadow: 0 10px 30px rgba(82, 196, 106, 0.3);
          }
          .premium-action-button:hover {
            transform: translateY(-4px) scale(1.02);
            box-shadow: 0 15px 40px rgba(82, 196, 106, 0.4);
            filter: brightness(1.1);
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
          }
          .diet-dot {
            display: inline-block;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            border: 1px solid currentColor;
            margin-right: 8px;
            position: relative;
          }
          .diet-dot::after {
            content: '';
            position: absolute;
            inset: 2px;
            border-radius: 50%;
            background: currentColor;
          }
          .diet-dot.is-veg { color: #52c41a; }
          .diet-dot.is-non-veg { color: #ff4d4f; }
          .diet-dot.is-vegan { 
            color: #73d13d; 
            border-radius: 0 50% 0 50%;
            transform: rotate(-45deg);
          }
          .diet-dot.is-vegan::after { display: none; }
          .safe-navigation-controller {
            display: flex !important;
            flex-direction: row !important;
            align-items: center;
            justify-content: center;
            gap: 1.25rem;
            padding: 0.6rem 1.25rem;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--glass-border);
            border-radius: 99px;
            backdrop-filter: blur(20px);
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            z-index: 100;
            margin: 2rem auto;
            min-width: 240px;
          }
          .safe-navigation-controller.is-empty-state {
            margin: 2rem auto 0;
          }
          .safe-nav-trigger {
            width: 44px;
            height: 44px;
            flex-shrink: 0;
            border-radius: 50%;
            border: 1px solid var(--glass-border);
            background: rgba(255, 255, 255, 0.1);
            color: var(--text);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.4s cubic-bezier(0.2, 1, 0.3, 1);
          }
          .safe-nav-trigger svg { 
            width: 20px; 
            height: 20px; 
            display: block;
            stroke: var(--accent);
            stroke-width: 3.5;
          }
          .safe-nav-trigger:hover {
            background: var(--accent);
            color: #000;
            transform: scale(1.1);
            box-shadow: 0 0 20px rgba(var(--accent-rgb), 0.3);
            border-color: var(--accent);
          }
          .safe-index-display {
            display: flex;
            align-items: baseline;
            gap: 0.5rem;
            padding: 0 1.5rem;
            position: relative;
          }
          .index-glow {
            position: absolute;
            inset: -10px;
            background: var(--accent);
            filter: blur(20px);
            opacity: 0.1;
            border-radius: 50%;
          }
          .index-label {
            font-size: 0.6rem;
            font-weight: 900;
            letter-spacing: 0.2em;
            color: var(--accent);
            opacity: 0.8;
          }
          .index-current {
            font-size: 1.25rem;
            font-weight: 900;
            color: var(--text);
            font-family: var(--font-mono);
          }
          .index-total {
            font-size: 0.8rem;
            font-weight: 700;
            color: var(--text-muted);
            opacity: 0.5;
          }
        `}</style>
      </section>
    );
  }

  return (
    <section
      className="food-hero-luxe"
      style={
        {
          "--hero-a": palette[0],
          "--hero-b": palette[1],
          "--hero-c": palette[2]
        } as any
      }
    >
      <div className="food-hero-inner-container">
        <header className="food-hero-luxe-topline">
          <div className="tag-list-luxe">
            {badges.map((badge, idx) => (
              <span key={idx} className="info-tag-luxe">
                {badge.icon}
                {badge.label}
              </span>
            ))}
          </div>
          <div className="device-signature-luxe">
            <span className="device-brand">SAFE UNIT</span>
            <span className="device-model">{(state.lockers.find(l => l.lockerId === state.selectedLockerId) || state.lockers[0])?.pairedDeviceName ?? "ESP32-S3"}</span>
          </div>
        </header>

        <div className="food-hero-main-stage">
          {/* Decorative scanline + dot grid overlay */}
          <div className="hero-scanline-overlay" />
          <div className="hero-dot-grid" />

          <div className="hero-content-stack">
            {/* Enhanced Food Visual — emoji avatar with layered glow & orbit rings */}
            <div className={`food-visual-container is-${heroShape} animate-luxe-entry`}>
              <div className="visual-glow-outer" />
              <div className="visual-detail-aura" />
              <div className="visual-shadow-luxe" />
              <div className="visual-orbit-ring ring-1" />
              <div className="visual-orbit-ring ring-2" />
              <div className={`food-initials-luxe ${activeItem.foodName.includes("registered") ? "is-scanning" : ""}`}>
                {activeItem.foodName.includes("registered")
                  ? <span style={{fontSize:"1.1rem",letterSpacing:"0.08em"}}>SCAN</span>
                  : <span className="food-emoji-avatar">{foodEmoji(activeItem.foodName)}</span>
                }
              </div>
              {/* Live telemetry dot */}
              <span className="avatar-live-dot" title="Live" />
            </div>

            <div className="food-details-luxe">
              <h2 className="food-title-luxe">
                {activeItem.foodName.charAt(0).toUpperCase() + activeItem.foodName.slice(1)}
              </h2>
              <div className="food-subtitle-luxe">
                <span className="allergens-label">Notes:</span>
                <span className="allergens-value">
                  {activeItem.allergensNotes.toLowerCase().trim() === "none"
                    ? "Safe for all"
                    : activeItem.allergensNotes.charAt(0).toUpperCase() + activeItem.allergensNotes.slice(1)}
                </span>
              </div>
            </div>

            {/* Enhanced status grid with live indicator pulses */}
            <div className="food-status-grid-luxe">
              <div className="status-cell">
                <div className="status-header">
                  <svg className="status-icon" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="var(--accent)" fillOpacity="0.2" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="cell-label">{t("freshStatus")}</span>
                </div>
                <span className="cell-value">
                  <span className="cell-live-dot" />
                  {t("verified")}
                </span>
              </div>
              <div className="status-divider" />
              <div className="status-cell">
                <div className="status-header">
                  <svg className="status-icon" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="18" height="18" rx="2" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M9 3V21M15 3V21M3 9H21M3 15H21" stroke="var(--accent)" strokeWidth="2" strokeOpacity="0.3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="cell-label">{t("itemCount")}</span>
                </div>
                <span className="cell-value">{(heroItems?.length || 1) > 1 ? `${activeIndex + 1} / ${heroItems?.length}` : "1"}</span>
              </div>
              <div className="status-divider" />
              <div className="status-cell">
                <div className="status-header">
                  <svg className="status-icon" viewBox="0 0 24 24" fill="none">
                    <path d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z" fill="var(--accent)" fillOpacity="0.2" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M9 12L11 14L15 10" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="cell-label">{t("sanitary")}</span>
                </div>
                <span className="cell-value">
                  <span className="cell-live-dot" />
                  {t("certified")}
                </span>
              </div>
            </div>
          </div>

          {/* Safe Navigation Controller */}
          <div className="safe-navigation-controller">
            <button type="button" className="safe-nav-trigger is-prev" onClick={onPrevLocker} aria-label="Previous safe">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            
            <div className="safe-index-display">
              <div className="index-glow" />
              <span className="index-label">SAFE</span>
              <strong className="index-current">
                {((state.lockers.findIndex(l => l.lockerId === state.selectedLockerId) + 1) || 1).toString().padStart(2, '0')}
              </strong>
              <span className="index-total">/ {state.lockers.length.toString().padStart(2, '0')}</span>
            </div>

            <button type="button" className="safe-nav-trigger is-next" onClick={onNextLocker} aria-label="Next safe">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
          </div>

          {/* Navigation Layer (Items) */}
          {heroItems && heroItems.length > 1 && (
            <div className="hero-navigation-layer">
              <button type="button" className="hero-nav-btn is-prev" onClick={() => cycle(-1)} aria-label="Previous item">
                ‹
              </button>
              <button type="button" className="hero-nav-btn is-next" onClick={() => cycle(1)} aria-label="Next item">
                ›
              </button>
            </div>
          )}
        </div>

        {previews.length > 0 && (
          <footer className="food-hero-preview-rail">
            <p className="rail-label">Up Next</p>
            <div className="rail-track">
              {previews.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="rail-item-btn"
                  onClick={() => setActiveIndex(heroItems!.findIndex((entry) => entry.id === item.id))}
                >
                  <span className={`rail-visual is-${visualType(item.foodName)}`} />
                  <div className="rail-item-info">
                    <strong>{item.foodName}</strong>
                    <span>Tap to view</span>
                  </div>
                </button>
              ))}
            </div>
          </footer>
        )}
      </div>

      <style>{`
        .food-hero-luxe {
          position: relative;
          padding: 2rem;
          background: linear-gradient(160deg, var(--panel) 0%, color-mix(in srgb, var(--bg) 90%, var(--accent) 10%) 100%);
          border-radius: var(--radius-lg);
          border: 1px solid transparent;
          background-clip: padding-box;
          overflow: hidden;
          box-shadow: var(--shadow-lg), 0 0 0 1px rgba(var(--accent-rgb), 0.12);
          transition: all 0.5s cubic-bezier(0.2, 1, 0.3, 1);
          animation: revealUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        /* Animated shimmer border via pseudo */
        .food-hero-luxe::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(135deg,
            rgba(var(--accent-rgb),0.6) 0%,
            rgba(var(--accent-rgb),0.1) 40%,
            rgba(var(--accent-rgb),0.4) 70%,
            rgba(var(--accent-rgb),0.05) 100%);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
          animation: borderRotate 6s linear infinite;
        }
        @keyframes borderRotate {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .food-hero-luxe::before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 15% 15%, rgba(var(--accent-rgb), 0.12), transparent 45%),
            radial-gradient(circle at 85% 80%, rgba(var(--accent-rgb), 0.06), transparent 40%);
          opacity: 1;
          pointer-events: none;
        }
        /* Scanline overlay */
        .hero-scanline-overlay {
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 3px,
            rgba(var(--accent-rgb), 0.015) 3px,
            rgba(var(--accent-rgb), 0.015) 4px
          );
          pointer-events: none;
          z-index: 1;
        }
        /* Dot grid background */
        .hero-dot-grid {
          position: absolute;
          inset: 0;
          background-image: radial-gradient(rgba(var(--accent-rgb), 0.18) 1px, transparent 1px);
          background-size: 22px 22px;
          opacity: 0.35;
          pointer-events: none;
          z-index: 1;
        }
        .food-hero-inner-container {
          position: relative;
          z-index: 5;
        }
        .food-hero-luxe-topline {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1.5rem;
        }
        .tag-list-luxe {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        .info-tag-luxe {
          padding: 0.4rem 0.8rem;
          background: rgba(var(--accent-rgb, 20, 184, 166), 0.08);
          border: 1px solid var(--line);
          border-radius: 99px;
          font-size: 0.65rem;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--accent);
          display: flex;
          align-items: center;
          gap: 0.4rem;
          backdrop-filter: blur(5px);
        }
        .device-signature-luxe {
          text-align: right;
          font-family: var(--font-mono);
          display: flex;
          flex-direction: column;
          gap: 1px;
          opacity: 0.5;
        }
        .device-brand { font-size: 0.6rem; font-weight: 900; letter-spacing: 0.15em; color: var(--accent); }
        .device-model { font-size: 0.55rem; font-weight: 700; color: var(--text-muted); }

        .food-hero-main-stage {
          position: relative;
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 1.5rem 0;
          gap: 1rem;
        }
        
        .safe-navigation-controller {
          display: flex !important;
          flex-direction: row !important;
          align-items: center;
          justify-content: center;
          gap: 1.25rem;
          padding: 0.6rem 1.25rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          border-radius: 99px;
          backdrop-filter: blur(20px);
          box-shadow: 0 10px 40px rgba(0,0,0,0.3);
          z-index: 100;
          margin: 2rem auto;
          min-width: 240px;
        }
        .safe-navigation-controller.is-empty-state {
          margin: 3rem auto 0;
        }
        .hero-navigation-layer {
          position: absolute;
          inset: 0 -1rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          pointer-events: none;
          z-index: 20;
        }
        .hero-nav-btn {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: 1px solid var(--line);
          background: var(--panel-light);
          color: var(--text);
          font-size: 1.5rem;
          display: grid;
          place-items: center;
          cursor: pointer;
          pointer-events: auto;
          transition: all 0.4s cubic-bezier(0.2, 1, 0.3, 1);
          backdrop-filter: blur(20px);
          box-shadow: var(--shadow-card);
        }
        .hero-nav-btn:hover {
          background: var(--accent);
          color: #FFFFFF;
          transform: scale(1.1) translateY(-2px);
          box-shadow: var(--shadow-glow);
          border-color: var(--accent);
        }

        .safe-navigation-controller {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.5rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--glass-border);
          border-radius: 99px;
          backdrop-filter: blur(20px);
          box-shadow: 0 20px 40px rgba(0,0,0,0.3);
          z-index: 100;
          margin-top: 1rem;
        }
        .safe-nav-trigger {
          width: 44px;
          height: 44px;
          flex-shrink: 0;
          border-radius: 50%;
          border: 1px solid var(--glass-border);
          background: rgba(255, 255, 255, 0.1);
          color: var(--text);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.4s cubic-bezier(0.2, 1, 0.3, 1);
        }
        .safe-nav-trigger svg { 
          width: 20px; 
          height: 20px; 
          display: block;
          stroke: var(--accent);
          stroke-width: 3.5;
        }
        .safe-nav-trigger:hover {
          background: var(--accent);
          color: #000;
          transform: scale(1.1);
          box-shadow: 0 0 20px rgba(var(--accent-rgb), 0.3);
          border-color: var(--accent);
        }
        .safe-nav-trigger:hover svg { opacity: 1; }
        .safe-nav-trigger:active { transform: scale(0.95); }

        .safe-index-display {
          display: flex;
          align-items: baseline;
          gap: 0.5rem;
          padding: 0 1.5rem;
          position: relative;
        }
        .index-glow {
          position: absolute;
          inset: -10px;
          background: var(--accent);
          filter: blur(20px);
          opacity: 0.1;
          border-radius: 50%;
        }
        .index-label {
          font-size: 0.6rem;
          font-weight: 900;
          letter-spacing: 0.2em;
          color: var(--accent);
          opacity: 0.8;
        }
        .index-current {
          font-size: 1.25rem;
          font-weight: 900;
          color: var(--text);
          font-family: var(--font-mono);
        }
        .index-total {
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--text-muted);
          opacity: 0.5;
        }

        .hero-content-stack {
          text-align: center;
          max-width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.25rem;
          width: 100%;
        }
        .food-visual-container {
          position: relative;
          width: 108px;
          height: 108px;
          display: grid;
          place-items: center;
          transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .food-hero-luxe:hover .food-visual-container {
          transform: scale(1.07) translateY(-4px);
        }
        /* Outer ambient glow */
        .visual-glow-outer {
          position: absolute;
          inset: -30px;
          background: radial-gradient(circle, rgba(var(--accent-rgb), 0.35) 0%, transparent 65%);
          filter: blur(20px);
          animation: auraPulse 3s ease-in-out infinite;
          z-index: 0;
        }
        .visual-detail-aura {
          position: absolute;
          inset: -10px;
          background: radial-gradient(circle, var(--accent) 0%, transparent 70%);
          opacity: 0.2;
          filter: blur(18px);
          animation: auraPulse 4s ease-in-out infinite 0.5s;
          z-index: 1;
        }
        @keyframes auraPulse {
          0%, 100% { opacity: 0.15; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.12); }
        }
        .food-initials-luxe {
          position: relative;
          z-index: 10;
          display: grid;
          place-items: center;
          width: 74px;
          height: 74px;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 35%, rgba(var(--accent-rgb),0.18), rgba(var(--accent-rgb),0.04));
          border: 1.5px solid rgba(var(--accent-rgb), 0.3);
          backdrop-filter: blur(12px);
          box-shadow:
            0 8px 32px rgba(0,0,0,0.25),
            inset 0 1px 0 rgba(255,255,255,0.15),
            0 0 0 6px rgba(var(--accent-rgb),0.06);
        }
        .food-emoji-avatar {
          font-size: 2.4rem;
          line-height: 1;
          filter: drop-shadow(0 4px 12px rgba(0,0,0,0.3));
          display: block;
        }
        /* Dual orbit rings */
        .visual-orbit-ring {
          position: absolute;
          border-radius: 50%;
          border: 1px solid rgba(var(--accent-rgb), 0.25);
          z-index: 2;
        }
        .visual-orbit-ring.ring-1 {
          inset: -14px;
          animation: orbit 16s linear infinite;
        }
        .visual-orbit-ring.ring-1::after {
          content: "";
          position: absolute;
          top: 6px; right: 6px;
          width: 7px; height: 7px;
          background: var(--accent);
          border-radius: 50%;
          box-shadow: 0 0 12px 2px var(--accent);
        }
        .visual-orbit-ring.ring-2 {
          inset: -26px;
          border-style: dashed;
          border-color: rgba(var(--accent-rgb), 0.12);
          animation: orbit 32s linear infinite reverse;
        }
        .visual-orbit-ring.ring-2::before {
          content: "";
          position: absolute;
          bottom: 8px; left: 8px;
          width: 5px; height: 5px;
          background: rgba(var(--accent-rgb), 0.6);
          border-radius: 50%;
        }
        @keyframes orbit { from { transform: rotate(0); } to { transform: rotate(360deg); } }
        /* Live avatar dot */
        .avatar-live-dot {
          position: absolute;
          top: 6px; right: 6px;
          width: 10px; height: 10px;
          background: #22c55e;
          border-radius: 50%;
          border: 2px solid var(--bg);
          z-index: 20;
          animation: liveDotPulse 2s ease-in-out infinite;
        }
        @keyframes liveDotPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.5); }
          50% { box-shadow: 0 0 0 5px rgba(34,197,94,0); }
        }
        /* Live dot inside cell values */
        .cell-live-dot {
          display: inline-block;
          width: 6px; height: 6px;
          background: var(--accent);
          border-radius: 50%;
          margin-right: 5px;
          vertical-align: middle;
          animation: liveDotPulse 2.5s ease-in-out infinite;
          box-shadow: 0 0 6px var(--accent);
        }

        .food-details-luxe {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .food-title-luxe {
          font-size: 2.25rem;
          font-weight: 900;
          letter-spacing: -0.05em;
          margin: 0;
          color: var(--text);
          line-height: 1;
        }
        .food-subtitle-luxe {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          justify-content: center;
          background: rgba(255, 255, 255, 0.03);
          padding: 0.3rem 1rem;
          border-radius: 99px;
          border: 1px solid var(--line);
        }
        .allergens-label { font-size: 0.6rem; font-weight: 900; color: var(--accent); text-transform: uppercase; letter-spacing: 0.1em; }
        .allergens-value { font-size: 0.8rem; color: var(--text-muted); font-weight: 600; }

        .food-status-grid-luxe {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          padding: 1rem 2rem;
          background: var(--panel-elevated);
          border: 1px solid var(--glass-border);
          border-radius: 20px;
          backdrop-filter: blur(20px);
          box-shadow: var(--shadow-card);
        }
        .status-cell { display: flex; flex-direction: column; gap: 0.25rem; text-align: left; }
        .status-header { display: flex; align-items: center; gap: 0.4rem; }
        .status-icon { width: 14px; height: 14px; flex-shrink: 0; }
        .cell-label { font-size: 0.6rem; text-transform: uppercase; font-weight: 900; color: var(--text-muted); letter-spacing: 0.1em; }
        .cell-value { font-size: 0.95rem; font-weight: 800; color: var(--text); line-height: 1; }
        .status-divider { width: 1px; height: 24px; background: var(--line); }

        .food-hero-preview-rail {
          margin-top: 1.5rem;
          border-top: 1px solid var(--line);
          padding-top: 1rem;
        }
        .rail-label { font-size: 0.6rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.2em; color: var(--accent); margin-bottom: 0.5rem; opacity: 0.8; }
        .rail-track { 
          display: flex; 
          gap: 0.75rem; 
          overflow-x: auto; 
          padding-bottom: 0.4rem;
          scrollbar-width: none;
        }
        .rail-track::-webkit-scrollbar { display: none; }
        .rail-item-btn {
          flex: 0 0 140px;
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.5rem 0.75rem;
          background: var(--panel-elevated);
          border: 1px solid var(--glass-border);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.2, 1, 0.3, 1);
          text-align: left;
        }
        .rail-item-btn:hover { background: var(--panel-light); transform: translateY(-3px); border-color: var(--accent); box-shadow: var(--shadow-card); }
        .rail-visual { 
          width: 28px; 
          height: 28px; 
          border-radius: 6px; 
          background: var(--accent); 
          opacity: 0.15; 
          transition: all 0.3s;
          display: grid;
          place-items: center;
        }
        .rail-item-btn:hover .rail-visual { opacity: 0.3; transform: scale(1.1); }
        .rail-item-info { display: flex; flex-direction: column; overflow: hidden; gap: 1px; }
        .rail-item-info strong { 
          font-size: 0.75rem; 
          color: var(--text); 
          display: block; 
          overflow: hidden; 
          text-overflow: ellipsis; 
          white-space: nowrap; 
          font-weight: 700;
        }
        .rail-item-info span { font-size: 0.6rem; color: var(--text-muted); font-weight: 600; }
      `}</style>
    </section>
  );
}
