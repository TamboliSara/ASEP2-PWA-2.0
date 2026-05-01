"use client"

import React from "react"
import { SlideButton } from "@/components/ui/slide-button"

export const DemoOne = () => {
  return (
    <div className="flex flex-col items-center justify-center gap-8 p-12 bg-background min-h-[400px]">
      <div className="space-y-4 text-center">
        <h2 className="text-sm font-bold tracking-widest text-muted-foreground uppercase">Donor Mode</h2>
        <SlideButton 
          variant="donor" 
          text="SLIDE TO ENTER DONOR MODE" 
          onConfirm={() => console.log("Donor Mode Activated")}
        />
      </div>

      <div className="space-y-4 text-center">
        <h2 className="text-sm font-bold tracking-widest text-muted-foreground uppercase">Receiver Mode</h2>
        <SlideButton 
          variant="receiver" 
          text="SLIDE TO ENTER RECEIVER MODE" 
          onConfirm={() => console.log("Receiver Mode Activated")}
        />
      </div>

      <div className="space-y-4 text-center">
        <div className="p-8 border border-amber-500/20 rounded-3xl bg-amber-500/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-amber-500 text-[10px] font-black px-3 py-1 rounded-bl-xl text-white tracking-tighter uppercase">
            Protected
          </div>
          <h2 className="text-xs font-bold tracking-widest text-amber-500/60 uppercase mb-6 text-left border-b border-amber-500/10 pb-2">
            Administrative Override
          </h2>
          <SlideButton 
            variant="admin" 
            text="ADMIN: REMOVE ITEM" 
            onConfirm={() => console.log("Item Removed by Admin")}
          />
          <p className="mt-4 text-[11px] text-destructive flex items-center justify-center gap-2">
            <span className="size-1.5 rounded-full bg-destructive animate-pulse" />
            Health hazard detected. Contact support.
          </p>
        </div>
      </div>
    </div>
  )
}
