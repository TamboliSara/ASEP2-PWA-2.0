import React from 'react';
import { motion } from 'framer-motion';
import { useAppContext } from "@/store/AppContext";
import { useTranslation } from "@/store/useTranslation";
import { HARDWARE_LOCKER_ID } from "@/store/appState";
import type { LocaleCode } from "@/types/domain";
import { Moon, Sun, Box, PlaneTakeoff, Bluetooth } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

interface GradientActionItem {
  id: string;
  label: string;
  display: string;
  icon?: React.ReactNode;
  gradientFrom: string;
  gradientTo: string;
  onClick: () => void;
  isActive?: boolean;
  tourId?: string;
}

export function GradientStatusBar() {
  const { state, dispatch } = useAppContext();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const hardwareLocker = state.lockers.find(l => l.lockerId === HARDWARE_LOCKER_ID);
  const isDeviceConnected = Boolean(
    hardwareLocker?.bleConnected || 
    (hardwareLocker?.lastSyncedAt && (Date.now() - new Date(hardwareLocker.lastSyncedAt).getTime() < 45000)) ||
    (state.hasCompletedPairing && state.hardwareMac && state.hardwareMac !== "SIMULATED")
  );
  const macSuffix = state.hardwareMac && state.hardwareMac !== "SIMULATED" ? state.hardwareMac.slice(-4) : "3D4C";

  const locales: LocaleCode[] = ["en", "hi", "mr"];
  
  const navItems: GradientActionItem[] = [
    {
      id: 'esp32',
      label: isDeviceConnected ? `ESP32 (${macSuffix})` : 'PAIR ESP32',
      display: 'BT',
      icon: <Bluetooth size={15} strokeWidth={2.2} className="nav-bluetooth-icon" />,
      gradientFrom: isDeviceConnected ? '#10B981' : '#EF4444',
      gradientTo: isDeviceConnected ? '#059669' : '#DC2626',
      onClick: () => navigate('/connect'),
      isActive: location.pathname === '/connect',
      tourId: 'nav-esp32'
    },
    {
      id: 'tour',
      label: 'WEBSITE TOUR',
      display: 'TOUR',
      icon: <PlaneTakeoff size={15} strokeWidth={2.2} className="tour-plane-icon" />,
      gradientFrom: '#14B8A6',
      gradientTo: '#0D9488',
      onClick: () => window.dispatchEvent(new CustomEvent('start-website-tour')),
      isActive: false,
      tourId: 'nav-tour-trigger'
    },
    {
      id: 'visualizer',
      label: '3D MODEL',
      display: '3D',
      icon: <Box size={15} strokeWidth={2.2} />,
      gradientFrom: '#EC4899',
      gradientTo: '#BE185D',
      onClick: () => navigate('/visualizer'),
      isActive: location.pathname === '/visualizer',
      tourId: 'nav-3d-model'
    }
  ];

  const languageItems: GradientActionItem[] = locales.map((locale) => ({
    id: locale,
    label: locale === 'en' ? 'English' : locale === 'hi' ? 'Hindi' : 'Marathi',
    display: locale.toUpperCase(),
    gradientFrom: locale === 'en' ? '#14B8A6' : locale === 'hi' ? '#F59E0B' : '#6366f1',
    gradientTo: locale === 'en' ? '#0D9488' : locale === 'hi' ? '#B45309' : '#4338ca',
    onClick: () => dispatch({ type: "set-locale", locale }),
    isActive: state.locale === locale,
    tourId: undefined
  }));

  const themeItem: GradientActionItem = {
    id: 'theme',
    label: state.themeMode === 'dark' ? t("lightMode") : t("darkMode"),
    display: state.themeMode === 'dark' ? 'DARK' : 'LIGHT',
    icon: state.themeMode === 'dark' ? <Moon size={14} /> : <Sun size={14} />,
    gradientFrom: state.themeMode === 'dark' ? '#334155' : '#FCD34D',
    gradientTo: state.themeMode === 'dark' ? '#0F172A' : '#F59E0B',
    onClick: () => dispatch({
      type: "set-theme-mode",
      themeMode: state.themeMode === "dark" ? "light" : "dark"
    }),
    isActive: false,
    tourId: 'nav-theme-toggle'
  };

  const renderPill = (
    { id, label, display, icon, gradientFrom, gradientTo, onClick, isActive, tourId }: GradientActionItem,
    as: 'li' | 'div' = 'li'
  ) => {
    const Component = as === 'li' ? motion.li : motion.div;
    return (
      <Component
        key={id}
        data-tour={tourId}
        onClick={onClick}
        whileHover="hover"
        whileTap={{ scale: 0.92 }}
        initial={false}
        style={{ 
          '--gradient-from': gradientFrom, 
          '--gradient-to': gradientTo 
        } as React.CSSProperties}
        className={`action-pill-luxe action-pill-${id} ${isActive ? 'is-active' : ''}`}
      >
        {/* Background Glow */}
        <motion.div 
          className="pill-glow"
          variants={{
            hover: { opacity: 0.7, scale: 1.2, filter: "blur(20px)" }
          }}
        />
        
        {/* Gradient Fill */}
        <motion.div 
          className="pill-bg"
          variants={{
            hover: { opacity: 1, scale: 1.05 }
          }}
          style={{
            opacity: isActive ? 1 : 0
          }}
        />

        {/* Content Container */}
        <div className="pill-content">
          <motion.div 
            className="pill-short"
            variants={{
              hover: { scale: 0, opacity: 0 }
            }}
          >
            {icon || display}
          </motion.div>

          <motion.div 
            className="pill-full"
            variants={{
              hover: { scale: 1, opacity: 1, x: 0 }
            }}
            initial={{ scale: 0.5, opacity: 0, x: -10 }}
          >
            {label}
          </motion.div>
        </div>

        {/* Active Indicator Ring */}
        {isActive && (
          <motion.div 
            layoutId="active-pill-ring"
            className="pill-ring"
            transition={{ type: "spring", bounce: 0.3, duration: 0.6 }}
          />
        )}
      </Component>
    );
  };

  return (
    <div className="gradient-status-bar-luxe" data-tour="nav-capsule-bar">
      <ul className="action-list-luxe">
        {navItems.map(item => renderPill(item, 'li'))}
        
        {/* Multilingual Access Cluster (English, Hindi, Marathi) */}
        <li 
          className="action-language-cluster" 
          data-tour="universal-language"
          title="Multilingual Access: English (EN), Hindi (HI), Marathi (MR)"
        >
          {languageItems.map(item => renderPill(item, 'div'))}
        </li>

        {renderPill(themeItem, 'li')}
      </ul>
    </div>
  );
}
