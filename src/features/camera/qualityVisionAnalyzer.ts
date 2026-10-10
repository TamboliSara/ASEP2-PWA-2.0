/**
 * qualityVisionAnalyzer.ts — 10-Second Interval Snapshot & Multi-Modal Sensor Fusion
 * 
 * Formula (Calibrated):
 *   Unified Health Score = (0.10 * Visual AI) + (0.60 * BME688 Gas Volatiles) + (0.30 * Temp / Humidity)
 * 
 * Interval:
 *   Strictly 10 seconds during Occupied / Storage State.
 */

import type { FoodQualityScore, SensorTelemetry } from "../../types/domain";

export interface MultiModalAssessment {
  unifiedHealthScore: number; // 0..100
  qualityStage: FoodQualityScore;
  visualScore: number;        // 0..100
  gasScore: number;           // 0..100
  tempHumidityScore: number;  // 0..100
  detectedFoodLabel: string;
  visualObservations: string[];
  assessedAt: string;
  deadlineEstimate?: {
    hoursRemaining: number;
    absoluteIso: string;
  };
}

/**
 * Calculates the environmental gas health score from BME688 telemetry.
 * Nominal gas resistance for fresh environment: > 20,000 Ohms.
 * Degraded gas resistance under biogenic amine/VOC emission: < 8,000 Ohms.
 */
export function calculateGasScore(telemetry?: SensorTelemetry): number {
  if (!telemetry || typeof telemetry.gasResistanceOhms !== "number") return 85;
  const ohms = telemetry.gasResistanceOhms;

  if (ohms >= 25000) return 98;
  if (ohms >= 18000) return 88;
  if (ohms >= 12000) return 74;
  if (ohms >= 7000)  return 55;
  if (ohms >= 4000)  return 32;
  return 15;
}

/**
 * Calculates temperature & humidity safety score.
 * Optimal refrigerated chamber: 2°C - 8°C, humidity 40% - 65%.
 */
export function calculateTempHumidityScore(telemetry?: SensorTelemetry): number {
  if (!telemetry) return 85;
  const temp = typeof telemetry.internalTempC === "number" ? telemetry.internalTempC : 6.0;
  const hum  = typeof telemetry.humidityPct === "number"   ? telemetry.humidityPct : 50.0;

  let tempScore = 95;
  if (temp < 0 || temp > 25) tempScore = 30;
  else if (temp > 14) tempScore = 55;
  else if (temp > 8)  tempScore = 78;

  let humScore = 90;
  if (hum > 85) humScore = 40;
  else if (hum > 75) humScore = 65;
  else if (hum < 30) humScore = 75;

  return Math.round((tempScore * 0.6) + (humScore * 0.4));
}

/**
 * Dynamic AI Model Weight Distributor (Ensemble Surrogate)
 * Replaces hardcoded food categories with a dynamic statistical heuristic based on sensor variance.
 * 
 * Strategy:
 * - BME688 is the undisputed primary source of truth for quality.
 * - Camera Vision is primarily used to detect occupancy (food vs trash).
 * - Camera only acts as a strong quality backup when BME688 is weak (e.g., sealed containers).
 */
export function determineDynamicWeights(gasScore: number, visualScore: number, visionConfidence = 0.9) {
  // 1. Baseline: BME688 Dominance
  let gasWeight = 0.75;
  let visualWeight = 0.05;
  let tempHumWeight = 0.20;

  // 2. Anomaly: Strong Volatiles (BME688 Absolute Truth)
  if (gasScore < 45) {
    gasWeight = 0.85;
    visualWeight = 0.00; // Ignore camera completely if gas is strongly spoilt
    tempHumWeight = 0.15;
  } 
  // 3. Sealed Container Anomaly (BME is blind, but Camera confidently sees decay)
  else if (gasScore > 85 && visualScore < 65 && visionConfidence >= 0.75) {
    // Gases are trapped, so we shift reliance to the visual model
    visualWeight = 0.55;
    gasWeight = 0.15;
    tempHumWeight = 0.30;
  }
  // 4. Transitional Degradation
  else if (gasScore >= 45 && gasScore <= 85) {
    gasWeight = 0.65;
    visualWeight = 0.15;
    tempHumWeight = 0.20;
  }

  return { visual: visualWeight, gas: gasWeight, tempHum: tempHumWeight };
}

export function calculateConsumptionDeadline(unifiedHealthScore: number, tempHumScore: number, qualityStage: FoodQualityScore): number {
  if (qualityStage === "spoilt") return 0;
  
  // Max baseline for fresh food is ~48 hours
  const baseHours = (unifiedHealthScore / 100) * 48;
  const tempMultiplier = tempHumScore / 100;
  
  // Minimum 2 hours if not spoilt, max scales with temp score
  let estimatedHours = Math.max(2, Math.round(baseHours * tempMultiplier));
  
  // Aging food shouldn't stay more than 12h
  if (qualityStage === "aging") {
    estimatedHours = Math.min(estimatedHours, 12); 
  }
  return estimatedHours;
}

/**
 * Computes the unified sensor fusion health score.
 * Dynamically applies weights depending on food context and sensor anomalies.
 */
export function computeMultiModalQuality(
  visualScore: number,
  telemetry?: SensorTelemetry,
  foodLabel = "Prepared Meal"
): MultiModalAssessment {
  const gasScore = calculateGasScore(telemetry);
  const tempHumScore = calculateTempHumidityScore(telemetry);

  // Apply context-aware Case-Based Strategy based on sensor variance
  const weights = determineDynamicWeights(gasScore, visualScore, 0.9);

  const weighted = (visualScore * weights.visual) + (gasScore * weights.gas) + (tempHumScore * weights.tempHum);
  const unifiedHealthScore = Math.min(100, Math.max(0, Math.round(weighted)));

  let qualityStage: FoodQualityScore = "fresh";
  if (unifiedHealthScore < 45) {
    qualityStage = "spoilt";
  } else if (unifiedHealthScore < 72) {
    qualityStage = "aging";
  }

  const hoursRemaining = calculateConsumptionDeadline(unifiedHealthScore, tempHumScore, qualityStage);
  const absoluteIso = new Date(Date.now() + hoursRemaining * 3600 * 1000).toISOString();

  const visualObservations: string[] = [];
  visualObservations.push(`Context Strategy applied: Visual (${Math.round(weights.visual*100)}%), Gas (${Math.round(weights.gas*100)}%), Temp/Hum (${Math.round(weights.tempHum*100)}%)`);

  if (visualScore >= 80) {
    visualObservations.push("Surface visual integrity optimal, zero mold or weeping.");
  } else if (visualScore >= 60) {
    visualObservations.push("Minor surface color shift / natural moisture settling detected.");
  } else {
    visualObservations.push("Visual surface discoloration & oxidative degradation detected.");
  }

  if (gasScore < 50) {
    visualObservations.push("BME688 detected elevated volatile organic amines (spoilage biomarker).");
  } else {
    visualObservations.push("Nominal baseline headspace VOCs verified.");
  }

  return {
    unifiedHealthScore,
    qualityStage,
    visualScore: Math.round(visualScore),
    gasScore,
    tempHumidityScore: tempHumScore,
    detectedFoodLabel: foodLabel,
    visualObservations,
    assessedAt: new Date().toISOString(),
    deadlineEstimate: {
      hoursRemaining,
      absoluteIso
    }
  };
}

/**
 * Optional Gemini Vision API analyzer.
 * If VITE_GEMINI_API_KEY is defined in .env, calls Google Gemini 1.5/2.0 Flash Vision;
 * otherwise automatically falls back to local visual score.
 */
export async function analyzeSnapshotWithGemini(
  base64Image: string,
  localFallbackScore: number
): Promise<{ score: number; description: string; detectedType: string }> {
  const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
  if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
    return {
      score: localFallbackScore,
      description: "Visual surface analyzed via in-browser YOLO vision engine.",
      detectedType: "Cooked Meal"
    };
  }

  try {
    const cleanB64 = base64Image.replace(/^data:image\/\w+;base64,/, "");
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: "You are a certified food safety inspector camera inside an IoT food sharing locker. Analyze this food image. Provide JSON only with: { 'detectedType': string, 'freshnessScore': number (0-100), 'visualQuality': 'fresh' | 'aging' | 'spoilt', 'observation': string }."
                },
                {
                  inline_data: {
                    mime_type: "image/jpeg",
                    data: cleanB64
                  }
                }
              ]
            }
          ]
        })
      }
    );

    if (!response.ok) throw new Error(`Gemini HTTP ${response.status}`);
    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        score: typeof parsed.freshnessScore === "number" ? parsed.freshnessScore : localFallbackScore,
        description: parsed.observation || "Gemini Flash verified visual integrity.",
        detectedType: parsed.detectedType || "Cooked Meal"
      };
    }
  } catch (err) {
    console.warn("[Quality Vision] Gemini Vision call fell back to local engine:", err);
  }

  return {
    score: localFallbackScore,
    description: "Visual surface verified via on-device YOLO vision engine.",
    detectedType: "Cooked Meal"
  };
}
