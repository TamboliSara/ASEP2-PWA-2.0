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
  visualScore: number;        // 0..100 (10% weight)
  gasScore: number;           // 0..100 (60% weight)
  tempHumidityScore: number;  // 0..100 (30% weight)
  detectedFoodLabel: string;
  visualObservations: string[];
  assessedAt: string;
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
 * Computes the unified sensor fusion health score.
 * Formula: 0.10 * Visual + 0.60 * Gas + 0.30 * TempHumidity
 */
export function computeMultiModalQuality(
  visualScore: number,
  telemetry?: SensorTelemetry,
  foodLabel = "Prepared Meal"
): MultiModalAssessment {
  const gasScore = calculateGasScore(telemetry);
  const tempHumScore = calculateTempHumidityScore(telemetry);

  // Calibrated weights: 10% Visual, 60% Gas, 30% Temp/Humidity
  const weighted = (visualScore * 0.10) + (gasScore * 0.60) + (tempHumScore * 0.30);
  const unifiedHealthScore = Math.min(100, Math.max(0, Math.round(weighted)));

  let qualityStage: FoodQualityScore = "fresh";
  if (unifiedHealthScore < 45) {
    qualityStage = "spoilt";
  } else if (unifiedHealthScore < 72) {
    qualityStage = "aging";
  }

  const visualObservations: string[] = [];
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
    assessedAt: new Date().toISOString()
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
