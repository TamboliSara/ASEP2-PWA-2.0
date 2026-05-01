import { motion } from "framer-motion";
import { Map as MapIcon, MoreHorizontal } from "lucide-react";
import { SurfaceCard } from "./layout/SurfaceCard";
import { Menu } from "./ui/fluid-menu";
import { sampleFleetLockers } from "../utils/mockData";
import { useTranslation } from "../store/useTranslation";

export function FleetMap() {
  const { t } = useTranslation();
  const fleet = sampleFleetLockers;

  return (
    <SurfaceCard className="!p-8 overflow-hidden relative">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
          <MapIcon className="w-5 h-5 text-accent" />
        </div>
        <div>
          <p className="text-[10px] font-black tracking-widest uppercase text-accent/80">{t("fleetMap")}</p>
          <h3 className="text-xl font-black">{t("liveStatusVisualization")}</h3>
        </div>
      </div>
      
      <div className="fleet-map relative aspect-[21/9] bg-panel-elevated/30 rounded-2xl border border-line overflow-hidden group/map shadow-2xl">
        {/* Google Maps Integration */}
        <iframe
          title="VIT Pune Location"
          width="100%"
          height="100%"
          frameBorder="0"
          style={{ border: 0, filter: 'grayscale(1) contrast(1.1) brightness(0.9) invert(0.05)', opacity: 0.7 }}
          className="pointer-events-none"
          src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3784.441999208006!2d73.868202514892!3d18.46362248744!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bc2ea9511019ed3%3A0x33ef92d33b49767a!2sVishwakarma%20Institute%20of%20Technology!5e0!3m2!1sen!2sin!4v1620000000000!5m2!1sen!2sin"
          allowFullScreen
          loading="lazy"
        ></iframe>

        {/* Technical Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-panel/60 via-transparent to-panel/20 pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
        
        {/* Map UI Elements */}
        <div className="absolute top-6 left-6 flex items-center gap-3 z-20">
          <div className="px-3 py-1.5 rounded-full bg-accent/10 backdrop-blur-md border border-accent/20 flex items-center gap-2 shadow-xl">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-accent">Live GPS Stream</span>
          </div>
          <div className="px-3 py-1.5 rounded-full bg-panel/40 backdrop-blur-md border border-line flex items-center gap-2 shadow-xl">
            <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest">Zone: VIT-PUNE-01</span>
          </div>
        </div>

        <div className="absolute top-6 right-6 flex flex-col items-end gap-1 z-20">
          <span className="text-[10px] font-mono font-bold text-accent/60 uppercase">Lat: 18.4636</span>
          <span className="text-[10px] font-mono font-bold text-accent/60 uppercase">Lng: 73.8682</span>
        </div>

        {/* Status Legend */}
        <div className="absolute bottom-6 left-6 flex items-center gap-4 z-20">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-panel/60 backdrop-blur-md border border-line">
            <div className="w-2 h-2 rounded-full bg-accent" />
            <span className="text-[9px] font-black uppercase text-text-muted tracking-tighter">Active</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-panel/60 backdrop-blur-md border border-line">
            <div className="w-2 h-2 rounded-full bg-panel border border-line" />
            <span className="text-[9px] font-black uppercase text-text-muted tracking-tighter">Standby</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-panel/60 backdrop-blur-md border border-line">
            <div className="w-2 h-2 rounded-full bg-danger" />
            <span className="text-[9px] font-black uppercase text-text-muted tracking-tighter">Fault</span>
          </div>
        </div>
        
        {fleet.map((locker, idx) => {
          // Determine visual states based on locker state
          const isOccupied = locker.occupancyState === 'occupied';
          const isFault = locker.faultState !== 'none';
          const isEmpty = locker.occupancyState === 'empty';

          let auraColor = 'bg-panel/40';
          if (isOccupied) auraColor = 'bg-accent-warm/20 border-accent-warm/30';
          else if (isFault) auraColor = 'bg-danger/20 border-danger/30';
          else if (isEmpty) auraColor = 'bg-accent/20 border-accent/30';

          let markerClass = 'bg-panel border-line text-text-muted';
          if (isOccupied) markerClass = 'bg-accent border-accent text-white';
          else if (isFault) markerClass = 'bg-panel border-danger/50 text-danger';

          return (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.5 + (idx * 0.05), type: "spring", stiffness: 200, damping: 15 }}
              key={locker.lockerId}
              className={`fleet-node absolute group z-30 cursor-pointer`}
              style={{ left: `${locker.coordinates.x}%`, top: `${locker.coordinates.y}%` }}
            >
              <div className="relative flex flex-col items-center justify-center">
                {/* Large Aura / Backdrop */}
                <div className={`absolute w-32 h-20 rounded-2xl backdrop-blur-md border shadow-2xl transition-all duration-500 -z-10 ${auraColor}`} />
                
                {/* Marker Pin */}
                <div className={`relative w-8 h-8 rounded-full flex items-center justify-center font-black text-xs transition-all duration-500 border-4 shadow-xl z-10 ${markerClass} ${isOccupied ? 'ring-4 ring-accent/20' : ''}`}>
                  {locker.lockerLabel.split(' ')[1]?.[0] || 'L'}
                </div>

                {/* Dynamic Label Pill */}
                <div className="mt-2 px-3 py-1 rounded bg-panel shadow-md border border-line z-10">
                  <span className="text-[8px] font-black uppercase tracking-widest text-text">{locker.lockerLabel}</span>
                </div>
                
                {/* Advanced Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 p-4 rounded-2xl bg-panel-elevated/95 backdrop-blur-2xl border border-line shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none group-hover:pointer-events-auto whitespace-nowrap z-50 transform translate-y-2 group-hover:translate-y-0 min-w-[180px] !rotate-0 !skew-0">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-accent">{locker.zoneLabel}</span>
                    
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${isOccupied ? 'bg-accent' : 'bg-text-muted'}`} />
                      
                      {/* More Options Menu (Fluid Effect) */}
                      <div className="pointer-events-auto">
                        <Menu 
                          align="right" 
                          showChevron={false}
                          trigger={
                            <div className="p-1 rounded-full bg-panel/50 hover:bg-panel border border-transparent hover:border-line transition-all">
                              <MoreHorizontal className="w-3.5 h-3.5 text-text-muted" />
                            </div>
                          }
                        >
                          <div className="px-3 py-2 border-b border-line">
                            <span className="text-[9px] font-black uppercase tracking-widest text-text-muted">Unit Contents</span>
                          </div>
                          <div className="max-h-48 overflow-y-auto p-1 space-y-1">
                            {isOccupied ? (
                              Array.from({ length: locker.occupiedUnits }).map((_, i) => (
                                <div key={i} className="flex items-center justify-between p-2 rounded hover:bg-panel-elevated transition-colors">
                                  <div className="flex flex-col">
                                    <span className="text-xs font-bold text-text">
                                      {locker.activeDonationName || "Donation"} {i + 1}
                                    </span>
                                    <span className="text-[9px] font-bold text-text-muted uppercase">Unit {i + 1}</span>
                                  </div>
                                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border
                                    ${locker.foodQualityScore === 'fresh' ? 'bg-success/10 text-success border-success/20' : 
                                      locker.foodQualityScore === 'aging' ? 'bg-warning/10 text-warning border-warning/20' : 
                                      'bg-danger/10 text-danger border-danger/20'}`}
                                  >
                                    {locker.foodQualityScore}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <div className="p-3 text-center text-xs font-medium text-text-muted">
                                All units are free
                              </div>
                            )}
                          </div>
                        </Menu>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex flex-col">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider">Unit Capacity</span>
                        <span className="text-[9px] font-black font-mono text-text">{locker.occupiedUnits}/{locker.totalUnits}</span>
                      </div>
                      
                      <div className="w-full h-1.5 bg-line/50 rounded-full overflow-hidden flex">
                        <div className="h-full bg-accent transition-all duration-500" style={{ width: `${(locker.occupiedUnits / locker.totalUnits) * 100}%` }} />
                        <div className="h-full bg-transparent transition-all duration-500" style={{ width: `${(locker.freeUnits / locker.totalUnits) * 100}%` }} />
                      </div>
                      <div className="flex justify-between mt-1 text-[8px] font-bold uppercase tracking-widest text-text-muted">
                        <span>{locker.occupiedUnits} Occupied</span>
                        <span>{locker.freeUnits} Free</span>
                      </div>
                    </div>
                    
                  </div>

                  {/* Tooltip arrow */}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-panel-elevated/95" />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </SurfaceCard>
  );
}
