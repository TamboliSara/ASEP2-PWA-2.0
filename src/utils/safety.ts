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
export function getQualityLabel(stage: FoodQualityScore): string {
  switch (stage) {
    case "fresh": return "Fresh";
    case "aging": return "Aging";
    case "spoilt": return "Spoiled";
    default: return "Unknown";
  }
}

export function getRecommendedActions(locker: LockerState): string[] {
  return getRecommendedActionsForQuality(locker.foodQualityScore);
}

export function getRecommendedActionsForQuality(score: FoodQualityScore): string[] {
  if (score === "spoilt") {
    return [
      "Notify admin and cleaning authorities immediately.",
      "Divert rotten produce to composting or organic waste processing.",
      "Locker restricted: Administrative override required for removal."
    ];
  }

  if (score === "aging") {
    return [
      "Prioritize pickup within the next collection window.",
      "Promote rapid reuse through meal sharing or supervised reheating.",
      "Monitor unit humidity and gas buildup before the next cycle."
    ];
  }

  return [
    "Locker is within the normal safe-use window.",
    "Keep the door sealed until retrieval to preserve freshness.",
    "Continue sensor logging for traceability and fleet history."
  ];
}
