import { motion, useScroll, useSpring } from "framer-motion";

export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  return (
    <motion.div
      className="scroll-progress-bar"
      style={{
        scaleX,
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '4px',
        background: 'linear-gradient(90deg, var(--accent) 0%, #4ade80 100%)',
        transformOrigin: '0%',
        zIndex: 9999,
        boxShadow: '0 0 10px rgba(var(--accent-rgb), 0.5)',
      }}
    />
  );
}
