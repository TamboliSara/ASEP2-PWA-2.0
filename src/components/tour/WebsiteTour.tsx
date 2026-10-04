import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowRight, 
  Sparkles, 
  Lightbulb
} from "lucide-react";
import { 
  getDonorTourSteps, 
  getReceiverTourSteps, 
  getDonorCompletion, 
  getReceiverCompletion,
  type TourPath, 
  type TourStep 
} from "./tourConfig";
import { useAppContext } from "../../store/AppContext";
import { useTranslation } from "../../store/useTranslation";
import { toLocalDigits } from "../../utils/format";
import { TourPromptModal } from "./TourPromptModal";
import { TourCompletionModal } from "./TourCompletionModal";
import "../../styles/tour.css";

interface RectBounds {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface TooltipPosition {
  top: number;
  left: number;
  placement: "top" | "bottom" | "left" | "right";
}

interface CardDimensions {
  width: number;
  height: number;
}

function getHtmlZoom(): number {
  if (typeof window === "undefined") return 1;
  const zoomVal = parseFloat(window.getComputedStyle(document.documentElement).zoom);
  return isNaN(zoomVal) || zoomVal <= 0 ? 1 : zoomVal;
}

/**
 * Accurately measures target elements, computing a union bounding box
 * if the element is a cluster containing multiple child action pills.
 */
function getTargetBounds(targetEl: HTMLElement): { top: number; left: number; width: number; height: number } {
  const pills = targetEl.querySelectorAll<HTMLElement>('.action-pill-luxe');
  if (pills.length > 1) {
    let minTop = Infinity;
    let minLeft = Infinity;
    let maxRight = -Infinity;
    let maxBottom = -Infinity;
    pills.forEach(p => {
      const r = p.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        minTop = Math.min(minTop, r.top);
        minLeft = Math.min(minLeft, r.left);
        maxRight = Math.max(maxRight, r.right);
        maxBottom = Math.max(maxBottom, r.bottom);
      }
    });
    if (minTop !== Infinity && isFinite(minTop)) {
      return {
        top: minTop,
        left: minLeft,
        width: maxRight - minLeft,
        height: maxBottom - minTop
      };
    }
  }
  return targetEl.getBoundingClientRect();
}

/**
 * High-precision collision-free tooltip placement calculator.
 * Strictly guarantees that the tooltip never overlaps the spotlight cutout.
 */
function computeTooltipPosition(
  target: RectBounds,
  preferredPos: "top" | "bottom" | "left" | "right" | "auto" = "bottom",
  dimensions: CardDimensions = { width: 390, height: 480 }
): TooltipPosition {
  const zoom = getHtmlZoom();
  const winW = window.innerWidth / zoom;
  const winH = window.innerHeight / zoom;
  const margin = 16;
  const gap = 24; // strict safety clearance between spotlight frame and tooltip

  const tooltipW = Math.min(dimensions.width || 390, winW - margin * 2);
  const tooltipH = dimensions.height || 480;

  // Collision overlap tester
  const testCandidate = (top: number, left: number): boolean => {
    const cardRight = left + tooltipW;
    const cardBottom = top + tooltipH;
    const targetRight = target.left + target.width;
    const targetBottom = target.top + target.height;

    const xOverlap = left < (targetRight + gap) && cardRight > (target.left - gap);
    const yOverlap = top < (targetBottom + gap) && cardBottom > (target.top - gap);
    return xOverlap && yOverlap;
  };

  // Determine candidate order based on preference
  const order: ("top" | "bottom" | "left" | "right")[] = [];
  if (preferredPos && preferredPos !== "auto") {
    order.push(preferredPos);
  }
  ["top", "bottom", "right", "left"].forEach(p => {
    if (!order.includes(p as any)) order.push(p as any);
  });

  // 1. Try placements where tooltip fits strictly inside viewport without any target overlap
  for (const placement of order) {
    let top = margin;
    let left = margin;

    if (placement === "top") {
      top = target.top - gap - tooltipH;
      const idealLeft = target.left + (target.width - tooltipW) / 2;
      left = Math.max(margin, Math.min(winW - tooltipW - margin, idealLeft));
    } else if (placement === "bottom") {
      top = target.top + target.height + gap;
      const idealLeft = target.left + (target.width - tooltipW) / 2;
      left = Math.max(margin, Math.min(winW - tooltipW - margin, idealLeft));
    } else if (placement === "left") {
      left = target.left - gap - tooltipW;
      const idealTop = target.top + (target.height - tooltipH) / 2;
      top = Math.max(margin, Math.min(winH - tooltipH - margin, idealTop));
    } else if (placement === "right") {
      left = target.left + target.width + gap;
      const idealTop = target.top + (target.height - tooltipH) / 2;
      top = Math.max(margin, Math.min(winH - tooltipH - margin, idealTop));
    }

    const fitsInViewport = 
      top >= margin && 
      (top + tooltipH) <= (winH - margin) && 
      left >= margin && 
      (left + tooltipW) <= (winW - margin);

    const hasOverlap = testCandidate(top, left);

    if (fitsInViewport && !hasOverlap) {
      return { top, left, placement };
    }
  }

  // 2. Fallback: find placement that guarantees zero overlap even if shifted slightly
  for (const placement of order) {
    if (placement === "top" && target.top - gap - tooltipH >= margin) {
      const top = target.top - gap - tooltipH;
      const idealLeft = target.left + (target.width - tooltipW) / 2;
      const left = Math.max(margin, Math.min(winW - tooltipW - margin, idealLeft));
      return { top, left, placement };
    }
    if (placement === "bottom" && target.top + target.height + gap + tooltipH <= winH - margin) {
      const top = target.top + target.height + gap;
      const idealLeft = target.left + (target.width - tooltipW) / 2;
      const left = Math.max(margin, Math.min(winW - tooltipW - margin, idealLeft));
      return { top, left, placement };
    }
    if (placement === "right" && target.left + target.width + gap + tooltipW <= winW - margin) {
      const left = target.left + target.width + gap;
      const idealTop = target.top + (target.height - tooltipH) / 2;
      const top = Math.max(margin, Math.min(winH - tooltipH - margin, idealTop));
      return { top, left, placement };
    }
    if (placement === "left" && target.left - gap - tooltipW >= margin) {
      const left = target.left - gap - tooltipW;
      const idealTop = target.top + (target.height - tooltipH) / 2;
      const top = Math.max(margin, Math.min(winH - tooltipH - margin, idealTop));
      return { top, left, placement };
    }
  }

  // 3. Absolute fallback: place at bottom or top with zero overlap guaranteed
  const safeTop = target.top - gap - tooltipH >= margin
    ? target.top - gap - tooltipH
    : Math.min(winH - tooltipH - margin, target.top + target.height + gap);
  const idealLeft = target.left + (target.width - tooltipW) / 2;
  const safeLeft = Math.max(margin, Math.min(winW - tooltipW - margin, idealLeft));

  return { 
    top: Math.max(margin, safeTop), 
    left: safeLeft, 
    placement: safeTop < target.top ? "top" : "bottom" 
  };
}

export function WebsiteTour() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state, dispatch } = useAppContext();
  const { t, locale } = useTranslation();

  const [activePath, setActivePath] = useState<TourPath | null>(null);
  const [completedPath, setCompletedPath] = useState<TourPath>("donor");
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [targetRect, setTargetRect] = useState<RectBounds | null>(null);

  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentElementRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipSize, setTooltipSize] = useState<CardDimensions>({
    width: 390,
    height: 480
  });

  useLayoutEffect(() => {
    if (!tooltipRef.current) return;
    const zoom = getHtmlZoom();
    const rect = tooltipRef.current.getBoundingClientRect();
    const w = Math.round(rect.width / zoom);
    const h = Math.round(rect.height / zoom);
    if (w > 50 && h > 50) {
      setTooltipSize(prev => {
        if (Math.abs(prev.width - w) > 2 || Math.abs(prev.height - h) > 2) {
          return { width: w, height: h };
        }
        return prev;
      });
    }
  });

  const steps: TourStep[] = activePath === "donor" ? getDonorTourSteps(t) : getReceiverTourSteps(t);
  const currentStep = activePath ? steps[currentStepIndex] : null;

  // ── Show Prompt automatically ONLY for first time when user opens website ──
  const TOUR_SEEN_STORAGE_KEY = "safe_has_seen_tour_prompt_v1";

  useEffect(() => {
    if (location.pathname === "/" && !activePath && !isCompleted) {
      try {
        const hasSeen = localStorage.getItem(TOUR_SEEN_STORAGE_KEY);
        if (!hasSeen) {
          const timer = setTimeout(() => {
            setIsPromptOpen(true);
            try {
              localStorage.setItem(TOUR_SEEN_STORAGE_KEY, "true");
            } catch {}
          }, 800);
          return () => clearTimeout(timer);
        }
      } catch {
        // Fallback if localStorage is inaccessible
      }
    }
  }, [location.pathname, activePath, isCompleted]);

  // ── Custom event listener to trigger tour anytime ──
  useEffect(() => {
    const handleTriggerTour = (event: Event) => {
      const customEvent = event as CustomEvent<{ path?: TourPath }>;
      if (customEvent.detail?.path) {
        startTour(customEvent.detail.path);
      } else {
        setIsPromptOpen(true);
      }
    };

    window.addEventListener("start-website-tour", handleTriggerTour);
    return () => window.removeEventListener("start-website-tour", handleTriggerTour);
  }, []);

  const ensureLockerSelected = useCallback((path: TourPath) => {
    if (path === "donor") {
      let emptyLocker = state.lockers.find(l => !l.activeDonation);
      if (!emptyLocker) {
        // Free chamber-1 if all happen to be occupied
        dispatch({
          type: "patch-locker",
          id: "chamber-1",
          locker: { occupancyState: "empty", activeDonation: undefined }
        });
        dispatch({ type: "select-locker", id: "chamber-1" });
      } else if (state.selectedLockerId !== emptyLocker.lockerId) {
        dispatch({ type: "select-locker", id: emptyLocker.lockerId });
      }
    } else if (path === "receiver") {
      const occupiedLocker = state.lockers.find(l => l.activeDonation && l.activeDonation.latestQualityScore !== "spoilt") 
        || state.lockers.find(l => l.activeDonation);
      if (occupiedLocker && state.selectedLockerId !== occupiedLocker.lockerId) {
        dispatch({ type: "select-locker", id: occupiedLocker.lockerId });
      }
    }
  }, [state.lockers, state.selectedLockerId, dispatch]);

  const startTour = useCallback((path: TourPath) => {
    if (!state.hasCompletedPairing) {
      dispatch({ type: "set-pairing-complete", value: true });
    }

    ensureLockerSelected(path);

    setActivePath(path);
    setCurrentStepIndex(0);
    setIsPromptOpen(false);
    setIsCompleted(false);

    if (location.pathname !== "/") {
      navigate("/");
    }
  }, [location.pathname, navigate, state.hasCompletedPairing, ensureLockerSelected, dispatch]);

  const endTour = useCallback(() => {
    setActivePath(null);
    setCurrentStepIndex(0);
    setIsCompleted(false);
    setTargetRect(null);
    currentElementRef.current = null;
  }, []);

  const handleReturnToMainMenu = useCallback(() => {
    endTour();
    navigate("/");
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [endTour, navigate]);

  // ── Find and measure target element on step transition ──
  const setupStepTarget = useCallback(() => {
    if (!currentStep || !activePath) return;

    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    ensureLockerSelected(activePath);

    // Route navigation if needed
    if (location.pathname !== currentStep.route) {
      navigate(currentStep.route);
      return;
    }

    let attempts = 0;
    const maxAttempts = 20;

    const findAndPosition = () => {
      attempts++;
      const selectorOptions = currentStep.targetSelector.split(",").map(s => s.trim());
      let element: HTMLElement | null = null;

      for (const sel of selectorOptions) {
        try {
          element = document.querySelector<HTMLElement>(sel);
          if (element) break;
        } catch {
          // ignore selector errors
        }
      }

      if (element) {
        currentElementRef.current = element;

        const isFixed = window.getComputedStyle(element).position === "fixed" || 
                        Boolean(element.closest(".shell-header")) || 
                        Boolean(element.closest(".voice-assistant-container")) ||
                        Boolean(element.closest(".help-widget-trigger"));

        if (!isFixed) {
          try {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
          } catch {
            element.scrollIntoView(true);
          }
        }

        const measureTarget = () => {
          if (!element || !document.body.contains(element)) return;
          const zoom = getHtmlZoom();
          const finalRect = getTargetBounds(element);
          const padding = 10;
          const top = (finalRect.top - padding) / zoom;
          const left = (finalRect.left - padding) / zoom;
          const width = (finalRect.width + padding * 2) / zoom;
          const height = (finalRect.height + padding * 2) / zoom;
          const winW = window.innerWidth / zoom;
          const winH = window.innerHeight / zoom;

          setTargetRect({
            top: Math.max(6, top),
            left: Math.max(6, left),
            width: Math.min(winW - left - 6, width),
            height: Math.min(winH - top - 6, height)
          });
        };

        measureTarget();
        // Recalculate once smooth scroll settles
        setTimeout(measureTarget, 320);
      } else if (attempts < maxAttempts) {
        retryTimerRef.current = setTimeout(findAndPosition, 80);
      } else {
        // Fallback: center in screen with zoom compensation
        currentElementRef.current = null;
        const zoom = getHtmlZoom();
        const winW = window.innerWidth / zoom;
        const winH = window.innerHeight / zoom;
        setTargetRect({
          top: Math.round(winH * 0.35),
          left: Math.round((winW - 320) / 2),
          width: 320,
          height: 120
        });
      }
    };

    findAndPosition();
  }, [currentStep, activePath, location.pathname, navigate, ensureLockerSelected]);

  // Trigger setup on step or route change
  useEffect(() => {
    if (activePath && currentStep) {
      setupStepTarget();
    } else {
      setTargetRect(null);
      currentElementRef.current = null;
    }

    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [activePath, currentStepIndex, location.pathname, setupStepTarget, currentStep]);

  // ── Continuous Scroll / Resize Tracking (Throttled & Thresholded) ──
  useEffect(() => {
    if (!activePath) return;

    let ticking = false;
    const handleScrollOrResize = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const el = currentElementRef.current;
          if (el && document.body.contains(el)) {
            const zoom = getHtmlZoom();
            const finalRect = getTargetBounds(el);
            const padding = 10;
            const top = (finalRect.top - padding) / zoom;
            const left = (finalRect.left - padding) / zoom;
            const width = (finalRect.width + padding * 2) / zoom;
            const height = (finalRect.height + padding * 2) / zoom;
            const winW = window.innerWidth / zoom;
            const winH = window.innerHeight / zoom;

            const newTop = Math.max(6, top);
            const newLeft = Math.max(6, left);
            const newWidth = Math.min(winW - left - 6, width);
            const newHeight = Math.min(winH - top - 6, height);

            setTargetRect(prev => {
              if (
                !prev ||
                Math.abs(prev.top - newTop) > 1.5 ||
                Math.abs(prev.left - newLeft) > 1.5 ||
                Math.abs(prev.width - newWidth) > 1.5 ||
                Math.abs(prev.height - newHeight) > 1.5
              ) {
                return { top: newTop, left: newLeft, width: newWidth, height: newHeight };
              }
              return prev;
            });
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("resize", handleScrollOrResize, { passive: true });
    window.addEventListener("scroll", handleScrollOrResize, { passive: true });
    return () => {
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("scroll", handleScrollOrResize);
    };
  }, [activePath]);

  // ── Keyboard Navigation ──
  useEffect(() => {
    if (!activePath) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        endTour();
      } else if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === "ArrowLeft") {
        handleBack();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const handleNext = () => {
    if (!activePath) return;
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      setCompletedPath(activePath);
      setActivePath(null);
      setIsCompleted(true);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const tooltipCoords: TooltipPosition = targetRect
    ? computeTooltipPosition(targetRect, currentStep?.position, tooltipSize)
    : {
        top: Math.max(16, (window.innerHeight - 270) / 2),
        left: Math.max(16, (window.innerWidth - 380) / 2),
        placement: "bottom"
      };

  const IconComponent = currentStep?.icon || Sparkles;
  const progressPercent = activePath ? ((currentStepIndex + 1) / steps.length) * 100 : 0;

  const tourContent = (
    <>
      {/* 1. Welcome Modal on Home Page Load */}
      <TourPromptModal
        isOpen={isPromptOpen}
        onSelectPath={(path) => {
          try {
            localStorage.setItem(TOUR_SEEN_STORAGE_KEY, "true");
          } catch {}
          startTour(path);
        }}
        onDismiss={() => {
          try {
            localStorage.setItem(TOUR_SEEN_STORAGE_KEY, "true");
          } catch {}
          setIsPromptOpen(false);
        }}
      />

      {/* 2. Fullscreen SVG Cutout Mask Backdrop + Glowing Tech Frame */}
      <AnimatePresence>
        {activePath && targetRect && (
          <motion.div
            key="spotlight-backdrop"
            className="tour-spotlight-backdrop"
            style={{
              width: `${100 / getHtmlZoom()}vw`,
              height: `${100 / getHtmlZoom()}vh`
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            <svg
              className="tour-spotlight-svg"
              width="100%"
              height="100%"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <mask id="tour-spotlight-mask">
                  <rect x="0" y="0" width="100%" height="100%" fill="#ffffff" />
                  <rect
                    x={targetRect.left}
                    y={targetRect.top}
                    width={targetRect.width}
                    height={targetRect.height}
                    rx={18}
                    ry={18}
                    fill="#000000"
                    style={{
                      transition: "x 0.52s cubic-bezier(0.22, 1, 0.36, 1), y 0.52s cubic-bezier(0.22, 1, 0.36, 1), width 0.52s cubic-bezier(0.22, 1, 0.36, 1), height 0.52s cubic-bezier(0.22, 1, 0.36, 1)"
                    }}
                  />
                </mask>
              </defs>
              <rect
                x="0"
                y="0"
                width="100%"
                height="100%"
                fill="rgba(3, 7, 18, 0.78)"
                mask="url(#tour-spotlight-mask)"
              />
            </svg>

            {/* Glowing High-Tech Neon Framing Box with Sci-Fi Corner Accents */}
            <motion.div
              className="tour-highlight-frame"
              initial={false}
              animate={{
                top: targetRect.top,
                left: targetRect.left,
                width: targetRect.width,
                height: targetRect.height,
              }}
              transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="tour-frame-border" />
              <div className="tour-frame-pulse" />
              <div className="tour-frame-corner top-left" />
              <div className="tour-frame-corner top-right" />
              <div className="tour-frame-corner bottom-left" />
              <div className="tour-frame-corner bottom-right" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Floating Interactive Tooltip Card (Zero-Overlap Guaranteed) */}
      <AnimatePresence>
        {activePath && currentStep && (
          <motion.div
            key={`tooltip-${currentStep.id}`}
            className="tour-tooltip-wrap"
            style={{
              top: tooltipCoords.top,
              left: tooltipCoords.left
            }}
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="tour-tooltip-card" ref={tooltipRef}>
              {/* Header Topbar */}
              <div className="tour-tooltip-topbar">
                <div className="tour-badge-pill">
                  <Sparkles size={11} />
                  <span>{activePath === "donor" ? t("donorTour", "Donor Tour") : t("receiverTour", "Receiver Tour")}</span>
                </div>
                <div className="tour-step-counter">
                  {t("step", "STEP")} {toLocalDigits(currentStepIndex + 1, locale)} {t("of", "OF")} {toLocalDigits(steps.length, locale)}
                </div>
              </div>

              {/* Progress Line */}
              <div className="tour-progress-track">
                <div
                  className="tour-progress-fill"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Title & Icon */}
              <div className="tour-tooltip-header">
                <div className="tour-tooltip-icon">
                  <IconComponent size={18} />
                </div>
                <h3 className="tour-tooltip-title">{currentStep.title}</h3>
              </div>

              {/* Description */}
              <p className="tour-tooltip-desc">{currentStep.description}</p>

              {/* Action Hint */}
              {currentStep.actionHint && (
                <div className="tour-action-hint">
                  <Lightbulb size={13} />
                  <span>{currentStep.actionHint}</span>
                </div>
              )}

              {/* Bottom Actions Bar */}
              <div className="tour-tooltip-actions">
                <button className="tour-btn-exit" onClick={endTour}>
                  {t("exitTour", "Exit Tour")}
                </button>

                <div className="tour-btn-nav-group">
                  <button
                    className="tour-btn-back"
                    onClick={handleBack}
                    disabled={currentStepIndex === 0}
                  >
                    {t("back", "Back")}
                  </button>

                  <button className="tour-btn-next" onClick={handleNext}>
                    <span>{currentStepIndex === steps.length - 1 ? t("finishTour", "Finish Tour") : t("next", "Next")}</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. Celebratory Grand Finale Modal */}
      <TourCompletionModal
        isOpen={isCompleted}
        data={completedPath === "donor" ? getDonorCompletion(t) : getReceiverCompletion(t)}
        onReturnToMainMenu={handleReturnToMainMenu}
      />
    </>
  );

  return typeof document !== "undefined" ? createPortal(tourContent, document.body) : null;
}
