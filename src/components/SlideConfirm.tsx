import { useRef, useState, useMemo } from "react";
import { motion, useMotionValue, useTransform, useDragControls, AnimatePresence } from "framer-motion";
import { Check, ChevronRight } from "lucide-react";

interface SlideConfirmProps {
  label: string;
  completedLabel?: string;
  disabled?: boolean;
  onConfirm: () => void | Promise<void>;
  className?: string;
}

export function SlideConfirm({ label, completedLabel = "Confirmed", disabled, onConfirm, className = "" }: SlideConfirmProps) {
  const [completed, setCompleted] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const dragControls = useDragControls();

  const dragWidth = useMemo(() => {
    if (!trackRef.current) return 200;
    return trackRef.current.clientWidth - 58; // 52px thumb + 3px padding each side
  }, [trackRef.current?.clientWidth]);

  // Dynamic transforms for premium feel
  const opacity = useTransform(x, [0, dragWidth * 0.7], [1, 0.1]);
  const progressWidth = useTransform(x, (v) => v + 52);
  const trackColor = useTransform(x, [0, dragWidth], ["rgba(255,255,255,0.03)", "rgba(20,184,166,0.1)"]);
  const thumbRotate = useTransform(x, [0, dragWidth], [0, 180]);
  const labelX = useTransform(x, [0, dragWidth], [0, 20]);

  const handleDragEnd = async () => {
    const currentX = x.get();
    if (currentX >= dragWidth * 0.95) {
      setCompleted(true);
      x.set(dragWidth);
      await onConfirm();
      setTimeout(() => {
        setCompleted(false);
        x.set(0);
      }, 2000);
    } else {
      x.set(0);
    }
  };

  return (
    <div 
      ref={trackRef}
      className={`premium-slider-container ${className} ${disabled ? "is-disabled" : ""} ${completed ? "is-complete" : ""}`}
    >
      {/* Dynamic Background Fill */}
      <motion.div 
        className="slider-progress-fill"
        style={{ width: progressWidth, backgroundColor: trackColor as any }}
      />

      {/* Shimmering Label */}
      <motion.div 
        className="slider-label-wrapper"
        style={{ opacity, x: labelX }}
      >
        <span className="slider-label-text">
          {completed ? completedLabel : label}
        </span>
        {!completed && <div className="label-shimmer" />}
      </motion.div>

      {/* The Thumb */}
      <motion.div
        drag="x"
        dragControls={dragControls}
        dragConstraints={{ left: 0, right: dragWidth }}
        dragElastic={0.02}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className="slider-thumb-premium"
      >
        <div className="thumb-content">
          <AnimatePresence mode="wait">
            {completed ? (
              <motion.div
                key="check"
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0 }}
              >
                <Check className="w-6 h-6 text-black" strokeWidth={3} />
              </motion.div>
            ) : (
              <motion.div
                key="arrow"
                style={{ rotate: thumbRotate }}
                className="flex items-center justify-center"
              >
                <ChevronRight className="w-6 h-6 text-black" strokeWidth={3} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Thumb Aura/Glow */}
        <motion.div 
          className="thumb-aura"
          style={{ 
            opacity: useTransform(x, [0, dragWidth], [0.2, 0.8]),
            scale: useTransform(x, [0, dragWidth], [1, 1.4])
          }}
        />
      </motion.div>

      <style>{`
        .premium-slider-container {
          position: relative;
          width: 100%;
          height: 60px;
          background: rgba(0, 0, 0, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 30px;
          display: flex;
          align-items: center;
          padding: 4px;
          overflow: hidden;
          backdrop-filter: blur(20px);
          user-select: none;
          box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.1);
        }

        :root[data-theme-mode="light"] .premium-slider-container {
          background: rgba(255, 255, 255, 0.4);
          border-color: rgba(0, 0, 0, 0.05);
        }

        .slider-progress-fill {
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          z-index: 0;
          border-radius: 30px;
          transition: background-color 0.3s ease;
        }

        .slider-label-wrapper {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1;
          padding: 0 20px 0 60px;
          pointer-events: none;
        }

        .slider-label-text {
          font-size: 0.7rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          color: var(--text);
          opacity: 0.6;
        }

        .label-shimmer {
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
          background-size: 200% 100%;
          animation: shimmer 2.5s infinite linear;
          mix-blend-mode: overlay;
        }

        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }

        .slider-thumb-premium {
          width: 52px;
          height: 52px;
          background: var(--accent);
          border-radius: 26px;
          cursor: grab;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 3;
          box-shadow: 
            0 4px 15px rgba(var(--accent-rgb), 0.4),
            inset 0 2px 2px rgba(255, 255, 255, 0.4);
          position: relative;
        }

        .slider-thumb-premium:active { cursor: grabbing; }

        .thumb-content {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .thumb-aura {
          position: absolute;
          inset: -4px;
          background: var(--accent);
          filter: blur(12px);
          border-radius: 50%;
          z-index: 1;
          pointer-events: none;
        }

        .premium-slider-container.is-complete {
          border-color: var(--accent);
        }

        .premium-slider-container.is-disabled {
          opacity: 0.3;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
