import React, { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity } from "lucide-react";
import { StatusPill } from "../../components/StatusPill";
import { getQualityLabel } from "../../utils/safety";
import { useTranslation } from "../../store/useTranslation";
import { toLocalDigits } from "../../utils/format";
import type { LockerState } from "../../types/domain";

export interface ChamberCardProps {
  locker: LockerState;
  safeNum: string;
  isActive: boolean;
  onSelect: (lockerId: string) => void;
}

/**
 * ChamberCard
 * Memoized chamber selector card with uniform height and styling.
 * Custom equality check ensures telemetry jitter does NOT trigger re-renders
 * unless occupancy, quality score, or active selection changes.
 */
export const ChamberCard = memo(function ChamberCard({
  locker,
  safeNum,
  isActive,
  onSelect
}: ChamberCardProps) {
  const { t, locale } = useTranslation();
  const rawNum = locker.lockerId.split("-")[1] || "00";
  const localSafeNum = toLocalDigits(safeNum, locale);
  const unitTag = `SAFE_${toLocalDigits(rawNum, locale)}`;
  const pillValue = locker.occupancyState === "maintenance" ? "empty" : locker.occupancyState;
  const pillTone = locker.occupancyState === "occupied" ? "warning" : "success";

  return (
    <motion.button
      whileHover={{ y: -5, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`chamber-node-luxe ${isActive ? "active" : ""} is-${locker.occupancyState}`}
      onClick={() => onSelect(locker.lockerId)}
    >
        <div className="chamber-node-inner">
          <div className="chamber-node-number">{localSafeNum}</div>
          <div className="chamber-node-info">
            <div className="chamber-header-row">
              <span className="chamber-label">{t("safe", "SAFE")}</span>
              <div className="chamber-node-tag">{unitTag}</div>
            </div>
            <strong className="chamber-id">{localSafeNum}</strong>

            <div className="chamber-status-stack">
              <StatusPill value={pillValue} tone={pillTone} />

              <AnimatePresence>
                {locker.occupancyState === "occupied" && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className={`quality-mini-pill ${locker.foodQualityScore}`}
                  >
                    <Activity size={8} />
                    {t(locker.foodQualityScore) || getQualityLabel(locker.foodQualityScore).toUpperCase()}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {isActive && (
          <motion.div
            layoutId="active-ring"
            className="chamber-active-ring"
            initial={false}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        )}

        <div className="chamber-node-glow" />
        <div className="scanline-effect" />
        <div className="corner-decor top-right" />
        <div className="corner-decor bottom-left" />
      </motion.button>
  );
}, (prev, next) => {
  return (
    prev.isActive === next.isActive &&
    prev.safeNum === next.safeNum &&
    prev.locker.lockerId === next.locker.lockerId &&
    prev.locker.occupancyState === next.locker.occupancyState &&
    prev.locker.foodQualityScore === next.locker.foodQualityScore &&
    prev.locker.lockState === next.locker.lockState &&
    prev.locker.doorState === next.locker.doorState
  );
});
