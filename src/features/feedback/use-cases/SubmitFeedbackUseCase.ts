import { FeedbackRepository } from '@/src/data/repositories/FeedbackRepository';
import { InsightRepository } from '@/src/data/repositories/InsightRepository';

const FLARE_ORDER: Record<string, number> = {
  None: 0,
  Low: 1,
  Moderate: 2,
  High: 3,
  Critical: 4,
};

export class SubmitFeedbackUseCase {
  private feedbackRepo = new FeedbackRepository();
  private insightRepo = new InsightRepository();

  async execute(userId: string, data: {
    date: string;
    feeling_score: string;
    actual_flare_level: string;
    actual_symptoms: string[];
    notes?: string;
  }): Promise<{ accuracy_score: number; message: string }> {
    const { date, feeling_score, actual_flare_level, actual_symptoms, notes } = data;

    // 1. Get prediction from insight
    const feedbackDate = new Date(date + 'T12:00:00');
    feedbackDate.setDate(feedbackDate.getDate() - 1);
    const insightDate = feedbackDate.toISOString().split('T')[0];

    const insight = await this.insightRepo.getInsightsForDate(userId, insightDate);
    const latestInsight = insight.length > 0 ? insight[0] : null;

    interface PredictionData {
      flare_risk_level?: string;
      watch_for?: string[];
    }
    const predictionJson = latestInsight?.prediction as unknown as PredictionData;
    const predictedFlareLevel: string | null = predictionJson?.flare_risk_level ?? latestInsight?.flare_risk_level ?? null;
    const predictedSymptoms: string[] = predictionJson?.watch_for ?? [];

    // 2. Compute accuracy
    const accuracyScore = this.computeAccuracyScore(
      predictedFlareLevel,
      actual_flare_level,
      predictedSymptoms,
      actual_symptoms
    );

    // 3. Save feedback
    await this.feedbackRepo.upsertFeedback({
      user_id: userId,
      date,
      predicted_flare_level: predictedFlareLevel,
      actual_flare_level,
      predicted_symptoms: predictedSymptoms,
      actual_symptoms,
      feeling_score,
      accuracy_score: accuracyScore,
      notes: notes ?? null,
    });

    let message = 'Feedback submitted successfully.';
    if (accuracyScore >= 90) message = 'Great prediction accuracy!';
    else if (accuracyScore >= 70) message = 'Good prediction. Small gaps noted.';
    else if (accuracyScore >= 50) message = 'Moderate accuracy. Your data will help improve predictions.';
    else message = 'Significant difference from prediction. This feedback is valuable for learning.';

    return { accuracy_score: accuracyScore, message };
  }

  private computeAccuracyScore(
    predictedFlareLevel: string | null,
    actualFlareLevel: string,
    predictedSymptoms: string[],
    actualSymptoms: string[]
  ): number {
    let score = 100;

    if (predictedFlareLevel !== null) {
      const predictedOrder = FLARE_ORDER[predictedFlareLevel] ?? 0;
      const actualOrder = FLARE_ORDER[actualFlareLevel] ?? 0;
      const diff = Math.abs(predictedOrder - actualOrder);
      if (diff === 1) score -= 25;
      else if (diff === 2) score -= 50;
      else if (diff >= 3) score -= 75;
    } else {
      const actualOrder = FLARE_ORDER[actualFlareLevel] ?? 0;
      if (actualOrder > 0) score -= 50;
    }

    const predictedSet = new Set(predictedSymptoms);
    const actualSet = new Set(actualSymptoms);

    for (const sym of Array.from(actualSet)) {
      if (!predictedSet.has(sym)) score -= 5;
    }
    for (const sym of Array.from(predictedSet)) {
      if (!actualSet.has(sym)) score -= 3;
    }

    return Math.max(0, score);
  }
}
