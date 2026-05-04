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
  duration = 0.8,
  distance = 50,
  className = "",
  once = false,
  threshold = 0.1,
  parallax = 0,
  staggerChildren = 0
}: ScrollRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Parallax logic
  const { scrollYProgress } = useScroll({
    target: containerRef,
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
      initial.scale = 0.8;
    }
    
    if (type === "blur" || type === "glitch") {
      initial.filter = "blur(10px)";
    }

    if (type === "glitch") {
      initial.skewX = direction === "left" || direction === "right" ? 10 : 0;
      initial.skewY = direction === "up" || direction === "down" ? 5 : 0;
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
      filter: "blur(0px)",
      skewX: 0,
      skewY: 0,
      transition: {
        duration,
        delay,
        staggerChildren,
        ease: [0.16, 1, 0.3, 1], // Power4.out
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
      style={{ y: parallax !== 0 ? yParallax : 0 }}
      className={`scroll-reveal ${className}`}
    >
      {children}
    </motion.div>
  );
}
