import type { FoodQualityScore, LockerState } from "../types/domain";

export function getRecommendedActions(locker: LockerState): string[] {
  return getRecommendedActionsForQuality(locker.foodQualityScore);
}

export function getRecommendedActionsForQuality(score: FoodQualityScore): string[] {
  if (score === "spoilt") {
    return [
      "Notify admin and cleaning authorities immediately.",
      "Divert rotten produce to composting or organic waste processing.",
      "If dairy is only mildly turned and still safe by policy, evaluate paneer-style reuse under supervision."
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
