import { OuraService } from '@/src/data/services/OuraService';
import { OuraRepository } from '@/src/data/repositories/OuraRepository';
import { WorkoutRepository } from '@/src/data/repositories/WorkoutRepository';
import { WeightRepository } from '@/src/data/repositories/WeightRepository';
import { SupabaseClient } from '@supabase/supabase-js';

interface OuraResponseItem {
  day: string;
  [key: string]: unknown;
}

export class SyncOuraDataUseCase {
  private ouraRepo = new OuraRepository();
  private workoutRepo = new WorkoutRepository();
  private weightRepo = new WeightRepository();

  async execute(supabase: SupabaseClient, userId: string, targetCycleDate: string): Promise<void> {
    // 1. Get user metadata to check for tokens
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError || !userData.user) throw new Error('User not found');

    const meta = userData.user.user_metadata;
    let accessToken = meta.oura_token;
    const refreshToken = meta.oura_refresh_token;
    const expiresAt = meta.oura_token_expires_at;

    if (!accessToken) throw new Error('Oura not connected');

    // 2. Refresh token if expired (or close to expiring - within 5 mins)
    if (refreshToken && expiresAt && new Date(expiresAt).getTime() - Date.now() < 300000) {
      console.log(`[SyncOuraDataUseCase] Refreshing Oura token for user ${userId}`);
      try {
        const newTokens = await OuraService.refreshAccessToken(refreshToken);
        accessToken = newTokens.access_token;
        
        await supabase.auth.admin.updateUserById(userId, {
          user_metadata: {
            ...meta,
            oura_token: newTokens.access_token,
            oura_refresh_token: newTokens.refresh_token,
            oura_token_expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
          }
        });
      } catch (err) {
        console.error(`[SyncOuraDataUseCase] Failed to refresh token for user ${userId}:`, err);
      }
    }

    const ouraService = new OuraService(accessToken);
    // Fetch data for the calendar day of the cycle, and the previous day for context
    const endDate = targetCycleDate;
    const endObj = new Date(`${targetCycleDate}T12:00:00`);
    endObj.setDate(endObj.getDate() - 1);
    const startDate = endObj.toISOString().split('T')[0];

    console.log(`[SyncOuraDataUseCase] Starting sync for user ${userId} cycle ${targetCycleDate} (Calendar range: ${startDate} to ${endDate})`);

    const [readiness, sleep, activity, stress, resilience, vo2, workouts] =
      await Promise.allSettled([
        ouraService.fetchDailyReadiness(startDate, endDate) as Promise<OuraResponseItem[]>,
        ouraService.fetchDailySleep(startDate, endDate) as Promise<OuraResponseItem[]>,
        ouraService.fetchDailyActivity(startDate, endDate) as Promise<OuraResponseItem[]>,
        ouraService.fetchDailyStress(startDate, endDate) as Promise<OuraResponseItem[]>,
        ouraService.fetchDailyResilience(startDate, endDate) as Promise<OuraResponseItem[]>,
        ouraService.fetchVo2Max(startDate, endDate) as Promise<OuraResponseItem[]>,
        ouraService.fetchWorkouts(startDate, endDate) as Promise<OuraResponseItem[]>,
      ]);

    // Log failures
    if (readiness.status === 'rejected') console.error('[SyncOuraDataUseCase] Readiness fetch failed:', readiness.reason);
    if (sleep.status === 'rejected') console.error('[SyncOuraDataUseCase] Sleep fetch failed:', sleep.reason);
    if (activity.status === 'rejected') console.error('[SyncOuraDataUseCase] Activity fetch failed:', activity.reason);
    if (stress.status === 'rejected') console.error('[SyncOuraDataUseCase] Stress fetch failed:', stress.reason);
    if (resilience.status === 'rejected') console.error('[SyncOuraDataUseCase] Resilience fetch failed:', resilience.reason);
    if (vo2.status === 'rejected') console.error('[SyncOuraDataUseCase] VO2 fetch failed:', vo2.reason);
    if (workouts.status === 'rejected') console.error('[SyncOuraDataUseCase] Workouts fetch failed:', workouts.reason);

    const datesMap: Record<string, Record<string, unknown>> = {};

    if (readiness.status === 'fulfilled') {
      console.log(`[SyncOuraDataUseCase] Processing ${readiness.value.length} readiness items`);
      for (const r of readiness.value) {
        datesMap[r.day] = {
          ...datesMap[r.day],
          readiness_score: (r.score as number) ?? null,
          hrv_balance: (r.contributors as Record<string, number>)?.hrv_balance ?? null,
          resting_heart_rate: (r.contributors as Record<string, number>)?.resting_heart_rate ?? null,
          body_temperature_deviation: (r.temperature_deviation as number) ?? null,
        };
      }
    }

    if (sleep.status === 'fulfilled') {
      console.log(`[SyncOuraDataUseCase] Processing ${sleep.value.length} sleep items`);
      for (const s of sleep.value) {
        datesMap[s.day] = {
          ...datesMap[s.day],
          sleep_score: s.score,
          sleep_total_minutes: s.total_sleep_duration ? Math.round((s.total_sleep_duration as number) / 60) : null,
          sleep_deep_minutes: s.deep_sleep_duration ? Math.round((s.deep_sleep_duration as number) / 60) : null,
          sleep_rem_minutes: s.rem_sleep_duration ? Math.round((s.rem_sleep_duration as number) / 60) : null,
          sleep_light_minutes: s.light_sleep_duration ? Math.round((s.light_sleep_duration as number) / 60) : null,
          sleep_awake_minutes: s.awake_time ? Math.round((s.awake_time as number) / 60) : null,
          sleep_efficiency: s.efficiency,
          sleep_latency: s.latency,
        };
      }
    }

    if (activity.status === 'fulfilled') {
      console.log(`[SyncOuraDataUseCase] Processing ${activity.value.length} activity items`);
      for (const a of activity.value) {
        datesMap[a.day] = {
          ...datesMap[a.day],
          activity_score: (a.score as number) ?? null,
          steps: (a.steps as number) ?? null,
          active_calories: (a.active_calories as number) ?? null,
        };
      }
    }

    if (stress.status === 'fulfilled') {
      console.log(`[SyncOuraDataUseCase] Processing ${stress.value.length} stress items`);
      for (const st of stress.value) {
        // NOTE: Oura v2 daily_stress returns seconds. We convert to minutes.
        datesMap[st.day] = {
          ...datesMap[st.day],
          stress_high_minutes: typeof st.stress_high === 'number' ? Math.round(st.stress_high / 60) : null,
          stress_low_minutes: typeof st.stress_low === 'number' ? Math.round(st.stress_low / 60) : null,
          recovery_minutes: typeof st.recovery === 'number' ? Math.round(st.recovery / 60) : null,
        };
      }
    }

    if (resilience.status === 'fulfilled') {
      console.log(`[SyncOuraDataUseCase] Processing ${resilience.value.length} resilience items`);
      for (const res of resilience.value) {
        datesMap[res.day] = {
          ...datesMap[res.day],
          resilience_level: res.level,
        };
      }
    }

    if (vo2.status === 'fulfilled') {
      console.log(`[SyncOuraDataUseCase] Processing ${vo2.value.length} VO2 items`);
      for (const v of vo2.value) {
        datesMap[v.day] = {
          ...datesMap[v.day],
          vo2_max: v.vo2_max,
        };
      }
    }

    // 1. Sync Oura Metrics
    console.log(`[SyncOuraDataUseCase] Upserting metrics for ${Object.keys(datesMap).length} dates`);
    for (const [day, metrics] of Object.entries(datesMap)) {
      try {
        await this.ouraRepo.upsertMetrics({
          user_id: userId,
          date: day,
          ...metrics,
        } as Parameters<OuraRepository['upsertMetrics']>[0]);
        console.log(`[SyncOuraDataUseCase] Upserted metrics for ${day}`);
      } catch (err) {
        console.error(`[SyncOuraDataUseCase] Failed to upsert metrics for ${day}:`, err);
      }
    }

    // 2. Sync Workouts
    if (workouts.status === 'fulfilled' && workouts.value.length > 0) {
      console.log(`[SyncOuraDataUseCase] Processing ${workouts.value.length} workouts`);
      try {
        const workoutUpserts = workouts.value.map((w: Record<string, unknown>) => ({
          user_id: userId,
          oura_id: w.id as string,
          date: w.day as string,
          activity: w.activity as string,
          calories: (w.calories as number) ?? null,
          distance: (w.distance as number) ?? null,
          duration_seconds: (w.duration as number) ?? null,
          start_datetime: (w.start_datetime as string) ?? null,
          end_datetime: (w.end_datetime as string) ?? null,
          average_heart_rate: (w.average_heart_rate as number) ?? null,
          max_heart_rate: (w.max_heart_rate as number) ?? null,
          source: (w.source as string) ?? null,
        }));
        await this.workoutRepo.upsertWorkouts(workoutUpserts);
        console.log(`[SyncOuraDataUseCase] Upserted ${workoutUpserts.length} workouts`);
      } catch (err) {
        console.error(`[SyncOuraDataUseCase] Failed to upsert workouts:`, err);
      }
    }

    // 3. Personal Info / Weight
    try {
      console.log(`[SyncOuraDataUseCase] Fetching personal info for weight sync`);
      const info = await ouraService.fetchPersonalInfo();
      if (info.weight) {
        await this.weightRepo.upsertWeight({
          user_id: userId,
          date: targetCycleDate,
          weight_kg: parseFloat((info.weight as number).toFixed(2)),
        });
        console.log(`[SyncOuraDataUseCase] Upserted weight: ${info.weight}`);
      }
    } catch (e) {
      console.warn('[SyncOuraDataUseCase] Failed to fetch/sync personal info from Oura:', e);
    }
    
    console.log(`[SyncOuraDataUseCase] Sync complete for user ${userId}`);
  }
}
