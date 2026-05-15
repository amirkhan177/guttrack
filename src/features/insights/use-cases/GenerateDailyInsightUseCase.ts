import { InsightRepository } from '@/src/data/repositories/InsightRepository';
import { MealRepository } from '@/src/data/repositories/MealRepository';
import { OuraRepository } from '@/src/data/repositories/OuraRepository';
import { FeedbackRepository } from '@/src/data/repositories/FeedbackRepository';
import { WeightRepository } from '@/src/data/repositories/WeightRepository';
import { SupplementRepository } from '@/src/data/repositories/SupplementRepository';
import { WorkoutRepository } from '@/src/data/repositories/WorkoutRepository';
import { LabRepository } from '@/src/data/repositories/LabRepository';
import { AIService, DailyInsightAIResponse } from '@/src/data/services/AIService';
import { getMtnCycleDate, getMtnDateTimeRange } from '@/lib/dates';
import { Meal } from '@/src/core/entities/Meal';
import { OuraMetrics } from '@/src/core/entities/OuraMetrics';
import { DailyFeedback } from '@/src/core/entities/DailyFeedback';
import { WeightEntry } from '@/src/core/entities/WeightEntry';
import { Supplement, SupplementLog } from '@/src/core/entities/Supplement';
import { WorkoutLog } from '@/src/core/entities/WorkoutLog';
import { LabResult } from '@/src/core/entities/LabResult';
import { PIIScrubber } from '@/src/core/logic/PIIScrubber';

interface PromptData {
  mealsYest: Meal[];
  mealsToday: Meal[];
  oura: OuraMetrics | null;
  feedback: DailyFeedback[];
  weight: WeightEntry[];
  suppTaken: (SupplementLog & { supplements?: { name: string } })[];
  suppScheduled: Supplement[];
  workouts: WorkoutLog[];
  labs: LabResult[];
  userMetadata: Record<string, unknown>;
}

export class GenerateDailyInsightUseCase {
  private insightRepo = new InsightRepository();
  private mealRepo = new MealRepository();
  private ouraRepo = new OuraRepository();
  private feedbackRepo = new FeedbackRepository();
  private weightRepo = new WeightRepository();
  private supplementRepo = new SupplementRepository();
  private workoutRepo = new WorkoutRepository();
  private labRepo = new LabRepository();
  private aiService: AIService;

  constructor(apiKey: string) {
    this.aiService = new AIService(apiKey);
  }

  async execute(userId: string, userMetadata: Record<string, unknown>): Promise<void> {
    // Current cycle date (e.g. today's date if after 8am)
    const currentCycleDate = getMtnCycleDate(0); 
    // The cycle that just finished (yesterday's date if after 8am today)
    const completedCycleDate = getMtnCycleDate(-1); 

    // Time range for the completed cycle (8am yesterday to 8am today)
    const { start, end } = getMtnDateTimeRange(); // This currently returns for getMtnCycleDate(0)

    // Actually, we want to analyze the window that just closed.
    // If it's 8:01 AM May 14th:
    // completedCycleDate = May 13th.
    // Oura metrics for May 13th will contain the sleep of the night 13th->14th.
    // Meal logs should be from May 13th 8am to May 14th 8am.

    const [
      mealsCompletedCycle,
      oura,
      feedback,
      weight,
      suppTaken,
      suppScheduled,
      workouts,
      labs
    ] = await Promise.all([
      this.mealRepo.getMealsForDate(userId, start, end), // 8am cycle start to 8am cycle end
      this.ouraRepo.getMetricsForDate(userId, completedCycleDate),
      this.feedbackRepo.getRecentFeedback(userId, 30),
      this.weightRepo.getWeightHistory(userId, 7),
      this.supplementRepo.getSupplementLogsForDate(userId, completedCycleDate) as Promise<(SupplementLog & { supplements?: { name: string } })[]>,
      this.supplementRepo.getActiveSupplements(userId),
      this.workoutRepo.getWorkoutsForDateRange(userId, completedCycleDate, currentCycleDate),
      this.labRepo.getRecentLabs(userId, 20)
    ]);

    // 2. Construct prompt
    const rawPrompt = this.constructPrompt({
      mealsYest: mealsCompletedCycle,
      mealsToday: [], // At 8am, we are starting today's meals
      oura,
      feedback,
      weight,
      suppTaken,
      suppScheduled,
      workouts,
      labs,
      userMetadata: PIIScrubber.scrubMetadata(userMetadata)
    });
    const promptData = PIIScrubber.scrubString(rawPrompt);

    // 3. Generate insight via AI
    console.log('[GenerateDailyInsightUseCase] Calling AI...');
    const result: DailyInsightAIResponse = await this.aiService.generateDailyInsight(promptData);
    console.log('[GenerateDailyInsightUseCase] AI response received');

    // 4. Save to repository
    const flareRisk = result.flare_risk;
    const forecast = result.today_forecast;
    const bio = result.biometric_analysis;
    const whatHappened = result.what_happened_yesterday;
    const guidance = result.dietary_guidance;

    const insightData = {
      user_id: userId,
      date: currentCycleDate, // Save it for "Today" (the start of the new cycle)
      window_type: 'daily',
      generated_at: new Date().toISOString(),
      flare_risk_level: flareRisk.level,
      flare_risk_reason: flareRisk.reason,
      contributing_factors: flareRisk.contributing_factors,
      what_happened: whatHappened.description,
      avoid: guidance.avoid_today.map(a => ({ label: a.item, reason: a.reason, duration: a.duration })),
      add_to_diet: guidance.add_to_diet_today.map(a => ({ label: a.item, reason: a.reason, timing: a.timing })),
      patterns: result.patterns_detected,
      prediction: {
        gut_score: result.gut_score,
        one_line: result.one_line_summary,
        readiness_label: bio.readiness_label,
        sleep_quality: bio.sleep_quality,
        stress_level: bio.stress_level,
        how_youll_feel: forecast.how_youll_feel,
        reasoning: forecast.reasoning,
        watch_for: forecast.watch_for,
        symptom_tags: whatHappened.symptom_tags
      },
      prediction_confidence: forecast.confidence_percent,
    };

    console.log('[GenerateDailyInsightUseCase] Upserting insight data...');
    await this.insightRepo.upsertInsight(insightData as Parameters<InsightRepository['upsertInsight']>[0]);
    console.log('[GenerateDailyInsightUseCase] Upsert successful');
  }

  private constructPrompt(data: PromptData): string {
    const { mealsYest, mealsToday, oura, feedback, weight, suppTaken, suppScheduled, workouts, labs } = data;

    const mealsYestLines = mealsYest.map((m: Meal) => this.formatMealPrompt(m, this.getTimeOfDay(m.timestamp)));
    const mealsTodayLines = mealsToday.map((m: Meal) => this.formatMealPrompt(m, this.getTimeOfDay(m.timestamp)));

    const mealsSection = [
      mealsYestLines.length > 0 ? `PREVIOUS CYCLE MEALS (8am-8am):\n${mealsYestLines.join('\n')}` : 'PREVIOUS CYCLE MEALS: None logged',
      mealsTodayLines.length > 0 ? `CURRENT CYCLE MEALS SO FAR:\n${mealsTodayLines.join('\n')}` : '',
    ].filter(Boolean).join('\n\n');

    let ouraSection = 'OURA BIOMETRICS (previous day): No data';
    if (oura) {
      const lines = Object.entries(oura)
        .filter(([k, v]) => !['id', 'user_id', 'created_at'].includes(k) && v !== null)
        .map(([k, v]) => `  ${k}: ${v}`);
      ouraSection = `OURA BIOMETRICS (previous day):\n${lines.join('\n')}`;
    }

    const workoutLines = workouts.map((w: WorkoutLog) =>
      `  ${w.date} ${w.activity}: ${w.duration_seconds ? Math.round(w.duration_seconds / 60) + 'min' : ''} ${w.calories ? w.calories + 'kcal' : ''} avg_hr=${w.average_heart_rate ?? '?'}`
    );
    const workoutsSection = workoutLines.length > 0 ? `WORKOUTS (recent):\n${workoutLines.join('\n')}` : 'WORKOUTS: None recorded';

    const feedbackLines = feedback.map((fb: DailyFeedback) =>
      `  ${fb.date}: predicted=${fb.predicted_flare_level}, actual=${fb.actual_flare_level}, accuracy=${fb.accuracy_score}%`
    );
    const feedbackSection = feedbackLines.length > 0 ? `PREDICTION ACCURACY HISTORY:\n${feedbackLines.join('\n')}` : 'PREDICTION ACCURACY HISTORY: No entries yet';

    let weightSection = 'WEIGHT: No data';
    if (weight.length > 0) {
      const vals = weight.map((w: WeightEntry) => `${w.date}:${w.weight_kg}kg`).join(', ');
      weightSection = `WEIGHT: ${vals}`;
    }

    const suppMap: Record<string, boolean> = {};
    for (const log of suppTaken) {
      const name = log.supplements?.name ?? log.supplement_id;
      suppMap[name] = true;
    }
    const meds = suppScheduled.filter((s: Supplement) => s.category === 'medication');
    const supps = suppScheduled.filter((s: Supplement) => s.category !== 'medication');

    const suppLines = supps.map((s: Supplement) => `  ${s.name}: ${suppMap[s.name] ? 'taken' : 'skipped'}`);
    const medLines = meds.map((s: Supplement) => `  ${s.name}: ${suppMap[s.name] ? 'taken' : 'MISSED'}`);
    const suppSection = suppLines.length > 0 ? `SUPPLEMENTS:\n${suppLines.join('\n')}` : 'SUPPLEMENTS: None';
    const medSection = medLines.length > 0 ? `MEDICATIONS:\n${medLines.join('\n')}` : 'MEDICATIONS: None';

    const labLines = labs.map((l: LabResult) => `  ${l.name}: ${l.value} ${l.unit ?? ''} (${l.date ?? 'no date'})`);
    const labsSection = labLines.length > 0 ? `RECENT LAB RESULTS:\n${labLines.join('\n')}` : '';

    return [
      mealsSection, ouraSection, workoutsSection,
      feedbackSection, weightSection, suppSection, medSection, labsSection,
    ].filter(Boolean).join('\n\n');
  }

  private formatMealPrompt(meal: Meal, timeLabel: string): string {
    return `  ${meal.meal_type} (${timeLabel}): protein=${meal.protein}, carbs=${meal.carbs}, spice=${meal.spice}, feeling=${meal.feeling}`;
  }

  private getTimeOfDay(timestamp: string): string {
    const hour = new Date(timestamp).getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
  }
}
