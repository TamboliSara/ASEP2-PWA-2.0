import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HeartHandshake, Utensils, Compass, Sparkles, ArrowRight } from "lucide-react";
import type { TourPath } from "./tourConfig";

interface TourPromptModalProps {
  isOpen: boolean;
  onSelectPath: (path: TourPath) => void;
  onDismiss: () => void;
}

export function TourPromptModal({ isOpen, onSelectPath, onDismiss }: TourPromptModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="tour-prompt-overlay" onClick={onDismiss}>
        <motion.div
          className="tour-prompt-modal"
          initial={{ opacity: 0, scale: 0.9, y: 25 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 280 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="tour-prompt-glow" />

          <div className="tour-prompt-badge">
            <Sparkles size={13} />
            <span>Interactive Onboarding</span>
          </div>

          <h2 className="tour-prompt-title">Welcome to SAFE Kiosk</h2>
          <p className="tour-prompt-subtitle">
            Smart Automated Food Exchange — fighting food waste while ensuring verified community food safety. What brings you here today?
          </p>

          <div className="tour-prompt-cards">
            {/* Donor Option */}
            <motion.div
              className="tour-role-card role-donor"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelectPath("donor")}
            >
              <div className="tour-role-icon">🎁</div>
              <div className="tour-role-name">I Want to Donate</div>
              <div className="tour-role-desc">
                Safely deposit surplus fresh meals into an automated climate-monitored locker compartment.
              </div>
              <button className="tour-role-btn">
                <span>Start Donor Tour</span>
                <ArrowRight size={14} />
              </button>
            </motion.div>

            {/* Receiver Option */}
            <motion.div
              className="tour-role-card role-receiver"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelectPath("receiver")}
            >
              <div className="tour-role-icon">🍴</div>
              <div className="tour-role-name">I Want to Retrieve</div>
              <div className="tour-role-desc">
                Browse verified, ready-to-consume food items and securely collect them with face recognition.
              </div>
              <button className="tour-role-btn">
                <span>Start Receiver Tour</span>
                <ArrowRight size={14} />
              </button>
            </motion.div>
          </div>

          <button className="tour-skip-btn" onClick={onDismiss}>
            Just exploring • Skip Tour
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
