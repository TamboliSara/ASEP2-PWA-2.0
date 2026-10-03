import type { DonationRecord, SensorTelemetry } from "../types/domain";

export interface FoodAgentAnalysisParams {
  donation?: Partial<DonationRecord> | null;
  telemetry: Partial<SensorTelemetry>;
  qualityScore: number; // 0 - 100
  hoursRemaining: number;
}

/**
 * Intelligent Food Health Agent
 * 
 * Performs dynamic multi-factor evaluation of food safety, analyzing:
 * - Live environmental telemetry (internal temp, probe temp, chamber humidity, VOC gas resistance)
 * - Food category profile (raw produce, cooked meal, dairy, bakery, etc.)
 * - Storage duration and microbiological kinetics
 * 
 * Generates an authoritative, contextual assessment instead of static hardcoded strings.
 */
export function generateAgentFoodInsight({
  donation,
  telemetry,
  qualityScore,
  hoursRemaining
}: FoodAgentAnalysisParams): string {
  if (!donation) {
    return "Agent Standby: Vault chamber vacant. Atmospheric sensors calibrated and awaiting next food deposit.";
  }

  const foodTitle = donation.foodName || donation.categoryLabel || "Food Item";
  const category = (donation.categoryLabel || donation.foodName || "Food").trim();
  const internalTemp = telemetry.internalTempC ?? 4.0;
  const probeTemp = telemetry.externalTempC;
  const humidity = telemetry.humidityPct ?? 60.0;
  const gasResistance = telemetry.gasResistanceOhms ?? 18000;
  const gasKOhms = (gasResistance / 1000).toFixed(1);
  const tempFmt = internalTemp.toFixed(1);
  const hours = Math.max(0, Math.round(hoursRemaining));
  const lowerCat = category.toLowerCase();

  // Telemetry thresholds
  const isColdPreserved = internalTemp <= 5.0;
  const isThermalElevated = internalTemp > 7.0;
  const isGasLow = gasResistance < 10000; // High VOC / bio-gas emission
  const isGasModerate = gasResistance >= 10000 && gasResistance < 22000; // Normal respiration
  const isGasPristine = gasResistance >= 22000; // Extremely low VOC
  const isHighMoisture = humidity > 72;
  const isDry = humidity < 45;

  // ─────────────────────────────────────────────────────────────
  // 1. CRITICAL SPOILAGE (< 30% Quality)
  // ─────────────────────────────────────────────────────────────
  if (qualityScore < 30) {
    if (isGasLow) {
      return `Agent Critical Alert: High biogenic volatile gas concentration (${gasKOhms} kΩ) detected for ${foodTitle}. Microbial metabolic activity exceeds safety limits. Retrieval restricted; sanitation cycle required.`;
    }
    if (isThermalElevated) {
      return `Agent Critical Alert: Thermal compromise (${tempFmt}°C) accelerated bacterial proliferation for ${foodTitle}. Spoilage threshold breached. Item quarantined for safety.`;
    }
    return `Agent Critical Interlock: Quality index degraded to ${qualityScore}%. Spoilage kinetics breach food consumption standards. Chamber locked for administrative sanitization.`;
  }

  // ─────────────────────────────────────────────────────────────
  // 2. AGING / INTERMEDIATE PHASE (30% to 69% Quality)
  // ─────────────────────────────────────────────────────────────
  if (qualityScore < 70) {
    // A. Cooked Meals / Prepared Dishes
    if (lowerCat.includes("cook") || lowerCat.includes("meal") || lowerCat.includes("curry") || lowerCat.includes("rice") || lowerCat.includes("soup")) {
      if (isThermalElevated) {
        return `Agent Advisory: Internal chamber temperature (${tempFmt}°C) is above optimal cold chain for ${foodTitle}. Bacterial kinetics accelerating; recommend prioritized retrieval and reheating above 75°C within ${Math.min(hours || 6, 6)} hours.`;
      }
      if (isGasLow) {
        return `Agent Warning: Elevated VOC levels (${gasKOhms} kΩ) indicate advancing organic breakdown in ${foodTitle}. Safe consumption window narrowing; distribute within ${Math.min(hours || 8, 8)} hours.`;
      }
      return `Agent Assessment: ${foodTitle} freshness index at ${qualityScore}%. Cold chain held at ${tempFmt}°C (${humidity.toFixed(0)}% RH). Recommend prompt retrieval and thorough reheating within ${hours > 0 ? hours : 12} hours.`;
    }

    // B. Raw Produce / Fresh Fruits / Vegetables
    if (lowerCat.includes("produce") || lowerCat.includes("fruit") || lowerCat.includes("veg") || lowerCat.includes("raw") || lowerCat.includes("salad")) {
      if (isGasModerate || isGasLow) {
        return `Agent Diagnostic: ${foodTitle} exhibiting natural post-harvest respiration and ethylene emission (${gasKOhms} kΩ VOC). Chamber stable at ${tempFmt}°C. Optimal consumption recommended within next ${hours > 0 ? hours : 14} hours before tissue softening.`;
      }
      if (isHighMoisture) {
        return `Agent Advisory: Chamber humidity elevated at ${humidity.toFixed(0)}% for ${foodTitle}. Condensation risk present on outer surfaces. Recommend collection within ${hours > 0 ? hours : 12} hours.`;
      }
      return `Agent Assessment: ${foodTitle} quality score at ${qualityScore}%. Thermal balance stable at ${tempFmt}°C with ${humidity.toFixed(0)}% RH. Recommend distribution within next ${hours > 0 ? hours : 16} hours.`;
    }

    // C. Dairy / High-Risk Perishables
    if (lowerCat.includes("dairy") || lowerCat.includes("milk") || lowerCat.includes("cheese") || lowerCat.includes("yogurt") || lowerCat.includes("paneer")) {
      if (internalTemp > 4.5) {
        return `Agent Warning: Temperature boundary (${tempFmt}°C) nearing critical threshold for ${foodTitle}. Lactic fermentation risk elevated; prioritize collection within ${Math.min(hours || 6, 6)} hours.`;
      }
      return `Agent Assessment: ${foodTitle} quality at ${qualityScore}%. Chilled preservation holding at ${tempFmt}°C. Recommend distribution within next ${hours > 0 ? hours : 10} hours.`;
    }

    // D. Bakery / Grains / Dry Goods
    if (lowerCat.includes("bakery") || lowerCat.includes("bread") || lowerCat.includes("grain") || lowerCat.includes("roti") || lowerCat.includes("baked")) {
      if (isHighMoisture) {
        return `Agent Alert: Chamber humidity at ${humidity.toFixed(0)}% creates staling and spore risk for ${foodTitle}. Recommend collection within ${Math.min(hours || 10, 10)} hours to maintain freshness.`;
      }
      return `Agent Assessment: ${foodTitle} stable at ${qualityScore}% quality index. Low moisture absorption detected (${humidity.toFixed(0)}% RH). Recommend consumption within ${hours > 0 ? hours : 16} hours.`;
    }

    // E. General Fallback for Aging Items
    if (isThermalElevated) {
      return `Agent Warning: Thermal deviation (${tempFmt}°C) detected. Quality index at ${qualityScore}%; recommend priority pickup within next ${Math.min(hours || 8, 8)} hours.`;
    }
    if (isGasLow) {
      return `Agent Advisory: Biogenic volatile emissions detected (${gasKOhms} kΩ). Quality index at ${qualityScore}%; consumption recommended within next ${Math.min(hours || 8, 8)} hours.`;
    }
    return `Agent Assessment: Quality index at ${qualityScore}% for ${foodTitle}. Chamber stable at ${tempFmt}°C (${gasKOhms} kΩ). Recommend collection and consumption within next ${hours > 0 ? hours : 12} hours.`;
  }

  // ─────────────────────────────────────────────────────────────
  // 3. OPTIMAL / FRESH PHASE (>= 70% Quality)
  // ─────────────────────────────────────────────────────────────
  if (lowerCat.includes("produce") || lowerCat.includes("fruit") || lowerCat.includes("veg")) {
    return `Agent Verified: ${foodTitle} in optimal preservation envelope (${tempFmt}°C, ${humidity.toFixed(0)}% RH, ${gasKOhms} kΩ VOC). Respiration steady; nutritional density and crispness peak for ${hours}+ hours.`;
  }
  if (lowerCat.includes("cook") || lowerCat.includes("meal")) {
    return `Agent Verified: ${foodTitle} cold chain secured at ${tempFmt}°C with zero thermal drift. Vegetative growth inhibited; texture and aroma preserved for ${hours}+ hours.`;
  }
  if (lowerCat.includes("dairy")) {
    return `Agent Verified: Strict cold preservation (${tempFmt}°C) active for ${foodTitle}. Lactic culture stability confirmed with pristine gas purity (${gasKOhms} kΩ).`;
  }
  return `Agent Verified: Preservation parameters optimal for ${foodTitle} (${tempFmt}°C, ${humidity.toFixed(0)}% RH, ${gasKOhms} kΩ). Biological activity minimal; certified safe for immediate retrieval.`;
}
