import { useEffect, useState, type PropsWithChildren } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CinematicSplash } from "../effects/CinematicSplash";
import { GradientStatusBar } from "../layout/GradientStatusBar";
import { OfflineBanner } from "../feedback/OfflineBanner";
import { ToastCenter } from "../feedback/ToastCenter";
import { HelpWidget } from "../controls/HelpWidget";
import { useTranslation } from "../../store/useTranslation";
import { useAppContext } from "../../store/AppContext";
import { ScrollProgress } from "../effects/ScrollProgress";
import { VoiceAssistant } from "../../features/voice/VoiceAssistant";
import { WebsiteTour } from "../tour/WebsiteTour";

export function AppShell({ children }: PropsWithChildren) {
  const { t } = useTranslation();
  const location = useLocation();
  const { state, dispatch } = useAppContext();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.pathname]);

  // High-performance passive scroll handler (zero layout thrashing)
  useEffect(() => {
    let ticking = false;
    function handleScroll() {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setIsScrolled(window.scrollY > 20);
          ticking = false;
        });
        ticking = true;
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const navItems = [
    { path: "/", label: t("modeNav") },
    { path: "/receive", label: t("dashboardNav") },
    { path: "/admin", label: t("admin") },
  ];

  const isVisualizer = location.pathname === "/visualizer";

  // Track main system theme whenever user is on the main system
  useEffect(() => {
    if (!isVisualizer) {
      localStorage.setItem('safe_main_system_theme', state.themeMode);
    }
  }, [isVisualizer, state.themeMode]);

  // Standalone mobile page for QR code scanners: show ONLY the OTP passkey without kiosk navbar or widgets
  if (location.pathname === "/qr-scan") {
    return <>{children}</>;
  }

  return (
    <div className={`app-shell ${isVisualizer ? 'app-shell-visualizer' : ''}`}>
      {!isVisualizer && <ScrollProgress />}
      {/* Floating ambient orbs (hidden in 3D visualizer for clean dark environment) */}
      {!isVisualizer && (
        <div className="ambient-orbs" aria-hidden="true">
          <div className="orb orb-1" />
          <div className="orb orb-2" />
          <div className="orb orb-3" />
        </div>
      )}

      <motion.header 
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] as const }}
        className={`shell-header glass-panel ${isScrolled ? 'header-scrolled' : ''}`}
      >
        <CinematicSplash />
        
        <div className="header-brand-stack">
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="brand-logo-container"
          >
            <h1 className="luxe-logo">
              {t("brand")}
              <span className="logo-dot">.</span>
            </h1>
          </motion.div>
          <p className="eyebrow luxe-eyebrow">{t("shellEyebrow")}</p>
        </div>

        <nav className="top-nav-luxe">
          <ul className="nav-list">
            {navItems.map((item) => (
              <li key={item.path} className="nav-item">
                <NavLink to={item.path} onClick={() => window.scrollTo({ top: 0, behavior: 'auto' })}>
                  {({ isActive }) => (
                    <div className="nav-link-content">
                      {item.label}
                      {isActive && (
                        <motion.div
                          layoutId="nav-indicator"
                          className="nav-indicator"
                          transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
                        />
                      )}
                    </div>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="shell-actions-luxe">
          <GradientStatusBar />
        </div>
      </motion.header>

      {/* Spacer to prevent content overlap with fixed header (omitted in 3D visualizer for full-bleed viewport) */}
      {!isVisualizer && (
        <div className="header-spacer" style={{ height: 'calc(100px + 1.5rem)' }} />
      )}

      <OfflineBanner />
      <ToastCenter />
      
      <main className="shell-content">
        {children}
      </main>

      {/* Persistent floating action widgets (hidden in 3D visualizer to avoid UI HUD overlap) */}
      {!isVisualizer && <HelpWidget />}
      {!isVisualizer && <VoiceAssistant />}
      {!isVisualizer && <WebsiteTour />}
    </div>
  );
}
