import { useEffect, useState, type PropsWithChildren } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CinematicSplash } from "./CinematicSplash";
import { GradientStatusBar } from "./layout/GradientStatusBar";
import { OfflineBanner } from "./OfflineBanner";
import { RouteTransitionV2 } from "./RouteTransitionV2";
import { ToastCenter } from "./ToastCenter";
import { HelpWidget } from "./HelpWidget";
import { NotificationButton } from "./NotificationButton";
import { NotificationPanel, MOCK_NOTIFICATIONS } from "./NotificationPanel";
import { useTranslation } from "../store/useTranslation";
import { ScrollProgress } from "./ScrollProgress";

export function AppShell({ children }: PropsWithChildren) {
  const { t } = useTranslation();
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);

  const handleClearAll = () => {
    setNotifications([]);
  };

  const handleCloseNotif = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Mouse-tracking glow effect on cards
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.pathname]);

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      const cards = document.querySelectorAll<HTMLElement>('.surface-card, .receiver-card, .chamber-node-luxe');
      cards.forEach(card => {
        const rect = card.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        card.style.setProperty('--mouse-x', `${x}%`);
        card.style.setProperty('--mouse-y', `${y}%`);
      });
    }

    function handleScroll() {
      setIsScrolled(window.scrollY > 20);
    }

    document.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('scroll', handleScroll);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const navItems = [
    { path: "/", label: t("modeNav") },
    { path: "/receive", label: t("dashboardNav") },
    { path: "/admin", label: t("admin") },
  ];

  return (
    <div className="app-shell">
      <ScrollProgress />
      {/* Floating ambient orbs */}
      <div className="ambient-orbs" aria-hidden="true">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      <motion.header 
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
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

      {/* Spacer to prevent content overlap with fixed header */}
      <div className="header-spacer" style={{ height: 'calc(100px + 1.5rem)' }} />

      <OfflineBanner />
      <ToastCenter />
      
      <main className="shell-content">
        {children}
      </main>

      <NotificationButton count={notifications.length} onClick={() => setShowNotification(!showNotification)} />

      <AnimatePresence>
        {showNotification && (
          <NotificationPanel 
            notifications={notifications}
            onClearAll={handleClearAll}
            onCloseNotif={handleCloseNotif}
            onClose={() => setShowNotification(false)} 
          />
        )}
      </AnimatePresence>

      <HelpWidget />
    </div>
  );
}
