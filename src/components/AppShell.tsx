import { useEffect, type PropsWithChildren } from "react";
import { NavLink } from "react-router-dom";
import { CinematicSplash } from "./CinematicSplash";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeControls } from "./ThemeControls";
import { OfflineBanner } from "./OfflineBanner";
import { RouteTransitionV2 } from "./RouteTransitionV2";
import { ToastCenter } from "./ToastCenter";
import { useTranslation } from "../store/useTranslation";

export function AppShell({ children }: PropsWithChildren) {
  const { t } = useTranslation();

  // Mouse-tracking glow effect on cards
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
    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="app-shell">
      {/* Floating ambient orbs */}
      <div className="ambient-orbs" aria-hidden="true">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      <header className="shell-header glass-panel">
        <CinematicSplash />
        <div className="header-brand-stack">
          <h1>{t("brand")}</h1>
          <p className="eyebrow">{t("shellEyebrow")}</p>
        </div>
        <nav className="top-nav">
          <NavLink to="/">{t("modeNav")}</NavLink>
          <NavLink to="/receive">{t("dashboardNav")}</NavLink>
          <NavLink to="/admin">{t("admin")}</NavLink>
        </nav>
        <div className="shell-actions">
          <LanguageSwitcher />
          <ThemeControls />
        </div>
      </header>
      <OfflineBanner />
      <ToastCenter />
      <main className="shell-content">
        {children}
      </main>
    </div>
  );
}
