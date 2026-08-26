/**
 * mockTelemetry.ts — Generates varied, realistic mock sensor readings per food item.
 *
 * Each food item deposited gets a unique telemetry profile based on its quality state.
 * These readings stay consistent across all views (receiver dashboard, fleet map, charts).
 *
 * Three quality tiers:
 *   FRESH   → low temp, low humidity, high gas resistance, long shelf life
 *   AGING   → moderate temp, rising humidity, declining gas, short shelf life
 *   SPOILED → high temp, high humidity, low gas resistance, expired
 */

import type { SensorTelemetry, DeadlineEstimate, FoodQualityScore, SensorHealth } from "../types/domain";

// ── Seeded pseudo-random for deterministic variation ──────────────
function seededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return () => {
    hash = (hash * 16807) % 2147483647;
    return (hash & 0x7fffffff) / 0x7fffffff;
  };
}

function randomInRange(rng: () => number, min: number, max: number): number {
  return +(min + rng() * (max - min)).toFixed(2);
}

// ── Fresh Profile ─────────────────────────────────────────────────
function generateFreshTelemetry(rng: () => number): SensorTelemetry {
  return {
    timestamp: new Date().toISOString(),
    internalTempC: randomInRange(rng, 2.0, 5.5),
    externalTempC: randomInRange(rng, 24.0, 30.0),
    humidityPct: randomInRange(rng, 35, 55),
    pressureHpa: randomInRange(rng, 1008, 1015),
    gasResistanceOhms: randomInRange(rng, 22000, 35000),
    heaterStep: 1,
    sensorHealth: "healthy" as SensorHealth,
    heuristicGasProfile: [
      "Optimal storage conditions",
      "Low volatile compound levels",
      "Fresh cellular respiration detected"
    ]
  };
}

// ── Aging Profile ─────────────────────────────────────────────────
function generateAgingTelemetry(rng: () => number): SensorTelemetry {
  return {
    timestamp: new Date().toISOString(),
    internalTempC: randomInRange(rng, 6.0, 10.0),
    externalTempC: randomInRange(rng, 28.0, 34.0),
    humidityPct: randomInRange(rng, 60, 78),
    pressureHpa: randomInRange(rng, 1003, 1010),
    gasResistanceOhms: randomInRange(rng, 10000, 18000),
    heaterStep: 3,
    sensorHealth: "degraded" as SensorHealth,
    heuristicGasProfile: [
      "Mild fermentation risk detected",
      "Rising ethylene levels",
      "Bacterial activity beginning"
    ]
  };
}

// ── Spoiled Profile ───────────────────────────────────────────────
function generateSpoiledTelemetry(rng: () => number): SensorTelemetry {
  return {
    timestamp: new Date().toISOString(),
    internalTempC: randomInRange(rng, 12.0, 22.0),
    externalTempC: randomInRange(rng, 30.0, 38.0),
    humidityPct: randomInRange(rng, 80, 95),
    pressureHpa: randomInRange(rng, 998, 1005),
    gasResistanceOhms: randomInRange(rng, 3000, 8000),
    heaterStep: 5,
    sensorHealth: "critical" as SensorHealth,
    heuristicGasProfile: [
      "High sulfur compound concentration",
      "Ammonia levels exceeding threshold",
      "Advanced microbial decomposition"
    ]
  };
}

// ── Deadline Estimate ─────────────────────────────────────────────
function generateDeadline(qualityScore: FoodQualityScore, rng: () => number): DeadlineEstimate {
  const now = Date.now();
  switch (qualityScore) {
    case "fresh": {
      // Safe (>= 60% of 48h = 28.8h)
      const hours = randomInRange(rng, 30, 46);
      return {
        hoursRemaining: hours,
        absoluteIso: new Date(now + hours * 60 * 60 * 1000).toISOString()
      };
    }
    case "aging": {
      // Aging (30-60% of 48h = 14.4h to 28.8h)
      const hours = randomInRange(rng, 16, 26);
      return {
        hoursRemaining: hours,
        absoluteIso: new Date(now + hours * 60 * 60 * 1000).toISOString()
      };
    }
    case "spoilt": {
      // Spoiled (< 30% of 48h = 14.4h)
      const hours = randomInRange(rng, 0, 12);
      return {
        hoursRemaining: hours,
        absoluteIso: new Date(now + hours * 60 * 60 * 1000).toISOString()
      };
    }
    default:
      return {
        hoursRemaining: 24,
        absoluteIso: new Date(now + 24 * 60 * 60 * 1000).toISOString()
      };
  }
}

// ── Main Export ────────────────────────────────────────────────────

export interface MockReadings {
  telemetry: SensorTelemetry;
  deadlineEstimate: DeadlineEstimate;
  qualityScore: FoodQualityScore;
}

/**
 * Generate a complete set of mock readings for a food item.
 * Uses the donationId as seed so the same donation always gets the same readings.
 * Quality score determines the tier of readings.
 */
export function generateMockReadings(
  donationId: string,
  qualityScore: FoodQualityScore
): MockReadings {
  const rng = seededRandom(donationId);

  let telemetry: SensorTelemetry;
  switch (qualityScore) {
    case "fresh":
      telemetry = generateFreshTelemetry(rng);
      break;
    case "aging":
      telemetry = generateAgingTelemetry(rng);
      break;
    case "spoilt":
      telemetry = generateSpoiledTelemetry(rng);
      break;
    default:
      telemetry = generateFreshTelemetry(rng);
  }

  const deadlineEstimate = generateDeadline(qualityScore, rng);

  return { telemetry, deadlineEstimate, qualityScore };
}

// ── Local Storage Persistence ─────────────────────────────────────

const STORAGE_KEY = "safelocker_mock_readings";

export function persistMockReadings(donationId: string, readings: MockReadings) {
  try {
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    existing[donationId] = readings;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch {
    console.warn("[MockTelemetry] Failed to persist readings");
  }
}

export function loadMockReadings(donationId: string): MockReadings | null {
  try {
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return existing[donationId] || null;
  } catch {
    return null;
  }
}

export function clearMockReadings(donationId: string) {
  try {
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    delete existing[donationId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch {
    console.warn("[MockTelemetry] Failed to clear readings");
  }
}
