"use client"

import React, {
  forwardRef,
  useCallback,
  useMemo,
  useRef,
  useState,
  type JSX,
} from "react"
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type PanInfo,
} from "framer-motion"
import { Check, Loader2, ChevronRight, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button, ButtonProps } from "@/components/ui/button"

const DRAG_CONSTRAINTS = { left: 0, right: 180 }
const DRAG_THRESHOLD = 0.9

const BUTTON_STATES = {
  initial: { width: "16rem" },
  completed: { width: "8rem" },
}

const ANIMATION_CONFIG = {
  spring: {
    type: "spring",
    stiffness: 400,
    damping: 40,
    mass: 0.8,
  } as const,
}

type StatusIconProps = {
  status: string
}

const StatusIcon: React.FC<StatusIconProps> = ({ status }) => {
  const iconMap: Record<StatusIconProps["status"], JSX.Element> = useMemo(
    () => ({
      loading: <Loader2 className="animate-spin" size={20} />,
      success: <Check size={20} />,
      error: <X size={20} />,
    }),
    []
  )

  if (!iconMap[status]) return null

  return (
    <motion.div
      key={crypto.randomUUID()}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
    >
      {iconMap[status]}
    </motion.div>
  )
}

const useButtonStatus = (onSuccess?: () => void) => {
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle")

  const handleSubmit = useCallback(() => {
    setStatus("loading")
    setTimeout(() => {
      setStatus("success")
      onSuccess?.()
    }, 2000)
  }, [onSuccess])

  return { status, handleSubmit }
}

interface SlideButtonProps extends Omit<ButtonProps, "variant"> {
  text?: string
  variant?: "default" | "donor" | "receiver" | "admin"
  onConfirm?: () => void
}

const SlideButton = forwardRef<HTMLButtonElement, SlideButtonProps>(
  ({ className, text = "SLIDE TO CONFIRM", variant = "default", onConfirm, ...props }, ref) => {
    const [isDragging, setIsDragging] = useState(false)
    const [completed, setCompleted] = useState(false)
    const dragHandleRef = useRef<HTMLDivElement | null>(null)
    const { status, handleSubmit } = useButtonStatus(onConfirm)

    const dragX = useMotionValue(0)
    const springX = useSpring(dragX, ANIMATION_CONFIG.spring)
    const dragProgress = useTransform(
      springX,
      [0, DRAG_CONSTRAINTS.right],
      [0, 1]
    )

    const handleDragStart = useCallback(() => {
      if (completed) return
      setIsDragging(true)
    }, [completed])

    const handleDragEnd = () => {
      if (completed) return
      setIsDragging(false)

      const progress = dragProgress.get()
      if (progress >= DRAG_THRESHOLD) {
        setCompleted(true)
        handleSubmit()
      } else {
        dragX.set(0)
      }
    }

    const handleDrag = (
      _event: MouseEvent | TouchEvent | PointerEvent,
      info: PanInfo
    ) => {
      if (completed) return
      const newX = Math.max(0, Math.min(info.offset.x, DRAG_CONSTRAINTS.right))
      dragX.set(newX)
    }

    const adjustedWidth = useTransform(springX, (x) => x + 40)
    const textOpacity = useTransform(dragProgress, [0, 0.5], [1, 0])

    const variantStyles = {
      default: {
        track: "bg-black/5 dark:bg-white/5",
        handle: "bg-primary text-primary-foreground",
        glow: "bg-primary/20",
      },
      donor: {
        track: "bg-teal-500/5 dark:bg-teal-500/10",
        handle: "bg-teal-500 text-white shadow-[0_0_15px_rgba(20,184,166,0.5)]",
        glow: "bg-teal-500/20",
      },
      receiver: {
        track: "bg-cyan-600/5 dark:bg-cyan-600/10",
        handle: "bg-cyan-600 text-white shadow-[0_0_15px_rgba(8,145,178,0.5)]",
        glow: "bg-cyan-600/20",
      },
      admin: {
        track: "bg-amber-500/5 dark:bg-amber-500/10",
        handle: "bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-[0_0_15px_rgba(245,158,11,0.5)]",
        glow: "bg-amber-500/20",
      },
    }

    const currentVariant = variantStyles[variant]

    return (
      <motion.div
        animate={completed ? BUTTON_STATES.completed : BUTTON_STATES.initial}
        transition={ANIMATION_CONFIG.spring}
        className={cn(
          "relative flex h-14 items-center justify-center rounded-full p-1 transition-all duration-300",
          "shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]",
          "border border-white/10 backdrop-blur-sm",
          currentVariant.track,
          completed && "h-12 w-32"
        )}
      >
        {!completed && (
          <>
            <motion.div
              style={{
                width: adjustedWidth,
              }}
              className={cn(
                "absolute inset-y-0 left-0 z-0 rounded-full transition-colors duration-300",
                currentVariant.glow
              )}
            />
            <motion.span
              style={{ opacity: textOpacity }}
              className="pointer-events-none z-10 text-[10px] font-bold tracking-[0.2em] text-foreground/40 uppercase"
            >
              {text}
            </motion.span>
          </>
        )}

        <AnimatePresence mode="wait">
          {!completed ? (
            <motion.div
              key="handle"
              ref={dragHandleRef}
              drag="x"
              dragConstraints={DRAG_CONSTRAINTS}
              dragElastic={0.05}
              dragMomentum={false}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDrag={handleDrag}
              style={{ x: springX }}
              className="absolute left-1 z-20 flex cursor-grab items-center justify-start active:cursor-grabbing"
              exit={{ scale: 0, opacity: 0 }}
            >
              <div
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-full transition-transform duration-200",
                  currentVariant.handle,
                  isDragging && "scale-105"
                )}
              >
                <ChevronRight className="size-5" />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="status"
              className="absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <Button
                ref={ref}
                disabled={status === "loading"}
                {...props}
                className={cn(
                  "h-10 w-full rounded-full transition-all duration-300 font-bold",
                  currentVariant.handle,
                  className
                )}
              >
                <AnimatePresence mode="wait">
                  <StatusIcon status={status} />
                </AnimatePresence>
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    )
  }
)

SlideButton.displayName = "SlideButton"

export { SlideButton }
