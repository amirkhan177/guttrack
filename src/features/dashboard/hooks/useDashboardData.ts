import { useState, useEffect } from 'react';
import { MealRepository } from '@/src/data/repositories/MealRepository';
import { OuraRepository } from '@/src/data/repositories/OuraRepository';
import { InsightRepository } from '@/src/data/repositories/InsightRepository';
import { WeightRepository } from '@/src/data/repositories/WeightRepository';
import { SupplementRepository } from '@/src/data/repositories/SupplementRepository';
import { FeedbackRepository } from '@/src/data/repositories/FeedbackRepository';
import { AuthRepository } from '@/src/data/repositories/AuthRepository';
import { getMtnCycleDate, getMtnDateTimeRange } from '@/lib/dates';
import { OuraMetrics } from '@/src/core/entities/OuraMetrics';
import { useQuery } from '@tanstack/react-query';

export function useDashboardData() {
  const [ouraLastSync, setOuraLastSync] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    console.log('[useDashboardData] Fetching data...');
    const mealRepo = new MealRepository();
    const ouraRepo = new OuraRepository();
    const insightRepo = new InsightRepository();
    const weightRepo = new WeightRepository();
    const supplementRepo = new SupplementRepository();
    const feedbackRepo = new FeedbackRepository();
    const authRepo = new AuthRepository();

    const user = await authRepo.getUser();
    if (!user) throw new Error('Unauthorized');

    // Dashboard shows data for the CURRENT active cycle
    const currentCycleDate = getMtnCycleDate(0); 
    // Biometrics context usually comes from the previous calendar day (completed sleep)
    const completedCycleDate = getMtnCycleDate(-1); 
    
    const { start, end } = getMtnDateTimeRange();

    const [
      mealsData,
      ouraToday,
      ouraYest,
      insightData,
      weightsData,
      suppsData,
      suppLogsData,
      feedbackData,
    ] = await Promise.all([
      mealRepo.getMealsForDate(user.id, start, end), // 8am-8am
      ouraRepo.getMetricsForDate(user.id, currentCycleDate),
      ouraRepo.getMetricsForDate(user.id, completedCycleDate),
      insightRepo.getInsightsForDate(user.id, currentCycleDate), // Insight for this cycle
      weightRepo.getWeightHistory(user.id, 7),
      supplementRepo.getActiveSupplements(user.id),
      supplementRepo.getSupplementLogsForDate(user.id, currentCycleDate),
      feedbackRepo.getRecentFeedback(user.id, 1),
    ]);

    const mergedOura = (() => {
      if (!ouraYest && !ouraToday) return null;
      if (!ouraYest) return ouraToday;
      if (!ouraToday) return ouraYest;
      const merged = { ...ouraYest };
      for (const key of Object.keys(ouraToday) as (keyof OuraMetrics)[]) {
        const val = ouraToday[key];
        if (val !== null && val !== undefined) {
          (merged as Record<string, unknown>)[key] = val;
        }
      }
      return merged as OuraMetrics;
    })();

    return {
      meals: mealsData,
      oura: mergedOura,
      insight: insightData.length > 0 ? insightData[0] : null,
      weights: weightsData,
      supplements: suppsData,
      supplementLogs: suppLogsData,
      hasFeedback: feedbackData.length > 0 && feedbackData[0].date === currentCycleDate,
      weightUnit: (user.user_metadata?.weight_unit as 'kg' | 'lbs') ?? 'kg',
      userOuraLastSync: (user.user_metadata?.oura_last_sync as string) ?? null,
    };
  };

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['dashboardData'],
    queryFn: fetchDashboardData,
  });

  useEffect(() => {
    if (data?.userOuraLastSync) {
      setOuraLastSync(data.userOuraLastSync);
    }
  }, [data?.userOuraLastSync]);

  return {
    meals: data?.meals ?? [],
    oura: data?.oura ?? null,
    insight: data?.insight ?? null,
    weights: data?.weights ?? [],
    supplements: data?.supplements ?? [],
    supplementLogs: data?.supplementLogs ?? [],
    hasFeedback: data?.hasFeedback ?? false,
    loading: isLoading,
    weightUnit: data?.weightUnit ?? 'kg',
    ouraLastSync,
    setOuraLastSync,
    refresh: refetch,
  };
}
