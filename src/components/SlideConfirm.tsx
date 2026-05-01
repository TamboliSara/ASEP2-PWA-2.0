import { useEffect, useMemo, useRef, useState } from "react";

interface SlideConfirmProps {
  label: string;
  completedLabel?: string;
  disabled?: boolean;
  onConfirm: () => void | Promise<void>;
  className?: string;
}

export function SlideConfirm({ label, completedLabel = "Confirmed", disabled, onConfirm, className = "" }: SlideConfirmProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [completed, setCompleted] = useState(false);
  const pointerOffsetRef = useRef(28);

  const maxOffset = useMemo(() => {
    const width = trackRef.current?.clientWidth ?? 0;
    return Math.max(width - 56, 0);
  }, [trackRef.current?.clientWidth]);

  useEffect(() => {
    if (disabled) {
      setDragging(false);
      setCompleted(false);
      setProgress(0);
    }
  }, [disabled]);

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      if (!dragging || !trackRef.current) {
        return;
      }

      const rect = trackRef.current.getBoundingClientRect();
      const thumbWidth = 56;
      const raw = event.clientX - rect.left - pointerOffsetRef.current;
      const next = Math.max(0, Math.min(raw, rect.width - thumbWidth));
      setProgress(next);
    }

    async function handlePointerUp() {
      if (!dragging) {
        return;
      }

      setDragging(false);
      if (trackRef.current && progress >= (trackRef.current.clientWidth - 56) * 0.72) {
        const finalX = trackRef.current.clientWidth - 56;
        setCompleted(true);
        setProgress(finalX);
        
        // Pass the final position to CSS for the bounce animation
        trackRef.current.style.setProperty("--slide-final-x", `${finalX}px`);
        
        await onConfirm();
        window.setTimeout(() => {
          setCompleted(false);
          setProgress(0);
        }, 800);
      } else {
        setProgress(0);
      }
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragging, onConfirm, progress]);

  return (
    <div 
      className={`slide-track ${className} ${disabled ? "is-disabled" : ""} ${completed ? "is-complete" : ""}`} 
      ref={trackRef}
    >
      <span className="slide-label">{completed ? completedLabel : label}</span>
      <button
        type="button"
        className="slide-thumb-button"
        disabled={disabled}
        onPointerDown={(event) => {
          if (!disabled) {
            const thumbRect = event.currentTarget.getBoundingClientRect();
            pointerOffsetRef.current = event.clientX - thumbRect.left;
            setDragging(true);
          }
        }}
        style={{ transform: `translateX(${Math.min(progress, maxOffset)}px)` }}
        aria-label={label}
      >
        <span className="slide-thumb" />
      </button>
    </div>
  );
}
