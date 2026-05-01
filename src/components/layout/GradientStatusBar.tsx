import React from 'react';
import { motion } from 'framer-motion';
import { useAppContext } from "@/store/AppContext";
import { useTranslation } from "@/store/useTranslation";
import type { LocaleCode } from "@/types/domain";
import { Moon, Sun } from 'lucide-react';

interface GradientActionItem {
  id: string;
  label: string;
  display: string;
  icon?: React.ReactNode;
  gradientFrom: string;
  gradientTo: string;
  onClick: () => void;
  isActive?: boolean;
}

export function GradientStatusBar() {
  const { state, dispatch } = useAppContext();
  const { t } = useTranslation();

  const locales: LocaleCode[] = ["en", "hi", "mr"];
  
  const items: GradientActionItem[] = [
    ...locales.map((locale) => ({
      id: locale,
      label: locale === 'en' ? 'English' : locale === 'hi' ? 'Hindi' : 'Marathi',
      display: locale.toUpperCase(),
      gradientFrom: locale === 'en' ? '#34d399' : locale === 'hi' ? '#fbbf24' : '#818cf8',
      gradientTo: locale === 'en' ? '#059669' : locale === 'hi' ? '#d97706' : '#4f46e5',
      onClick: () => dispatch({ type: "set-locale", locale }),
      isActive: state.locale === locale
    })),
    {
      id: 'theme',
      label: state.themeMode === 'dark' ? t("lightMode") : t("darkMode"),
      display: state.themeMode === 'dark' ? 'DARK' : 'LIGHT',
      icon: state.themeMode === 'dark' ? <Moon size={14} /> : <Sun size={14} />,
      gradientFrom: state.themeMode === 'dark' ? '#475569' : '#fcd34d',
      gradientTo: state.themeMode === 'dark' ? '#1e293b' : '#f59e0b',
      onClick: () => dispatch({
        type: "set-theme-mode",
        themeMode: state.themeMode === "dark" ? "light" : "dark"
      }),
      isActive: false
    }
  ];

  return (
    <div className="gradient-status-bar-luxe">
      <ul className="action-list-luxe">
        {items.map(({ id, label, display, icon, gradientFrom, gradientTo, onClick, isActive }) => (
          <motion.li
            key={id}
            onClick={onClick}
            whileHover="hover"
            whileTap={{ scale: 0.92 }}
            initial={false}
            style={{ 
              '--gradient-from': gradientFrom, 
              '--gradient-to': gradientTo 
            } as React.CSSProperties}
            className={`action-pill-luxe ${isActive ? 'is-active' : ''}`}
          >
            {/* Background Glow */}
            <motion.div 
              className="pill-glow"
              variants={{
                hover: { opacity: 0.4, scale: 1.1 }
              }}
            />
            
            {/* Gradient Fill */}
            <motion.div 
              className="pill-bg"
              variants={{
                hover: { opacity: 1 }
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
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
