import { motion } from "framer-motion";
import { Lock, Mail, ShieldCheck, ArrowRight } from "lucide-react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../store/AppContext";
import { useTranslation } from "../store/useTranslation";
import { ScrollReveal } from "../components/effects/ScrollReveal";
import { TextReveal } from "../components/effects/TextReveal";

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
      <ScrollReveal direction="up" distance={40}>
        <div className="w-full max-w-4xl grid md:grid-cols-2 gap-0 overflow-hidden rounded-[2rem] border border-line bg-panel/20 backdrop-blur-3xl shadow-2xl">
          
          {/* Visual Side */}
          <div className="relative p-10 md:p-12 flex flex-col items-center justify-center text-center overflow-hidden bg-gradient-to-br from-accent/10 via-panel/50 to-accent-warm/10">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] rounded-full bg-accent/5 blur-[120px] animate-pulse" />
              <div className="absolute top-[20%] left-[10%] w-[40%] h-[40%] rounded-full bg-accent/10 blur-[80px]" />
              <div className="absolute bottom-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-accent-warm/10 blur-[60px]" />
              <div className="absolute inset-0 opacity-[0.02] mix-blend-overlay" style={{ backgroundImage: 'radial-gradient(var(--accent) 1.5px, transparent 1.5px)', backgroundSize: '24px 24px' }} />
            </div>

            <div className="relative z-10 space-y-10">
              <ScrollReveal direction="up" distance={20} delay={0.2}>
                <div className="inline-flex flex-col items-center gap-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-accent/20 blur-3xl rounded-full scale-150 animate-pulse" />
                    <div className="relative p-4 rounded-3xl bg-panel/40 border border-accent/30 shadow-[0_0_50px_rgba(20,184,166,0.15)] backdrop-blur-xl">
                      <ShieldCheck className="w-10 h-10 text-accent" />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-ping" />
                    <span className="text-[10px] font-black tracking-[0.4em] uppercase text-accent/90">
                      {t("restrictedRoute")}
                    </span>
                  </div>
                </div>
              </ScrollReveal>

              <div className="space-y-6">
                <TextReveal direction="up" distance={20} delay={0.3}>
                  <div className="relative">
                    <h1 className="text-7xl md:text-8xl font-black tracking-tighter text-text leading-none drop-shadow-[0_10px_30px_rgba(0,0,0,0.1)]">
                      {t("brand") || "SAFE"}
                    </h1>
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-24 h-1 bg-gradient-to-r from-transparent via-accent/50 to-transparent rounded-full" />
                  </div>
                </TextReveal>
                
                <TextReveal direction="up" distance={15} delay={0.4}>
                  <p className="text-xl md:text-2xl text-text-muted font-bold tracking-tight opacity-90 max-w-sm mx-auto leading-relaxed">
                    {t("brandTagline")}
                  </p>
                </TextReveal>
              </div>

              <ScrollReveal direction="up" distance={10} delay={0.4}>
                <div className="flex items-center justify-center gap-8 opacity-20">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-1 h-8 bg-gradient-to-b from-transparent via-accent to-transparent" />
                    <span className="text-[7px] font-black uppercase tracking-widest">v4.0.2</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-1 h-8 bg-gradient-to-b from-transparent via-accent-warm to-transparent" />
                    <span className="text-[7px] font-black uppercase tracking-widest">TLS 1.3</span>
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </div>
          
          {/* Form Side */}
          <section className="p-10 md:p-12 bg-panel/40 backdrop-blur-md flex flex-col justify-center gap-8 border-l border-line/10">
            <ScrollReveal direction="right" distance={30} delay={0.5} className="space-y-8">
              <div className="space-y-3">
                <TextReveal direction="left" distance={20} delay={0.6}>
                  <h2 className="text-3xl md:text-4xl font-black tracking-tight text-text leading-tight">
                    {t("signIn")}
                  </h2>
                </TextReveal>
                
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
              
              
            </ScrollReveal>
          </section>
        </div>
      </ScrollReveal>
    </motion.div>
  );
}
