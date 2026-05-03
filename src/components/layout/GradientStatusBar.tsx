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
      gradientFrom: locale === 'en' ? '#14B8A6' : locale === 'hi' ? '#F59E0B' : '#6366f1',
      gradientTo: locale === 'en' ? '#0D9488' : locale === 'hi' ? '#B45309' : '#4338ca',
      onClick: () => dispatch({ type: "set-locale", locale }),
      isActive: state.locale === locale
    })),
    {
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
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
