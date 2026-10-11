import { useState, useEffect, useCallback, useRef } from "react";
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
 * Zero-collision tooltip placement engine.
 * STRICT GUARANTEE: Tooltip NEVER overlaps the spotlight frame under any circumstance.
 */
function computeTooltipPosition(
  target: RectBounds,
  preferredPos: "top" | "bottom" | "left" | "right" | "auto" = "bottom",
  dimensions: CardDimensions = { width: 390, height: 260 }
): TooltipPosition {
  const zoom = getHtmlZoom();
  const winW = window.innerWidth / zoom;
  const winH = window.innerHeight / zoom;
  const margin = 16;
  const gap = 20; // safe clearance between spotlight frame and tooltip

  const tooltipW = Math.min(dimensions.width || 390, winW - margin * 2);
  const tooltipH = dimensions.height || 260;

  // STRICT GUARANTEES:
  // makeBottom: top MUST be >= target.top + target.height + gap (NEVER overlaps target!)
  const makeBottom = (): TooltipPosition => {
    const top = target.top + target.height + gap;
    const idealLeft = target.left + (target.width - tooltipW) / 2;
    const left = Math.max(margin, Math.min(winW - tooltipW - margin, idealLeft));
    return { top: Math.round(top), left: Math.round(left), placement: "bottom" };
  };

  // makeTop: top + tooltipH MUST be <= target.top - gap (NEVER overlaps target!)
  const makeTop = (): TooltipPosition => {
    const top = target.top - gap - tooltipH;
    const idealLeft = target.left + (target.width - tooltipW) / 2;
    const left = Math.max(margin, Math.min(winW - tooltipW - margin, idealLeft));
    return { top: Math.round(top), left: Math.round(left), placement: "top" };
  };

  const makeRight = (): TooltipPosition => {
    const left = target.left + target.width + gap;
    const idealTop = target.top + (target.height - tooltipH) / 2;
    const top = Math.max(margin, Math.min(winH - tooltipH - margin, idealTop));
    return { top: Math.round(top), left: Math.round(left), placement: "right" };
  };

  const makeLeft = (): TooltipPosition => {
    const left = target.left - gap - tooltipW;
    const idealTop = target.top + (target.height - tooltipH) / 2;
    const top = Math.max(margin, Math.min(winH - tooltipH - margin, idealTop));
    return { top: Math.round(top), left: Math.round(left), placement: "left" };
  };

  const spaceBelow = winH - margin - (target.top + target.height + gap);
  const spaceAbove = target.top - gap - margin;
  const spaceRight = winW - margin - (target.left + target.width + gap);
  const spaceLeft = target.left - gap - margin;

  const fitsBottom = spaceBelow >= tooltipH;
  const fitsTop = spaceAbove >= tooltipH;
  const fitsRight = spaceRight >= tooltipW;
  const fitsLeft = spaceLeft >= tooltipW;

  // 1. Try preferred position if it fits inside viewport without overlap
  if (preferredPos === "bottom" && fitsBottom) return makeBottom();
  if (preferredPos === "top" && fitsTop) return makeTop();
  if (preferredPos === "right" && fitsRight) return makeRight();
  if (preferredPos === "left" && fitsLeft) return makeLeft();

  // 2. Check alternative sides that fit inside viewport
  if (preferredPos === "right" || preferredPos === "left") {
    if (fitsRight) return makeRight();
    if (fitsLeft) return makeLeft();
    if (fitsBottom) return makeBottom();
    if (fitsTop) return makeTop();
  } else {
    if (fitsBottom) return makeBottom();
    if (fitsTop) return makeTop();
    if (fitsRight) return makeRight();
    if (fitsLeft) return makeLeft();
  }

  // 3. Fallback: neither side fits entirely within viewport height.
  // Choose whichever side has MORE space, while STILL STRICTLY GUARANTEEING ZERO OVERLAP!
  if (spaceBelow >= spaceAbove) {
    return makeBottom();
  } else {
    return makeTop();
  }
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
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTransitioningRef = useRef(false);
  const currentElementRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const [tooltipDimensions, setTooltipDimensions] = useState<CardDimensions>({
    width: 390,
    height: 260
  });

  const steps: TourStep[] = activePath === "donor" ? getDonorTourSteps(t) : getReceiverTourSteps(t);
  const currentStep = activePath ? steps[currentStepIndex] : null;

  // Measure rendered tooltip dimensions dynamically when step changes
  useEffect(() => {
    if (tooltipRef.current) {
      const zoom = getHtmlZoom();
      const rect = tooltipRef.current.getBoundingClientRect();
      const w = Math.round(rect.width / zoom);
      const h = Math.round(rect.height / zoom);
      if (w > 100 && h > 100) {
        setTooltipDimensions({ width: w, height: h });
      }
    }
  }, [currentStepIndex, activePath]);

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
    isTransitioningRef.current = false;
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
      isTransitioningRef.current = true;
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

        isTransitioningRef.current = true;
        if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
        transitionTimeoutRef.current = setTimeout(() => {
          isTransitioningRef.current = false;
        }, 400);

        if (!isFixed) {
          const rect = element.getBoundingClientRect();
          const winH = window.innerHeight;
          const pref = currentStep.position || "bottom";
          const neededSpaceBelow = rect.height + 20 + 260;

          // Intelligently position viewport so BOTH target element AND tooltip card are comfortably visible
          const needsScroll = 
            (pref === "bottom" && (rect.top < 90 || rect.top + neededSpaceBelow > winH - 20)) ||
            (pref === "top" && (rect.top - 260 - 20 < 90 || rect.bottom > winH - 80)) ||
            (rect.top < 80 || rect.bottom > winH - 80);

          if (needsScroll) {
            if (pref === "bottom") {
              // Position element near the top (below fixed header ~100px) so the tooltip has maximum room below it
              const targetScroll = Math.max(0, window.scrollY + rect.top - 105);
              window.scrollTo({ top: targetScroll, behavior: "smooth" });
            } else if (pref === "top") {
              const targetScroll = Math.max(0, window.scrollY + rect.bottom - (winH - 50));
              window.scrollTo({ top: targetScroll, behavior: "smooth" });
            } else {
              try {
                element.scrollIntoView({ behavior: "smooth", block: "center" });
              } catch {
                element.scrollIntoView(true);
              }
            }
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
            top: Math.max(6, Math.round(top)),
            left: Math.max(6, Math.round(left)),
            width: Math.min(winW - left - 6, Math.round(width)),
            height: Math.min(winH - top - 6, Math.round(height))
          });
        };

        measureTarget();
        // Settle updates smoothly after potential scroll
        setTimeout(measureTarget, 160);
        setTimeout(measureTarget, 360);
      } else if (attempts < maxAttempts) {
        retryTimerRef.current = setTimeout(findAndPosition, 60);
      } else {
        // Fallback: center in screen
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

  // ── Passive Throttled Scroll / Resize Tracking (Zero Lag) ──
  useEffect(() => {
    if (!activePath) return;

    let ticking = false;
    const handleScrollOrResize = () => {
      // Pause updates while transitioning steps to avoid animation fighting
      if (isTransitioningRef.current) return;

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

            const newTop = Math.max(6, Math.round(top));
            const newLeft = Math.max(6, Math.round(left));
            const newWidth = Math.min(winW - left - 6, Math.round(width));
            const newHeight = Math.min(winH - top - 6, Math.round(height));

            setTargetRect(prev => {
              if (
                !prev ||
                Math.abs(prev.top - newTop) > 2 ||
                Math.abs(prev.left - newLeft) > 2 ||
                Math.abs(prev.width - newWidth) > 2 ||
                Math.abs(prev.height - newHeight) > 2
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
      if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
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
    ? computeTooltipPosition(targetRect, currentStep?.position, tooltipDimensions)
    : {
        top: Math.max(16, Math.round((window.innerHeight - 270) / 2)),
        left: Math.max(16, Math.round((window.innerWidth - 380) / 2)),
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

      {/* 2. Hardware-Accelerated Spotlight Frame (Box-Shadow Cutout, 60fps locked) */}
      <AnimatePresence>
        {activePath && targetRect && (
          <motion.div
            key="spotlight-frame-container"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="tour-spotlight-backdrop"
          >
            <div
              className="tour-spotlight-frame"
              style={{
                top: `${targetRect.top}px`,
                left: `${targetRect.left}px`,
                width: `${targetRect.width}px`,
                height: `${targetRect.height}px`,
              }}
            >
              <div className="tour-frame-border" />
              <div className="tour-frame-pulse" />
              <div className="tour-frame-corner top-left" />
              <div className="tour-frame-corner top-right" />
              <div className="tour-frame-corner bottom-left" />
              <div className="tour-frame-corner bottom-right" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Floating Interactive Tooltip Card (Zero-Overlap Guaranteed, Fluid Gliding) */}
      <AnimatePresence>
        {activePath && currentStep && (
          <motion.div
            key="tour-tooltip-wrap"
            className="tour-tooltip-wrap"
            style={{
              top: `${tooltipCoords.top}px`,
              left: `${tooltipCoords.left}px`
            }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25 }}
          >
            <div className="tour-tooltip-card" ref={tooltipRef}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                >
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
                </motion.div>
              </AnimatePresence>

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
