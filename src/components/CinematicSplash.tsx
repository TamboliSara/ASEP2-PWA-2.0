import { useEffect, useState } from "react";
import { useTranslation } from "../store/useTranslation";

const SPLASH_KEY = "ecolocker-splash-seen";

export function CinematicSplash() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [animState, setAnimState] = useState<"idle" | "intro" | "outro">("idle");

  useEffect(() => {
    const alreadySeen = sessionStorage.getItem(SPLASH_KEY);
    const forceSplash = new URLSearchParams(window.location.search).get("splash") === "1";

    if (alreadySeen && !forceSplash) {
      document.documentElement.removeAttribute("data-splash-active");
      return;
    }

    setVisible(true);
    setAnimState("intro");
    document.documentElement.setAttribute("data-splash-active", "true");

    const outroTimeout = window.setTimeout(() => {
      setAnimState("outro");
    }, 2800);

    const finishTimeout = window.setTimeout(() => {
      sessionStorage.setItem(SPLASH_KEY, "1");
      document.documentElement.removeAttribute("data-splash-active");
      setVisible(false);
    }, 3400);

    return () => {
      document.documentElement.removeAttribute("data-splash-active");
      window.clearTimeout(outroTimeout);
      window.clearTimeout(finishTimeout);
    };
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div className={`cinematic-splash anim-${animState}`} aria-hidden="true">
      <div className="splash-ambient-glow" />
      <div className="splash-brand-container">
        <div className="splash-brand-luxe">
          <div className="brand-logo-container">
            <div className="lock-icon-luxe">
              <div className="lock-shackle" />
              <div className="lock-body">
                <div className="lock-keyhole" />
              </div>
            </div>
          </div>
          <h1 className="brand-reveal">{t("brand") || "EcoLocker"}</h1>
          <p className="brand-tagline-reveal">{t("brandTagline") || "Community-Powered Freshness"}</p>
        </div>
      </div>
      
      <style>{`
        .cinematic-splash {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: #0d1610;
          display: grid;
          place-items: center;
          transition: opacity 1.2s cubic-bezier(0.4, 0, 0.2, 1);
          pointer-events: none;
        }
        .cinematic-splash.anim-intro {
          pointer-events: auto;
        }
        .cinematic-splash.anim-outro {
          opacity: 0;
        }
        .splash-ambient-glow {
          position: absolute;
          width: 60vw;
          height: 60vw;
          background: radial-gradient(circle, rgba(82, 196, 106, 0.15) 0%, transparent 70%);
          filter: blur(80px);
          animation: glowPulse 4s infinite alternate;
        }
        @keyframes glowPulse {
          from { transform: scale(1); opacity: 0.5; }
          to { transform: scale(1.2); opacity: 0.8; }
        }
        .brand-logo-container {
          width: 120px;
          height: 120px;
        }
        .logo-locker-box {
          position: absolute;
          inset: 20%;
          border: 3px solid var(--accent);
          border-radius: 12px;
          background: rgba(82, 196, 106, 0.1);
        }
        .logo-leaf {
          position: absolute;
          width: 40px;
          height: 40px;
          background: var(--accent);
          border-radius: 0 100% 0 100%;
        }
        .leaf-1 { top: 0; right: 0; transform: rotate(15deg); }
        .leaf-2 { bottom: 10%; left: -10%; transform: rotate(-45deg) scale(0.8); }
        
        .logo-text h2 {
          font-size: 3.5rem;
          letter-spacing: -0.04em;
          margin: 0;
          background: linear-gradient(135deg, var(--text) 30%, var(--accent) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .logo-text p {
          color: var(--text-muted);
          font-weight: 600;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          font-size: 0.8rem;
          margin-top: 0.5rem;
        }
      `}</style>
    </div>
  );
}

