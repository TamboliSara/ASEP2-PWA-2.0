import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../../store/useTranslation";
import { useAppContext } from "../../store/AppContext";
import type { DonationRecord } from "../../types/domain";

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
    { label: item?.dietTag?.replace("_", " ") ?? t("communityReady"), icon: <DietIcon tag={item?.dietTag} /> }
  ];
}

function formatAllergenText(notes?: string) {
  if (!notes) return "No allergens declared — Safe for all";
  const trimmed = notes.trim();
  const lower = trimmed.toLowerCase();
  if (lower === "none" || lower === "no allergens" || lower === "none declared" || lower === "safe for all") {
    return "No allergens declared — Safe for all";
  }
  if (lower === "freshly cut fruits") {
    return "No common allergens • Fresh seasonal fruits";
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
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
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { state } = useAppContext();

  const scrollToRetrieve = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const findTarget = (): HTMLElement | null => {
      return (
        document.getElementById("retrieve-item-card") ||
        (document.querySelector(".receiver-card-retrieve") as HTMLElement | null) ||
        (document.querySelector("#retrieve-item-card") as HTMLElement | null)
      );
    };

    const doScroll = (element: HTMLElement) => {
      // 1. Calculate cumulative offsetTop from element to root
      let totalTop = 0;
      let curr: HTMLElement | null = element;
      while (curr) {
        totalTop += curr.offsetTop || 0;
        curr = curr.offsetParent as HTMLElement | null;
      }

      const navOffset = 110;
      const targetScrollY = Math.max(0, totalTop - navOffset);

      // 2. Perform smooth window scroll
      window.scrollTo({
        top: targetScrollY,
        behavior: "smooth"
      });

      // 3. Fallback scrollIntoView after small tick
      setTimeout(() => {
        try {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        } catch {
          // ignore
        }
      }, 60);

      // 4. Update hash in browser without jumping
      try {
        window.history.replaceState(null, "", "#retrieve-item-card");
      } catch {
        // ignore
      }

      // 5. Highlight pulse on target
      element.classList.add("retrieval-target-pulse");
      setTimeout(() => {
        element.classList.remove("retrieval-target-pulse");
      }, 2500);
    };

    const target = findTarget();
    if (target) {
      doScroll(target);
    } else {
      navigate("/receive#retrieve-item-card");
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        const el = findTarget();
        if (el) {
          clearInterval(interval);
          doScroll(el);
        } else if (attempts >= 15) {
          clearInterval(interval);
        }
      }, 100);
    }
  };

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
          <div className="empty-actions-row">
            <button className="premium-action-button" type="button" onClick={() => navigate("/donate")}>
              <span className="btn-label">{t("donateNow") || "Start Donation"}</span>
              <span className="btn-icon">→</span>
            </button>
            <button 
              className="hero-retrieve-jump-btn" 
              type="button" 
              onClick={scrollToRetrieve}
              aria-label="Scroll down to retrieve food from this locker"
              style={{
                display: 'inline-flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.85rem',
                width: '100%',
                maxWidth: '320px',
                padding: '0.85rem 1.6rem',
                borderRadius: '9999px',
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                color: '#FFFFFF',
                border: '1.5px solid #047857',
                boxShadow: '0 6px 20px rgba(5, 150, 105, 0.4), 0 2px 6px rgba(0, 0, 0, 0.1)',
                cursor: 'pointer',
                textDecoration: 'none',
                outline: 'none',
                fontFamily: 'inherit',
                fontSize: '0.92rem',
                fontWeight: 800,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                position: 'relative',
                zIndex: 35,
                userSelect: 'none',
                transition: 'all 0.3s ease'
              }}
            >
              <span className="retrieve-btn-icon-wrap" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.22)',
                color: '#FFFFFF',
                flexShrink: 0
              }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }}>
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                  <line x1="12" y1="22.08" x2="12" y2="12"/>
                </svg>
              </span>
              <span className="retrieve-btn-label" style={{
                flex: 1,
                textAlign: 'center',
                fontWeight: 800,
                fontSize: '0.92rem',
                color: '#FFFFFF',
                letterSpacing: '0.06em'
              }}>
                {t("retrieveItem") || "Retrieve Item"}
              </span>
              <span className="retrieve-btn-arrow-wrap" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.2)',
                color: '#FFFFFF',
                flexShrink: 0
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }}>
                  <path d="M12 5v14M19 12l-7 7-7-7"/>
                </svg>
              </span>
            </button>
          </div>

          {/* Safe Navigation Controller */}
          <div className="safe-navigation-controller is-empty-state">
            <button 
              type="button" 
              className="safe-nav-trigger is-prev" 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onPrevLocker?.();
              }} 
              aria-label="Previous safe"
              style={{ cursor: 'pointer', zIndex: 110 }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }}><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            
            <div className="safe-index-display">
              <div className="index-glow" />
              <span className="index-label">SAFE</span>
              <strong className="index-current">
                {((state.lockers.findIndex(l => l.lockerId === state.selectedLockerId) + 1) || 1).toString().padStart(2, '0')}
              </strong>
              <span className="index-total">/ {state.lockers.length.toString().padStart(2, '0')}</span>
            </div>

            <button 
              type="button" 
              className="safe-nav-trigger is-next" 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onNextLocker?.();
              }} 
              aria-label="Next safe"
              style={{ cursor: 'pointer', zIndex: 110 }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }}><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
          </div>
        </div>
        <style>{`
          .food-hero-luxe.is-empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            background: radial-gradient(circle at center, rgba(82, 196, 106, 0.08), transparent 70%);
            height: 100%;
          }
          .empty-state-content {
            display: grid;
            gap: 0.75rem;
            max-width: 300px;
            padding: 1.25rem 1.5rem;
            animation: fadeIn 0.8s ease-out;
            position: relative;
            z-index: 10;
          }
          .empty-locker-illustration-premium {
            position: relative;
            width: 90px;
            height: 90px;
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
            font-size: 1.6rem;
            font-weight: 900;
            letter-spacing: -0.04em;
            margin: 0 0 0.25rem;
            background: linear-gradient(135deg, var(--text) 20%, var(--accent));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }
          .empty-copy-stack p {
            font-size: 0.85rem;
            color: var(--text-muted);
            opacity: 0.7;
          }
          .empty-actions-row {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
            width: 100%;
            align-items: center;
          }
          .premium-action-button {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.75rem;
            padding: 0.85rem 1.75rem;
            background: var(--accent);
            color: #08120d;
            border: none;
            border-radius: 99px;
            font-size: 0.95rem;
            font-weight: 800;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.2, 1, 0.3, 1);
            box-shadow: 0 10px 30px rgba(82, 196, 106, 0.3);
            width: 100%;
          }
          .premium-action-button:hover {
            transform: translateY(-4px) scale(1.02);
            box-shadow: 0 15px 40px rgba(82, 196, 106, 0.4);
            filter: brightness(1.1);
          }
          .premium-action-button.is-secondary-retrieve {
            background: rgba(16, 185, 129, 0.08);
            color: var(--accent);
            border: 1.5px solid rgba(16, 185, 129, 0.35);
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03);
            font-size: 1.05rem;
            padding: 1.1rem 2.25rem;
          }
          .premium-action-button.is-secondary-retrieve:hover {
            background: rgba(16, 185, 129, 0.18);
            border-color: var(--accent);
            color: var(--accent);
            transform: translateY(-2px) scale(1.02);
            box-shadow: 0 10px 30px rgba(16, 185, 129, 0.25);
          }
          .premium-action-button.is-secondary-retrieve:hover .btn-icon {
            transform: translateY(3px);
          }
          .premium-action-button .btn-icon {
            transition: transform 0.3s ease;
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
            position: relative !important;
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
        </header>

        <div className="food-hero-main-stage">
          {/* Decorative scanline + dot grid overlay */}
          <div className="hero-scanline-overlay" />
          <div className="hero-dot-grid" />

          <div className="hero-content-stack" style={{ position: 'relative', zIndex: 50, pointerEvents: 'auto' }}>
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
              <div className="food-subtitle-luxe">
                <span className="allergens-label">
                  <svg className="allergen-shield-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                  {t("allergens") || "Allergens"}:
                </span>
                <span className="allergens-value">
                  {formatAllergenText(activeItem.allergensNotes)}
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

            {/* Quick jump to retrieve */}
            <div className="hero-retrieve-action-wrap" style={{ position: 'relative', zIndex: 60, pointerEvents: 'auto' }}>
              <button 
                className="hero-retrieve-jump-btn" 
                type="button" 
                onClick={scrollToRetrieve}
                aria-label="Scroll down to retrieve food from this locker"
                style={{
                  display: 'inline-flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.85rem',
                  width: '100%',
                  maxWidth: '320px',
                  padding: '0.85rem 1.6rem',
                  borderRadius: '9999px',
                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  color: '#FFFFFF',
                  border: '1.5px solid #047857',
                  boxShadow: '0 6px 20px rgba(5, 150, 105, 0.4), 0 2px 6px rgba(0, 0, 0, 0.1)',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  outline: 'none',
                  fontFamily: 'inherit',
                  fontSize: '0.92rem',
                  fontWeight: 800,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  position: 'relative',
                  zIndex: 35,
                  userSelect: 'none',
                  transition: 'all 0.3s ease'
                }}
              >
                <span className="retrieve-btn-icon-wrap" style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.22)',
                  color: '#FFFFFF',
                  flexShrink: 0
                }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }}>
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                    <line x1="12" y1="22.08" x2="12" y2="12"/>
                  </svg>
                </span>
                <span className="retrieve-btn-label" style={{
                  flex: 1,
                  textAlign: 'center',
                  fontWeight: 800,
                  fontSize: '0.92rem',
                  color: '#FFFFFF',
                  letterSpacing: '0.06em'
                }}>
                  {t("retrieveItem") || "Retrieve Item"}
                </span>
                <span className="retrieve-btn-arrow-wrap" style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.2)',
                  color: '#FFFFFF',
                  flexShrink: 0
                }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }}>
                    <path d="M12 5v14M19 12l-7 7-7-7"/>
                  </svg>
                </span>
              </button>
            </div>
          </div>

          {/* Safe Navigation Controller */}
          <div className="safe-navigation-controller" style={{ position: 'relative', zIndex: 120, pointerEvents: 'auto' }}>
            <button 
              type="button" 
              className="safe-nav-trigger is-prev" 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onPrevLocker?.();
              }} 
              aria-label="Previous safe"
              style={{ cursor: 'pointer', zIndex: 110 }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }}><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            
            <div className="safe-index-display">
              <div className="index-glow" />
              <span className="index-label">SAFE</span>
              <strong className="index-current">
                {((state.lockers.findIndex(l => l.lockerId === state.selectedLockerId) + 1) || 1).toString().padStart(2, '0')}
              </strong>
              <span className="index-total">/ {state.lockers.length.toString().padStart(2, '0')}</span>
            </div>

            <button 
              type="button" 
              className="safe-nav-trigger is-next" 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onNextLocker?.();
              }} 
              aria-label="Next safe"
              style={{ cursor: 'pointer', zIndex: 110 }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }}><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
          </div>

          {/* Navigation Layer (Items) */}
          {heroItems && heroItems.length > 1 && (
            <div className="hero-navigation-layer">
              <button 
                type="button" 
                className="hero-nav-btn is-prev" 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  cycle(-1);
                }} 
                aria-label="Previous item"
                style={{ cursor: 'pointer', zIndex: 120 }}
              >
                ‹
              </button>
              <button 
                type="button" 
                className="hero-nav-btn is-next" 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  cycle(1);
                }} 
                aria-label="Next item"
                style={{ cursor: 'pointer', zIndex: 120 }}
              >
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
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          box-sizing: border-box;
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
          pointer-events: auto;
        }
        .food-hero-luxe-topline {
          display: flex;
          justify-content: flex-start;
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
          padding: 0.75rem 0;
          gap: 0.75rem;
          pointer-events: auto;
          z-index: 10;
        }
        
        .safe-navigation-controller {
          display: flex !important;
          flex-direction: row !important;
          align-items: center;
          justify-content: center;
          gap: 1.25rem;
          padding: 0.45rem 1rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          border-radius: 99px;
          backdrop-filter: blur(20px);
          box-shadow: 0 10px 40px rgba(0,0,0,0.3);
          position: relative !important;
          z-index: 100;
          margin: 0.75rem auto;
          min-width: 220px;
        }
        .safe-navigation-controller.is-empty-state {
          margin: 0.75rem auto 0;
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
          position: relative !important;
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
          gap: 0.75rem;
          width: 100%;
          position: relative;
          z-index: 50;
          pointer-events: auto;
        }
        .food-visual-container {
          position: relative;
          width: 88px;
          height: 88px;
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
          width: 60px;
          height: 60px;
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
          font-size: 1.9rem;
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
        }
        .visual-orbit-ring.ring-2::before {
          content: "";
          position: absolute;
          bottom: 8px; left: 8px;
          width: 5px; height: 5px;
          background: rgba(var(--accent-rgb), 0.6);
          border-radius: 50%;
        }
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
          gap: 0.35rem;
          width: 100%;
          max-width: 100%;
          min-width: 0;
          overflow: hidden;
          text-align: center;
        }
        .food-title-luxe {
          font-size: clamp(1.4rem, 2.2vw, 2.1rem);
          font-weight: 900;
          letter-spacing: -0.04em;
          margin: 0;
          color: var(--text);
          line-height: 1.2;
          word-break: break-word;
          overflow-wrap: break-word;
          white-space: normal;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
          padding: 0 0.5rem;
        }
        .food-subtitle-luxe {
          display: inline-flex;
          align-items: center;
          gap: 0.6rem;
          justify-content: center;
          background: rgba(var(--accent-rgb, 16, 185, 129), 0.08);
          padding: 0.45rem 1.25rem;
          border-radius: 99px;
          border: 1px solid rgba(var(--accent-rgb, 16, 185, 129), 0.22);
          backdrop-filter: blur(12px);
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.04);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          max-width: 95%;
          margin: 0.2rem auto 0;
        }
        .food-subtitle-luxe:hover {
          background: rgba(var(--accent-rgb, 16, 185, 129), 0.12);
          border-color: rgba(var(--accent-rgb, 16, 185, 129), 0.35);
          box-shadow: 0 6px 20px rgba(var(--accent-rgb, 16, 185, 129), 0.1);
        }
        .allergens-label {
          font-size: 0.68rem;
          font-weight: 900;
          color: var(--accent);
          text-transform: uppercase;
          letter-spacing: 0.12em;
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          flex-shrink: 0;
        }
        .allergen-shield-icon {
          width: 13px;
          height: 13px;
          color: var(--accent);
          flex-shrink: 0;
        }
        .allergens-value {
          font-size: 0.85rem;
          color: var(--text);
          font-weight: 600;
          letter-spacing: 0.01em;
          line-height: 1.3;
        }

        .food-status-grid-luxe {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.65rem 1.25rem;
          background: var(--panel-elevated);
          border: 1px solid var(--glass-border);
          border-radius: 16px;
          backdrop-filter: blur(20px);
          box-shadow: var(--shadow-card);
        }
        .status-cell { display: flex; flex-direction: column; gap: 0.25rem; text-align: left; }
        .status-header { display: flex; align-items: center; gap: 0.4rem; }
        .status-icon { width: 14px; height: 14px; flex-shrink: 0; }
        .cell-label { font-size: 0.6rem; text-transform: uppercase; font-weight: 900; color: var(--text-muted); letter-spacing: 0.1em; }
        .cell-value { font-size: 0.95rem; font-weight: 800; color: var(--text); line-height: 1; }
        .status-divider { width: 1px; height: 24px; background: var(--line); }

        /* Jump to retrieve button styles */
        .hero-retrieve-action-wrap {
          margin-top: 0.75rem;
          margin-bottom: 0.25rem;
          width: 100%;
          display: flex;
          justify-content: center;
          position: relative;
          z-index: 30;
        }

        .hero-retrieve-jump-btn {
          display: inline-flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.85rem;
          width: 100%;
          max-width: 320px;
          padding: 0.95rem 1.6rem;
          border-radius: 99px;
          font-family: inherit;
          font-size: 0.95rem;
          font-weight: 800;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
          text-decoration: none;
          outline: none;
          position: relative;
          overflow: hidden;
          
          /* Default light mode / high visibility */
          background: linear-gradient(135deg, #059669 0%, #047857 100%);
          color: #FFFFFF !important;
          border: 1.5px solid #047857;
          box-shadow: 0 6px 24px rgba(5, 150, 105, 0.35), 0 2px 6px rgba(0, 0, 0, 0.08);
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
        }

        /* Hover & focus states */
        .hero-retrieve-jump-btn:hover {
          transform: translateY(-3px) scale(1.02);
          box-shadow: 0 12px 36px rgba(5, 150, 105, 0.45);
          background: linear-gradient(135deg, #047857 0%, #065F46 100%);
          border-color: #065F46;
          color: #FFFFFF !important;
        }

        .hero-retrieve-jump-btn:active {
          transform: translateY(0) scale(0.98);
        }

        /* Dark mode variant */
        :root[data-theme-mode="dark"] .hero-retrieve-jump-btn,
        body[data-theme-mode="dark"] .hero-retrieve-jump-btn,
        .dark .hero-retrieve-jump-btn {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(5, 150, 105, 0.35) 100%);
          color: #6EE7B7 !important;
          border: 1.5px solid rgba(52, 211, 153, 0.6);
          box-shadow: 0 6px 28px rgba(0, 0, 0, 0.45), 0 0 24px rgba(16, 185, 129, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.15);
          text-shadow: none;
        }

        :root[data-theme-mode="dark"] .hero-retrieve-jump-btn:hover,
        body[data-theme-mode="dark"] .hero-retrieve-jump-btn:hover,
        .dark .hero-retrieve-jump-btn:hover {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.4) 0%, rgba(5, 150, 105, 0.55) 100%);
          color: #A7F3D0 !important;
          border-color: #34D399;
          box-shadow: 0 10px 36px rgba(16, 185, 129, 0.4);
        }

        .retrieve-btn-icon-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.22);
          color: #FFFFFF;
          flex-shrink: 0;
          backdrop-filter: blur(8px);
        }

        .retrieve-btn-label {
          font-weight: 800;
          letter-spacing: 0.06em;
          flex: 1;
          text-align: center;
        }

        .retrieve-btn-arrow-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          color: #FFFFFF;
          flex-shrink: 0;
          animation: retrieveArrowBounce 1.8s ease-in-out infinite;
        }

        @keyframes retrieveArrowBounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(4px);
          }
        }

        @keyframes targetCardGlow {
          0%, 100% {
            box-shadow: var(--shadow-card);
          }
          50% {
            box-shadow: 0 0 50px rgba(16, 185, 129, 0.6), 0 0 0 3px var(--accent);
            transform: translateY(-4px);
          }
        }
        .retrieval-target-pulse {
          animation: targetCardGlow 1.8s ease-in-out !important;
        }

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
