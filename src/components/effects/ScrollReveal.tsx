import { motion, Variants, useScroll, useTransform, useSpring } from "framer-motion";
import { ReactNode, useRef } from "react";

interface ScrollRevealProps {
  children: ReactNode;
  type?: "fade" | "slide" | "zoom" | "blur" | "glitch";
  direction?: "up" | "down" | "left" | "right" | "none";
  delay?: number;
  duration?: number;
  distance?: number;
  className?: string;
  style?: React.CSSProperties;
  once?: boolean;
  threshold?: number;
  parallax?: number; // Parallax intensity (0 to 1)
  staggerChildren?: number;
}

export function ScrollReveal({
  children,
  type = "slide",
  direction = "up",
  delay = 0,
  duration = 0.6,
  distance = 30,
  className = "",
  style,
  once = true,
  threshold = 0.05,
  parallax = 0,
  staggerChildren = 0
}: ScrollRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Parallax logic (only attach scroll listener if parallax is explicitly requested)
  const hasParallax = parallax !== 0;
  const { scrollYProgress } = useScroll({
    target: hasParallax ? containerRef : undefined,
    offset: ["start end", "end start"]
  });

  const springConfig = { stiffness: 100, damping: 30, restDelta: 0.001 };
  const yRange = useTransform(scrollYProgress, [0, 1], [distance * parallax, -distance * parallax]);
  const yParallax = useSpring(yRange, springConfig);

  const getInitialValues = () => {
    const initial: any = { opacity: 0 };
    
    if (type === "slide" || type === "glitch") {
      initial.x = direction === "left" ? distance : direction === "right" ? -distance : 0;
      initial.y = direction === "up" ? distance : direction === "down" ? -distance : 0;
    }
    
    if (type === "zoom") {
      initial.scale = 0.92;
    }

    if (type === "glitch") {
      initial.skewX = direction === "left" || direction === "right" ? 6 : 0;
      initial.skewY = direction === "up" || direction === "down" ? 3 : 0;
    }
    
    return initial;
  };

  const variants: Variants = {
    hidden: getInitialValues(),
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      skewX: 0,
      skewY: 0,
      transition: {
        duration,
        delay,
        staggerChildren,
        ease: [0.16, 1, 0.3, 1] as const, // Power4.out
      },
    },
  };

  return (
    <motion.div
      ref={containerRef}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount: threshold }}
      variants={variants}
      style={{ y: hasParallax ? yParallax : 0, willChange: "transform, opacity", ...style }}
      className={`scroll-reveal ${className}`}
    >
      {children}
    </motion.div>
  );
}
