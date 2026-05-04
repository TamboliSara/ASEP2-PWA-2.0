import { motion, Variants } from "framer-motion";
import { ReactNode } from "react";

interface TextRevealProps {
  children: ReactNode;
  mode?: "words" | "chars" | "block";
  direction?: "up" | "down" | "left" | "right" | "none";
  delay?: number;
  duration?: number;
  distance?: number;
  className?: string;
  once?: boolean;
  staggerChildren?: number;
  threshold?: number;
}

/**
 * TextReveal component specifically for text elements within cards.
 * Supports granular text splitting for word-by-word or character-by-character reveals.
 */
export function TextReveal({
  children,
  mode = "block",
  direction = "up",
  delay = 0,
  duration = 0.6,
  distance = 20,
  className = "",
  once = false,
  staggerChildren = 0.05,
  threshold = 0.2
}: TextRevealProps) {
  
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: mode === "block" ? 0 : staggerChildren,
        delayChildren: delay,
      }
    }
  };

  const itemVariants: Variants = {
    hidden: {
      opacity: 0,
      x: direction === "left" ? distance : direction === "right" ? -distance : 0,
      y: direction === "up" ? distance : direction === "down" ? -distance : 0,
      filter: "blur(8px)",
      scale: 0.95
    },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      filter: "blur(0px)",
      scale: 1,
      transition: {
        duration,
        ease: [0.16, 1, 0.3, 1], // Power4.out
      },
    },
  };

  const renderContent = () => {
    if (typeof children !== "string" || mode === "block") {
      return (
        <motion.div variants={itemVariants}>
          {children}
        </motion.div>
      );
    }

    if (mode === "words") {
      return children.split(" ").map((word, i) => (
        <span key={i} style={{ display: "inline-block", whiteSpace: "nowrap" }}>
          <motion.span variants={itemVariants} style={{ display: "inline-block" }}>
            {word}
          </motion.span>
          <span style={{ display: "inline-block" }}>&nbsp;</span>
        </span>
      ));
    }

    if (mode === "chars") {
      return children.split("").map((char, i) => (
        <motion.span 
          key={i} 
          variants={itemVariants} 
          style={{ display: "inline-block", whiteSpace: "pre" }}
        >
          {char}
        </motion.span>
      ));
    }

    return children;
  };

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount: threshold }}
      variants={containerVariants}
      className={`text-reveal-container ${className}`}
      style={{ display: mode === "block" ? "block" : "flex", flexWrap: "wrap" }}
    >
      {renderContent()}
    </motion.div>
  );
}
