import { InsightRepository } from '@/src/data/repositories/InsightRepository';
import { MealRepository } from '@/src/data/repositories/MealRepository';
import { OuraRepository } from '@/src/data/repositories/OuraRepository';
import { FeedbackRepository } from '@/src/data/repositories/FeedbackRepository';
import { SupplementRepository } from '@/src/data/repositories/SupplementRepository';
import { AIService } from '@/src/data/services/AIService';
import { getMtnDate } from '@/lib/dates';
import { Meal } from '@/src/core/entities/Meal';
import { OuraMetrics } from '@/src/core/entities/OuraMetrics';
import { DailyFeedback } from '@/src/core/entities/DailyFeedback';
import { DailyInsight } from '@/src/core/entities/Insight';
import { Supplement } from '@/src/core/entities/Supplement';
import { PIIScrubber } from '@/src/core/logic/PIIScrubber';

interface PredictPromptData {
  oura: OuraMetrics | null;
  mealsToday: Meal[];
  mealsYest: Meal[];
  feedback: DailyFeedback[];
  insightHistory: DailyInsight[];
  medications: Supplement[];
  userMetadata: Record<string, unknown>;
}

export class PredictGutHealthUseCase {
  private insightRepo = new InsightRepository();
  private mealRepo = new MealRepository();
  private ouraRepo = new OuraRepository();
  private feedbackRepo = new FeedbackRepository();
  private supplementRepo = new SupplementRepository();
  private aiService: AIService;

  constructor(apiKey: string) {
    this.aiService = new AIService(apiKey);
  }

  async execute(userId: string, userMetadata: Record<string, unknown>): Promise<Record<string, unknown>> {
    const today = getMtnDate(0);
    const yesterday = getMtnDate(-1);

    // 1. Fetch data
    const [
      oura,
      mealsToday,
      mealsYest,
      feedback,
      insightHistory,
      medications
    ] = await Promise.all([
      this.ouraRepo.getMetricsForDate(userId, yesterday),
      this.mealRepo.getMealsForDate(userId, `${today}T00:00:00-07:00`, `${today}T23:59:59-07:00`),
      this.mealRepo.getMealsForDate(userId, `${yesterday}T00:00:00-07:00`, `${yesterday}T23:59:59-07:00`),
      this.feedbackRepo.getRecentFeedback(userId, 30),
      this.insightRepo.getInsightsForDate(userId, yesterday, 30),
      this.supplementRepo.getActiveSupplements(userId),
    ]);

    const filteredMeds = medications.filter(s => s.category === 'medication');
    const filteredAnalysisHistory = insightHistory.filter(i => i.window_type === 'analysis');

    // 2. Construct prompt
    const rawPrompt = this.constructPrompt({
      oura,
      mealsToday,
      mealsYest,
      feedback,
      insightHistory: filteredAnalysisHistory,
      medications: filteredMeds,
      userMetadata: PIIScrubber.scrubMetadata(userMetadata)
    });
    const prompt = PIIScrubber.scrubString(rawPrompt);

    // 3. Generate via AI
    const prediction = await this.aiService.predictFutureHealth(prompt);

    // 4. Save
    const forecast = prediction.forecast as { flare_risk_level: string; reasoning: string; confidence_percent: number };

    // Clean up existing prediction for today
    await this.insightRepo.deleteInsightsForDate(userId, today, 'prediction');

    await this.insightRepo.upsertInsight({
      user_id: userId,
      date: today,
      window_type: 'prediction',
      generated_at: new Date().toISOString(),
      flare_risk_level: (forecast?.flare_risk_level as 'None' | 'Low' | 'Moderate' | 'High' | 'Critical') ?? null,
      flare_risk_reason: forecast?.reasoning ?? null,
      prediction: prediction,
      prediction_confidence: forecast?.confidence_percent ?? null,
      contributing_factors: null,
      what_happened: null,
      avoid: null,
      add_to_diet: null,
      patterns: null,
    });

    return prediction;
  }

  private constructPrompt(data: PredictPromptData): string {
    const { oura, mealsToday, mealsYest, feedback, insightHistory, medications, userMetadata } = data;

    let ouraSection = 'YESTERDAY OURA SIGNALS: No data available';
    if (oura) {
      const ouraLines = Object.entries(oura)
        .filter(([key, val]) => !['id', 'user_id', 'created_at', 'updated_at'].includes(key) && val !== null)
        .map(([key, val]) => `${key}: ${val}`);
      ouraSection = `YESTERDAY OURA SIGNALS:\n${ouraLines.join('\n')}`;
    }

    const formatMeals = (meals: Meal[], label: string): string => {
      if (meals.length === 0) return `${label}: No meals logged`;
      const lines = meals.map((meal) => {
        const symptoms = meal.symptom_tags.join(', ');
        return `  - ${meal.meal_type}: protein=${meal.protein}, carbs=${meal.carbs}, spice=${meal.spice}, alcohol=${meal.alcohol || 'None'}, feeling=${meal.feeling}, symptoms=[${symptoms}]`;
      });
      return `${label}:\n${lines.join('\n')}`;
    };

    const mealsTodaySection = formatMeals(mealsToday, "TODAY'S MEALS SO FAR");
    const mealsYestSection = formatMeals(mealsYest, "YESTERDAY'S MEALS");

    const feedbackLines = feedback.map((fb: DailyFeedback) =>
      `  ${fb.date}: predicted ${fb.predicted_flare_level}, actual ${fb.actual_flare_level}, accuracy ${fb.accuracy_score}%`
    );
    const feedbackSection = feedbackLines.length > 0
      ? `FEEDBACK ACCURACY HISTORY:\n${feedbackLines.join('\n')}`
      : 'FEEDBACK ACCURACY HISTORY: No entries yet';

    const patternLines = insightHistory
      .map((i: DailyInsight) => {
        const patterns = Array.isArray(i.patterns) ? i.patterns.join('; ') : '';
        return patterns ? `  ${i.date}: ${patterns}` : null;
      })
      .filter(Boolean);
    const patternsSection = patternLines.length > 0
      ? `RECENT ANALYSIS PATTERNS:\n${patternLines.join('\n')}`
      : 'RECENT ANALYSIS PATTERNS: No history available';

    const medLines = medications.map((m: Supplement) =>
      `  ${m.name} ${m.dosage ?? ''}${m.unit ?? ''} — ${m.frequency ?? 'daily'} (${m.time_of_day ?? 'unspecified time'})`
    );
    const medsSection = medLines.length > 0
      ? `DAILY MEDICATIONS:\n${medLines.join('\n')}`
      : 'DAILY MEDICATIONS: None';

    const meta = userMetadata ?? {};
    const profileSection = `PATIENT PROFILE: Age=${meta.age || '?'}, Ethnicity=${meta.ethnicity || '?'}, HeightCm=${meta.height_cm || '?'}`;

    return [
      profileSection,
      ouraSection,
      mealsTodaySection,
      mealsYestSection,
      feedbackSection,
      patternsSection,
      medsSection,
    ].join('\n\n');
  }
}
