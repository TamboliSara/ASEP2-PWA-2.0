import { motion, Variants } from "framer-motion";
import { ReactNode } from "react";

interface TextRevealProps {
  children: ReactNode;
  direction?: "up" | "down" | "left" | "right" | "none";
  delay?: number;
  duration?: number;
  distance?: number;
  className?: string;
  once?: boolean;
  staggerChildren?: number;
}

/**
 * TextReveal component specifically for text elements within cards.
 * Supports both reveal (scroll into view) and unreveal (scroll out of view).
 */
export function TextReveal({
  children,
  direction = "up",
  delay = 0,
  duration = 0.6,
  distance = 20,
  className = "",
  once = false,
  staggerChildren = 0
}: TextRevealProps) {
  const variants: Variants = {
    hidden: {
      opacity: 0,
      x: direction === "left" ? distance : direction === "right" ? -distance : 0,
      y: direction === "up" ? distance : direction === "down" ? -distance : 0,
      filter: "blur(8px)",
      transition: {
        duration: duration * 0.8,
        ease: "easeInOut"
      }
    },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      filter: "blur(0px)",
      transition: {
        duration,
        delay,
        staggerChildren,
        ease: [0.16, 1, 0.3, 1], // Power4.out equivalent
      },
    },
  };

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: "-20px" }}
      variants={variants}
      className={className}
    >
      {children}
    </motion.div>
  );
}
