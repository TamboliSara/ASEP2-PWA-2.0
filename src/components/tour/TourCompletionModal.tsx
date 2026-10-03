import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ArrowRight, Heart } from "lucide-react";
import type { TourCompletionData } from "./tourConfig";

interface TourCompletionModalProps {
  isOpen: boolean;
  data: TourCompletionData;
  onReturnToMainMenu: () => void;
}

export function TourCompletionModal({ isOpen, data, onReturnToMainMenu }: TourCompletionModalProps) {
  if (!isOpen) return null;

  const confettiParticles = [
    { left: "10%", delay: "0s", emoji: "✨" },
    { left: "25%", delay: "0.8s", emoji: "🍃" },
    { left: "40%", delay: "1.6s", emoji: "💖" },
    { left: "60%", delay: "0.4s", emoji: "🌟" },
    { left: "75%", delay: "1.2s", emoji: "🌿" },
    { left: "90%", delay: "2s", emoji: "✨" }
  ];

  return (
    <AnimatePresence>
      <div className="tour-completion-overlay">
        <motion.div
          className="tour-completion-card"
          initial={{ opacity: 0, scale: 0.88, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", damping: 24, stiffness: 260 }}
        >
          {/* Animated Ambient Confetti */}
          <div className="tour-confetti-host" aria-hidden="true">
            {confettiParticles.map((p, i) => (
              <span
                key={i}
                className="tour-confetti-particle"
                style={{ left: p.left, animationDelay: p.delay }}
              >
                {p.emoji}
              </span>
            ))}
          </div>

          {/* Celebratory Icon Avatar */}
          <div className="tour-completion-badge-wrap">
            <motion.div
              className="tour-completion-avatar"
              animate={{ rotate: [0, -6, 6, -3, 3, 0], scale: [1, 1.08, 1] }}
              transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 1 }}
            >
              {data.celebrationEmoji}
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <h2 className="tour-completion-title">{data.title}</h2>
            <p className="tour-completion-subtitle">{data.subtitle}</p>
          </motion.div>

          <motion.div
            className="tour-completion-quote"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            {data.quote}
          </motion.div>

          <motion.button
            className="tour-completion-btn"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onReturnToMainMenu}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <span>{data.buttonLabel}</span>
            <ArrowRight size={18} />
          </motion.button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
