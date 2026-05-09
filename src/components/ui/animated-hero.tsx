import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MoveRight, ShieldCheck, Zap, Globe, Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

function Hero() {
  const navigate = useNavigate();
  const [titleNumber, setTitleNumber] = useState(0);
  const titles = useMemo(
    () => ["Sustainable", "Verified", "Secure", "Smart", "Impactful"],
    []
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (titleNumber === titles.length - 1) {
        setTitleNumber(0);
      } else {
        setTitleNumber(titleNumber + 1);
      }
    }, 2500);
    return () => clearTimeout(timeoutId);
  }, [titleNumber, titles]);

  return (
    <div className="w-full relative overflow-hidden rounded-[2.5rem] bg-gradient-to-b from-panel/30 to-transparent py-8 lg:py-14 mb-8">
      {/* Background Ambient Orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-accent/5 blur-[100px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] rounded-full bg-accent-warm/5 blur-[80px]" />
      </div>

      <div className="container mx-auto relative z-10 px-6">
        <div className="flex gap-6 items-center justify-center flex-col text-center">
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Button 
              variant="outline" 
              size="sm" 
              className="rounded-full bg-panel/40 backdrop-blur-md border-line hover:border-accent/40 px-6 py-5 gap-3 group transition-all duration-300"
              onClick={() => window.dispatchEvent(new CustomEvent('open-help-widget'))}
            >
              <ShieldCheck className="w-4 h-4 text-accent" />
              <span className="text-xs font-bold tracking-widest uppercase opacity-80 text-text">Explore Safety Guidelines</span>
              <MoveRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-accent" />
            </Button>
          </motion.div>

          <div className="flex gap-4 flex-col max-w-2xl">
            <h1 className="text-4xl md:text-6xl tracking-tight font-black leading-[1.1]">
              <span className="bg-gradient-to-r from-text to-text/60 bg-clip-text text-transparent">Sharing is</span>
              <span className="relative block h-[1.2em] overflow-hidden mt-2">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={titleNumber}
                    className="absolute inset-0 flex justify-center text-accent"
                    initial={{ y: 40, opacity: 0, filter: "blur(10px)" }}
                    animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                    exit={{ y: -40, opacity: 0, filter: "blur(10px)" }}
                    transition={{ 
                      type: "spring", 
                      stiffness: 100, 
                      damping: 20,
                      mass: 1
                    }}
                  >
                    {titles[titleNumber]}
                  </motion.span>
                </AnimatePresence>
              </span>
            </h1>

            <motion.p 
              className="text-base md:text-xl leading-relaxed text-text-muted max-w-2xl mx-auto font-medium"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.8 }}
            >
              The world's most advanced <span className="text-accent font-bold">autonomous food equity</span> network. 
              Redefining community trust through bank-grade biometrics, smart telemetry, and hyper-efficient locker technology.
            </motion.p>
          </div>

          <motion.div 
            className="flex flex-col sm:flex-row gap-5 mt-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            <Button 
              size="lg" 
              variant="outline" 
              className="rounded-full px-8 py-6 text-base border-line bg-panel/30 backdrop-blur-xl hover:bg-panel/50 text-text transition-all gap-3"
              onClick={() => window.dispatchEvent(new CustomEvent('open-help-widget'))}
            >
              <Zap className="w-4 h-4 text-accent-warm" />
              How It Works
            </Button>
            <Button size="lg" className="rounded-full px-8 py-6 text-base bg-accent hover:bg-accent-hover text-white dark:text-black font-black shadow-[0_10px_40px_rgba(20,184,166,0.3)] transition-all gap-3 group" onClick={() => navigate("/donate")}>
              Start Donating
              <MoveRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </motion.div>

          <motion.div 
            className="flex items-center gap-8 mt-8 opacity-40 grayscale hover:grayscale-0 transition-all duration-500"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            transition={{ delay: 0.8 }}
          >
            <div className="flex items-center gap-2 text-text">
              <Globe className="w-4 h-4" />
              <span className="text-[10px] font-black tracking-widest uppercase">Global Standards</span>
            </div>
            <div className="h-4 w-px bg-line" />
            <div className="flex items-center gap-2 text-text">
              <Heart className="w-4 h-4" />
              <span className="text-[10px] font-black tracking-widest uppercase">Community Driven</span>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export { Hero };
