import { motion } from "framer-motion";
import { Lock, Mail, ShieldCheck, ArrowRight, Fingerprint } from "lucide-react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../store/AppContext";
import { useTranslation } from "../store/useTranslation";

export function SignInPageV2() {
  const navigate = useNavigate();
  const { state, dispatch } = useAppContext();
  const { t } = useTranslation();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    dispatch({ type: "set-admin-auth", value: true });
    navigate("/admin");
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-[calc(100vh-180px)] flex items-center justify-center p-4 md:p-8"
    >
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-0 overflow-hidden rounded-[2rem] border border-line bg-panel/20 backdrop-blur-3xl shadow-2xl">
        
        {/* Visual Side */}
        <div className="relative p-10 md:p-12 flex flex-col justify-between overflow-hidden bg-gradient-to-br from-accent/10 via-transparent to-accent-warm/5">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-accent/10 blur-[100px] animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-accent-warm/10 blur-[100px]" />
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(var(--accent) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
          </div>

          <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-accent/10 border border-accent/20">
                <ShieldCheck className="w-5 h-5 text-accent" />
              </div>
              <span className="text-[10px] font-black tracking-[0.3em] uppercase text-accent/80">
                {t("restrictedRoute")}
              </span>
            </div>

            <div className="space-y-4">
              <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-text leading-none">
                {t("brand") || "SAFE"}
              </h1>
              <p className="text-lg text-text-muted font-medium opacity-80">
                {t("brandTagline")}
              </p>
            </div>
          </div>

          <div className="relative z-10 mt-10">
            <motion.div 
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="p-5 rounded-[1.75rem] bg-panel/40 border border-line backdrop-blur-xl space-y-3 shadow-xl"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 opacity-80">
                  <Fingerprint className="w-4 h-4 text-accent animate-pulse" />
                  <span className="text-[9px] font-black tracking-widest uppercase">Biometric Ready</span>
                </div>
                <span className="text-[8px] font-bold text-accent px-1.5 py-0.5 rounded-full bg-accent/10 border border-accent/20">Active</span>
              </div>
              
              <div className="relative h-1 w-full bg-line rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ 
                    duration: 2, 
                    repeat: Infinity,
                    repeatType: "reverse",
                    ease: "easeInOut" 
                  }}
                  className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-accent to-transparent" 
                />
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: "78%" }}
                  className="h-full bg-accent/30" 
                />
              </div>
              <div className="flex justify-between items-center">
                <p className="text-[9px] text-text-muted font-bold tracking-tight">Integrity: Optimal</p>
                <p className="text-[8px] text-accent font-black tracking-widest">v4.0.2</p>
              </div>
            </motion.div>
          </div>
        </div>
        
        {/* Form Side */}
        <section className="p-10 md:p-12 bg-panel/40 backdrop-blur-md flex flex-col justify-center gap-8 border-l border-line/10">
          <div className="space-y-3">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-text leading-tight">
              {t("signIn")}
            </h2>
            <p className="text-sm text-text-muted font-medium leading-relaxed max-w-xs">
              {t("signInBody")}
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2.5">
              <label className="text-[9px] font-black tracking-[0.2rem] uppercase text-accent/70 ml-1">
                {t("email")}
              </label>
              <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 flex items-center gap-3 z-10 pointer-events-none">
                  <Mail className="w-4 h-4 text-text-muted group-focus-within:text-accent transition-colors" />
                  <div className="w-px h-4 bg-line group-focus-within:bg-accent/30 transition-colors" />
                </div>
                <input 
                  type="email" 
                  defaultValue="admin@ecolocker.local" 
                  required 
                  style={{ paddingLeft: '4.5rem' }}
                  className="w-full pr-6 py-4 bg-panel/40 border border-line rounded-2xl focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all text-text font-medium outline-none shadow-inner"
                />
              </div>
            </div>

            <div className="space-y-2.5">
              <label className="text-[9px] font-black tracking-[0.2rem] uppercase text-accent/70 ml-1">
                {t("password")}
              </label>
              <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 flex items-center gap-3 z-10 pointer-events-none">
                  <Lock className="w-4 h-4 text-text-muted group-focus-within:text-accent transition-colors" />
                  <div className="w-px h-4 bg-line group-focus-within:bg-accent/30 transition-colors" />
                </div>
                <input 
                  type="password" 
                  defaultValue="password" 
                  required 
                  style={{ paddingLeft: '4.5rem' }}
                  className="w-full pr-6 py-4 bg-panel/40 border border-line rounded-2xl focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all text-text font-medium outline-none shadow-inner"
                />
              </div>
            </div>

            <div className="pt-2">
              <button 
                className="group relative flex items-center justify-center gap-3 w-full py-4.5 rounded-2xl bg-accent hover:bg-accent-hover text-white dark:text-black font-black text-base transition-all duration-300 shadow-[0_10px_40px_rgba(20,184,166,0.3)] hover:shadow-[0_15px_50px_rgba(20,184,166,0.4)] hover:-translate-y-1 active:translate-y-0"
                type="submit"
              >
                <span>{t("authenticate")}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </form>
          
          <div className="pt-4 flex flex-col items-center gap-3">
            <div className="flex items-center gap-4 w-full opacity-10">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent to-text" />
              <div className="h-px flex-1 bg-gradient-to-l from-transparent to-text" />
            </div>
            <span className="text-[8px] font-black tracking-[0.4em] uppercase opacity-40 text-text">Encrypted Session</span>
          </div>
        </section>
      </div>
    </motion.div>
  );
}
