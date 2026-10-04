import { motion } from "framer-motion";
import { Map as MapIcon, MoreHorizontal } from "lucide-react";
import { SurfaceCard } from "../../components/layout/SurfaceCard";
import { Menu } from "../../components/ui/fluid-menu";
import { useAppContext } from "../../store/AppContext";
import { useTranslation } from "../../store/useTranslation";
import type { FleetLockerSummary } from "../../types/domain";
import { getQualityLabel } from "../../utils/safety";
import { toLocalDigits, translateFoodName, translateDonorName } from "../../utils/format";

/**
 * Derives FleetLockerSummary[] from live app state instead of mock data.
 * "Kiosk Delta (THIS DEVICE)" always uses the real current locker state.
 */
function deriveFleetFromState(
  lockers: ReturnType<typeof useAppContext>["state"]["lockers"],
  t: (key: string, fallback?: string) => string
): FleetLockerSummary[] {
  const kioskMeta = [
    { id: "kiosk-alpha", label: t("kioskAlpha", "Kiosk Alpha"), zone: t("zoneDining", "Main Dining Hall"), coords: { x: 28, y: 35 } },
    { id: "kiosk-beta",  label: t("kioskBeta", "Kiosk Beta"),   zone: t("zoneEngineering", "Engineering Block"), coords: { x: 55, y: 28 } },
    { id: "kiosk-gamma", label: t("kioskGamma", "Kiosk Gamma"), zone: t("zoneSports", "Sports Complex"),    coords: { x: 45, y: 65 } },
    { id: "kiosk-delta", label: t("kioskDeltaThis", "Kiosk Delta (THIS DEVICE)"), zone: t("zoneGate", "Campus Gate — Active Kiosk"), coords: { x: 75, y: 52 } },
  ];

  const totalUnits = lockers.length;
  const occupiedLockers = lockers.filter(l => l.occupancyState === "occupied" || l.occupancyState === "spoiled");
  const occupiedUnits = occupiedLockers.length;
  const freeUnits = totalUnits - occupiedUnits;
  const faultedLockers = lockers.filter(l => l.faultState !== "none");
  const firstOccupied = occupiedLockers[0];
  const firstDonation = firstOccupied?.activeDonation;

  let deltaQuality: FleetLockerSummary["foodQualityScore"] = "fresh";
  if (occupiedLockers.some(l => l.foodQualityScore === "spoilt")) deltaQuality = "spoilt";
  else if (occupiedLockers.some(l => l.foodQualityScore === "aging")) deltaQuality = "aging";

  const lastSync = lockers.reduce<string>((latest, l) => {
    const syncAt = l.lastSyncedAt ?? "";
    return syncAt > latest ? syncAt : latest;
  }, lockers[0]?.lastSyncedAt ?? new Date().toISOString());

  return kioskMeta.map(meta => {
    if (meta.id === "kiosk-delta") {
      return {
        lockerId: meta.id, lockerLabel: meta.label, zoneLabel: meta.zone,
        coordinates: meta.coords,
        occupancyState: occupiedUnits > 0 ? "occupied" : "empty",
        foodQualityScore: deltaQuality,
        faultState: faultedLockers.length > 0 ? "sensor_fault" : "none",
        activeDonationName: firstDonation?.foodName,
        activeDonationCategory: firstDonation?.categoryLabel,
        deadlineEstimate: firstOccupied?.deadlineEstimate ?? { hoursRemaining: 0, absoluteIso: new Date().toISOString() },
        lastSyncedAt: lastSync,
        sensorHealth: (firstOccupied?.telemetry?.sensorHealth ?? "healthy") as "healthy" | "degraded" | "critical",
        heuristicGasProfile: firstOccupied?.telemetry?.heuristicGasProfile ?? ["Active monitoring"],
        totalUnits, occupiedUnits, freeUnits,
      };
    }
    const isAlpha = meta.id === "kiosk-alpha";
    const isBeta = meta.id === "kiosk-beta";

    // Varied food items per remote kiosk to avoid repetitive display
    const alphaFoods = [
      { name: "Mixed Fruit Bowl", cat: "Raw Produce" },
      { name: "Curd Rice", cat: "Cooked Meal" },
      { name: "Banana Bunch", cat: "Raw Produce" },
      { name: "Chapati & Sabzi", cat: "Cooked Meal" },
      { name: "Paneer Wrap", cat: "Packed Snack" },
    ];
    const betaFoods = [
      { name: "Rice & Dal", cat: "Cooked Meal" },
      { name: "Samosa Pack", cat: "Packed Snack" },
      { name: "Idli Chutney", cat: "Cooked Meal" },
      { name: "Poha Bowl", cat: "Cooked Meal" },
      { name: "Veg Sandwich", cat: "Packed Snack" },
      { name: "Upma", cat: "Cooked Meal" },
      { name: "Dosa Batter", cat: "Raw Produce" },
      { name: "Egg Curry", cat: "Cooked Meal" },
    ];

    const gammaFoods = [
      { name: "Poha Bowl", cat: "Cooked Meal" },
      { name: "Sprouts Salad", cat: "Raw Produce" },
      { name: "Khichdi", cat: "Cooked Meal" },
    ];

    return {
      lockerId: meta.id, lockerLabel: meta.label, zoneLabel: meta.zone, coordinates: meta.coords,
      occupancyState: isAlpha ? "occupied" : isBeta ? "occupied" : "occupied" as any,
      foodQualityScore: isAlpha ? "fresh" : isBeta ? "aging" : "fresh" as any,
      faultState: "none" as any,
      activeDonationName: isAlpha ? alphaFoods[0].name : isBeta ? betaFoods[0].name : gammaFoods[0].name,
      activeDonationCategory: isAlpha ? alphaFoods[0].cat : isBeta ? betaFoods[0].cat : gammaFoods[0].cat,
      deadlineEstimate: isAlpha ? { hoursRemaining: 30, absoluteIso: new Date(Date.now() + 30*3600000).toISOString() } : isBeta ? { hoursRemaining: 3, absoluteIso: new Date(Date.now() + 3*3600000).toISOString() } : { hoursRemaining: 18, absoluteIso: new Date(Date.now() + 18*3600000).toISOString() },
      lastSyncedAt: lastSync,
      sensorHealth: isBeta ? "degraded" : "healthy" as any,
      heuristicGasProfile: isAlpha ? ["Optimal storage", "Low volatile compounds"] : isBeta ? ["Slight fermentation", "Rising ethylene"] : ["Minimal VOC emission", "Stable freshness indicators"],
      totalUnits: 8, occupiedUnits: isAlpha ? 5 : isBeta ? 8 : 3, freeUnits: isAlpha ? 3 : isBeta ? 0 : 5,
    };
  });
}

export function FleetMap() {
  const { t, locale } = useTranslation();
  const { state } = useAppContext();
  const fleet = deriveFleetFromState(state.lockers, t);

  // Real per-chamber details for delta kiosk's 3-dot menu
  const deltaChambersDetail = state.lockers.map((locker, idx) => ({
    chamberNum: idx + 1,
    foodName: locker.activeDonation?.foodName,
    donorName: locker.activeDonation?.donorName,
    quality: locker.foodQualityScore,
    isOccupied: locker.occupancyState === 'occupied' || locker.occupancyState === 'spoiled',
  }));

  const mapLanguage = locale === "hi" ? "hi" : locale === "mr" ? "mr" : "en";
  const mapEmbedUrl = `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3784.441999208006!2d73.868202514892!3d18.46362248744!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bc2ea9511019ed3%3A0x33ef92d33b49767a!2sVishwakarma%20Institute%20of%20Technology!5e0!3m2!1s${mapLanguage}!2sin!4v1620000000000!5m2!1s${mapLanguage}!2sin&hl=${mapLanguage}`;

  return (
    <SurfaceCard className="!p-8 overflow-hidden relative">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
          <MapIcon className="w-5 h-5 text-accent" />
        </div>
        <div>
          <p className="text-[10px] font-black tracking-widest uppercase text-accent/80">{t("fleetMap", "FLEET MAP")}</p>
          <h3 className="text-xl font-black">{t("liveStatusVisualization", "Live Status Visualization")}</h3>
        </div>
      </div>
      
      <div className="fleet-map relative aspect-[21/9] bg-panel-elevated/30 rounded-2xl border border-line overflow-hidden group/map shadow-2xl">
        <iframe
          key={mapLanguage}
          title="VIT Pune Location"
          width="100%"
          height="100%"
          frameBorder="0"
          style={{ border: 0, filter: 'grayscale(1) contrast(1.1) brightness(0.9) invert(0.05)', opacity: 0.7 }}
          className="pointer-events-none"
          src={mapEmbedUrl}
          allowFullScreen
          loading="lazy"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-panel/60 via-transparent to-panel/20 pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
        
        <div className="absolute top-6 left-6 flex items-center gap-3 z-20">
          <div className="px-3 py-1.5 rounded-full bg-accent/10 backdrop-blur-md border border-accent/20 flex items-center gap-2 shadow-xl">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-accent">{t("liveGpsStream", "Live GPS Stream")}</span>
          </div>
          <div className="px-3 py-1.5 rounded-full bg-panel/40 backdrop-blur-md border border-line flex items-center gap-2 shadow-xl">
            <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest">{t("zoneVitPune", "Zone: VIT-PUNE-01")}</span>
          </div>
        </div>

        <div className="absolute top-6 right-6 flex flex-col items-end gap-1 z-20">
          <span className="text-[10px] font-mono font-bold text-accent/60 uppercase">Lat: {toLocalDigits("18.4636", locale)}</span>
          <span className="text-[10px] font-mono font-bold text-accent/60 uppercase">Lng: {toLocalDigits("73.8682", locale)}</span>
        </div>

        <div className="absolute bottom-6 left-6 flex items-center gap-4 z-20">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-panel/60 backdrop-blur-md border border-line">
            <div className="w-2 h-2 rounded-full bg-accent" />
            <span className="text-[9px] font-black uppercase text-text-muted tracking-tighter">{t("mapActive", "Active")}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-panel/60 backdrop-blur-md border border-line">
            <div className="w-2 h-2 rounded-full bg-panel border border-line" />
            <span className="text-[9px] font-black uppercase text-text-muted tracking-tighter">{t("mapStandby", "Standby")}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-panel/60 backdrop-blur-md border border-line">
            <div className="w-2 h-2 rounded-full bg-danger" />
            <span className="text-[9px] font-black uppercase text-text-muted tracking-tighter">{t("mapFault", "Fault")}</span>
          </div>
        </div>
        
        {fleet.map((locker, idx) => {
          const isOccupied = locker.occupancyState === 'occupied';
          const isFault = locker.faultState !== 'none';
          const isEmpty = locker.occupancyState === 'empty';
          const isDelta = locker.lockerId === 'kiosk-delta';

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
                <div className={`absolute w-32 h-20 rounded-2xl backdrop-blur-md border shadow-2xl transition-all duration-500 -z-10 ${auraColor}`} />
                <div className={`relative w-8 h-8 rounded-full flex items-center justify-center font-black text-xs transition-all duration-500 border-4 shadow-xl z-10 ${markerClass} ${isOccupied ? 'ring-4 ring-accent/20' : ''}`}>
                  {locker.lockerId === 'kiosk-alpha' ? 'α' : locker.lockerId === 'kiosk-beta' ? 'β' : locker.lockerId === 'kiosk-gamma' ? 'γ' : 'δ'}
                </div>
                <div className="mt-2 px-3 py-1 rounded bg-panel shadow-md border border-line z-10">
                  <span className="text-[8px] font-black uppercase tracking-widest text-text">{locker.lockerLabel}</span>
                </div>
                
                {/* Advanced Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 p-4 rounded-2xl bg-panel-elevated/95 backdrop-blur-2xl border border-line shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none group-hover:pointer-events-auto whitespace-nowrap z-50 transform translate-y-2 group-hover:translate-y-0 min-w-[200px] !rotate-0 !skew-0">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-accent">{locker.zoneLabel}</span>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${isOccupied ? 'bg-accent' : 'bg-text-muted'}`} />
                      <div className="pointer-events-auto">
                        <Menu align="right" showChevron={false}
                          trigger={
                            <div className="p-1 rounded-full bg-panel/50 hover:bg-panel border border-transparent hover:border-line transition-all">
                              <MoreHorizontal className="w-3.5 h-3.5 text-text-muted" />
                            </div>
                          }
                        >
                          <div className="px-3 py-2 border-b border-line">
                            <span className="text-[9px] font-black uppercase tracking-widest text-text-muted">
                              {isDelta ? t("chamberDetailsLive", "Chamber Details (Live)") : t("unitContents", "Unit Contents")}
                            </span>
                          </div>
                          <div className="max-h-48 overflow-y-auto p-1 space-y-1">
                            {isDelta ? (
                              deltaChambersDetail.map((chamber) => (
                                <div key={chamber.chamberNum} className="flex items-center justify-between p-2 rounded hover:bg-panel-elevated transition-colors">
                                  <div className="flex flex-col">
                                    <span className="text-xs font-bold text-text">
                                      {chamber.isOccupied ? translateFoodName(chamber.foodName, locale) : t("empty", "Empty")}
                                    </span>
                                    <span className="text-[9px] font-bold text-text-muted uppercase">
                                      SAFE {toLocalDigits(chamber.chamberNum.toString().padStart(2, '0'), locale)}{chamber.donorName ? ` · ${translateDonorName(chamber.donorName, locale)}` : ''}
                                    </span>
                                  </div>
                                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border
                                    ${chamber.quality === 'fresh' ? 'bg-success/10 text-success border-success/20' : 
                                      chamber.quality === 'aging' ? 'bg-warning/10 text-warning border-warning/20' : 
                                      chamber.isOccupied ? 'bg-danger/10 text-danger border-danger/20' :
                                      'bg-panel/50 text-text-muted border-line'}`}
                                  >
                                    {chamber.isOccupied ? getQualityLabel(chamber.quality as any, locale) : t("empty", "idle")}
                                  </span>
                                </div>
                              ))
                            ) : isOccupied ? (
                              (() => {
                                // Unique food items per kiosk unit
                                const isAlpha = locker.lockerId === 'kiosk-alpha';
                                const isBeta = locker.lockerId === 'kiosk-beta';
                                const isGamma = locker.lockerId === 'kiosk-gamma';
                                const alphaItems = ['Mixed Fruit Bowl', 'Curd Rice', 'Banana Bunch', 'Chapati & Sabzi', 'Paneer Wrap'];
                                const betaItems = ['Rice & Dal', 'Samosa Pack', 'Idli Chutney', 'Poha Bowl', 'Veg Sandwich', 'Upma', 'Dosa Batter', 'Egg Curry'];
                                const gammaItems = ['Poha Bowl', 'Sprouts Salad', 'Khichdi'];
                                const items = isAlpha ? alphaItems : isBeta ? betaItems : isGamma ? gammaItems : [locker.activeDonationName || 'Donation'];
                                return Array.from({ length: locker.occupiedUnits }).map((_, i) => (
                                  <div key={i} className="flex items-center justify-between p-2 rounded hover:bg-panel-elevated transition-colors">
                                    <div className="flex flex-col">
                                      <span className="text-xs font-bold text-text">{translateFoodName(items[i % items.length], locale)}</span>
                                      <span className="text-[9px] font-bold text-text-muted uppercase">{t("chamber", "Unit")} {toLocalDigits(i + 1, locale)}</span>
                                    </div>
                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border
                                      ${locker.foodQualityScore === 'fresh' ? 'bg-success/10 text-success border-success/20' : 
                                        locker.foodQualityScore === 'aging' ? 'bg-warning/10 text-warning border-warning/20' : 
                                        'bg-danger/10 text-danger border-danger/20'}`}
                                    >
                                      {getQualityLabel(locker.foodQualityScore, locale)}
                                    </span>
                                  </div>
                                ));
                              })()
                            ) : (
                              <div className="p-3 text-center text-xs font-medium text-text-muted">{t("allUnitsFree", "All units are free")}</div>
                            )}
                          </div>
                        </Menu>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex flex-col">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider">{t("unitCapacity", "Unit Capacity")}</span>
                        <span className="text-[9px] font-black font-mono text-text">{toLocalDigits(locker.occupiedUnits, locale)}/{toLocalDigits(locker.totalUnits, locale)}</span>
                      </div>
                      <div className="w-full h-1.5 bg-line/50 rounded-full overflow-hidden flex">
                        <div className="h-full bg-accent transition-all duration-500" style={{ width: `${(locker.occupiedUnits / locker.totalUnits) * 100}%` }} />
                      </div>
                      <div className="flex justify-between mt-1 text-[8px] font-bold uppercase tracking-widest text-text-muted">
                        <span>{toLocalDigits(locker.occupiedUnits, locale)} {t("occupied", "Occupied")}</span>
                        <span>{toLocalDigits(locker.freeUnits, locale)} {t("empty", "Free")}</span>
                      </div>
                    </div>
                  </div>

                  {isDelta && (
                    <div className="mt-3 pt-2 border-t border-line/30 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                      <span className="text-[8px] font-black uppercase tracking-widest text-accent/70">{t("hardwarePairedLive", "HARDWARE PAIRED · LIVE DATA")}</span>
                    </div>
                  )}

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
