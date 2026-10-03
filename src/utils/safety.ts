import type { FoodQualityScore, LockerState } from "../types/domain";

export const MAX_SHELF_LIFE = 48; // Standard normalization hours

/**
 * Calculates the Quality Index % based on hours remaining.
 */
export function calculateQualityScore(hoursRemaining: number): number {
  return Math.min(100, Math.round((Math.max(0, hoursRemaining) / MAX_SHELF_LIFE) * 100));
}

/**
 * Maps a Quality Index % to a discrete category.
 * Safe (Fresh): QI >= 60%
 * Aging (Warning): 30% <= QI < 60%
 * Spoiled (Spoilt): QI < 30%
 */
export function getQualityStage(score: number): FoodQualityScore {
  if (score < 30) return "spoilt";
  if (score < 60) return "aging";
  return "fresh";
}

/**
 * Returns user-friendly labels for the 3 categories.
 */
export function getQualityLabel(stage: FoodQualityScore | "empty"): string {
  switch (stage) {
    case "fresh": return "Fresh";
    case "aging": return "Aging";
    case "spoilt": return "Spoiled";
    case "empty": return "Empty";
    default: return "Unknown";
  }
}

export function getRecommendedActions(locker: LockerState): string[] {
  return getRecommendedActionsForQuality(locker.foodQualityScore);
}

export function getRecommendedActionsForQuality(score: FoodQualityScore): string[] {
  if (score === "spoilt") {
    return [
      "Immediate action: Notify facilities and sanitation teams for safe removal.",
      "Sustainable diversion: Direct expired items to organic composting or bio-waste recovery.",
      "Access restricted: Solenoid locked to prevent distribution; admin override required."
    ];
  }

  if (score === "aging") {
    return [
      "Prioritize prompt pickup within the upcoming collection window.",
      "Promote rapid reuse through community meal sharing or supervised reheating above 75°C.",
      "Maintain unit climate: Monitor chamber humidity and VOC gas buildup before the next cycle."
    ];
  }

  return [
    "Optimal storage window: Safe preservation parameters actively maintained.",
    "Preservation seal: Keep door sealed until retrieval to maximize freshness.",
    "Continuous monitoring: Live sensor telemetry logged for food safety traceability."
  ];
}
