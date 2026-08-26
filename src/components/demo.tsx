import React from "react"
import { SlideButton } from "@/components/ui/slide-button"
import { FoodHealthCardPremium } from "./FoodHealthCardPremium"

export const DemoOne = () => {
  return (
    <div className="flex flex-col gap-12 p-8 md:p-20 bg-background min-h-screen">
      <div className="max-w-6xl mx-auto w-full space-y-12">
        <section className="space-y-6">
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-black tracking-[0.3em] uppercase text-accent/60">New Release</p>
            <h2 className="text-4xl font-black tracking-tighter">Premium Components</h2>
          </div>
          <FoodHealthCardPremium />
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div className="space-y-8">
            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-black tracking-[0.3em] uppercase text-accent/60">Interaction Core</p>
              <h3 className="text-2xl font-black tracking-tighter">Slide Interaction Modes</h3>
            </div>
            
            <div className="p-8 rounded-[2.5rem] bg-panel-elevated/40 border border-white/5 space-y-8">
              <div className="space-y-4">
                <h2 className="text-[10px] font-black tracking-widest text-text-muted uppercase">Donor Interface</h2>
                <SlideButton 
                  variant="donor" 
                  text="SLIDE TO ENTER DONOR MODE" 
                  onConfirm={() => console.log("Donor Mode Activated")}
                />
              </div>

              <div className="space-y-4">
                <h2 className="text-[10px] font-black tracking-widest text-text-muted uppercase">Receiver Interface</h2>
                <SlideButton 
                  variant="receiver" 
                  text="SLIDE TO ENTER RECEIVER MODE" 
                  onConfirm={() => console.log("Receiver Mode Activated")}
                />
              </div>
            </div>
          </div>

          <div className="space-y-8">
             <div className="flex flex-col gap-2">
              <p className="text-[10px] font-black tracking-[0.3em] uppercase text-danger/60">Critical Core</p>
              <h3 className="text-2xl font-black tracking-tighter">Administrative Controls</h3>
            </div>

            <div className="p-10 border border-amber-500/20 rounded-[2.5rem] bg-amber-500/5 relative overflow-hidden backdrop-blur-xl">
              <div className="absolute top-0 right-0 bg-amber-500 text-[9px] font-black px-4 py-1.5 rounded-bl-2xl text-white tracking-widest uppercase">
                SECURE
              </div>
              <h2 className="text-[10px] font-black tracking-widest text-amber-500/60 uppercase mb-8 pb-3 border-b border-amber-500/10">
                Strategic Asset Registry Override
              </h2>
              <SlideButton 
                variant="admin" 
                text="ADMIN: EMERGENCY PURGE" 
                onConfirm={() => console.log("Item Removed by Admin")}
              />
              <p className="mt-6 text-[10px] font-bold text-destructive flex items-center justify-center gap-3 uppercase tracking-widest opacity-80">
                <span className="size-2 rounded-full bg-destructive animate-pulse" />
                Biological hazard detected: quarantine protocol active
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
