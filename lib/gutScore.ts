import type { MealLog, OuraMetrics } from "./supabase";

const HIGH_FIBER_CARBS = new Set([
  "Leafy Greens",
  "Legumes/Beans",
  "Oats",
  "Cooked Vegetables",
]);

export function calculateGutScore(
  meals: MealLog[],
  oura: OuraMetrics | null
): number {
  let score = 80;

  for (const meal of meals) {
    if (meal.spice === "Very Hot") score -= 20;
    else if (meal.spice === "Hot") score -= 15;
    else if (meal.spice === "Medium") score -= 5;

    if (meal.alcohol && meal.alcohol !== "None") score -= 15;

    if (
      meal.protein === "Red Meat" &&
      (meal.feeling === "Bad" || meal.feeling === "Awful")
    ) {
      score -= 10;
    }

    if (meal.feeling === "Bad") score -= 10;
    else if (meal.feeling === "Awful") score -= 20;
    else if (meal.feeling === "Great") score += 5;

    const uniqueTags = new Set(meal.symptom_tags ?? []);
    score -= uniqueTags.size * 5;

    if (meal.carbs && HIGH_FIBER_CARBS.has(meal.carbs)) score += 5;
  }

  if (oura) {
    if (oura.readiness_score !== null) {
      if (oura.readiness_score < 50) score -= 15;
      else if (oura.readiness_score < 70) score -= 8;
      else if (oura.readiness_score > 85) score += 8;
    }

    if (oura.hrv_balance !== null) {
      if (oura.hrv_balance < 0) score -= 10;
      else score += 5;
    }

    if (oura.sleep_score !== null) {
      if (oura.sleep_score < 60) score -= 15;
      else if (oura.sleep_score > 85) score += 5;
    }

    if (
      oura.stress_high_minutes !== null &&
      oura.stress_high_minutes > 200
    ) {
      score -= 10;
    }

    if (
      oura.body_temperature_deviation !== null &&
      oura.body_temperature_deviation > 0.5
    ) {
      score -= 8;
    }
  }

  return Math.max(10, Math.min(100, Math.round(score)));
}
