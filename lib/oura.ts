import { createSupabaseServiceClient } from "./supabase";

const BASE_URL = "https://api.ouraring.com";

async function fetchWithRetry(
  url: string,
  token: string,
  attempt = 0
): Promise<Response> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 429 && attempt < 3) {
    await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
    return fetchWithRetry(url, token, attempt + 1);
  }

  return res;
}

export class OuraClient {
  constructor(private token: string) {}

  static async refreshAccessToken(refreshToken: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }> {
    const clientId = process.env.OURA_CLIENT_ID;
    const clientSecret = process.env.OURA_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Oura Client ID or Secret is not configured');
    }

    const response = await fetch('https://api.ouraring.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[OuraClient] Token refresh failed:', error);
      throw new Error('Failed to refresh Oura access token');
    }

    return response.json();
  }

  private async get<T>(path: string, params: Record<string, string>): Promise<T[]> {
    const url = new URL(`${BASE_URL}${path}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetchWithRetry(url.toString(), this.token);
    if (!res.ok) throw new Error(`Oura API error ${res.status}: ${path}`);
    const json = await res.json();
    return json.data ?? [];
  }

  async fetchDailyReadiness(startDate: string, endDate: string) {
    return this.get<{
      day: string;
      score: number;
      temperature_deviation: number | null;
      contributors: {
        hrv_balance: number | null;
        resting_heart_rate: number | null;
        recovery_index: number | null;
        body_temperature: number | null;
      } | null;
    }>("/v2/usercollection/daily_readiness", {
      start_date: startDate,
      end_date: endDate,
    });
  }

  async fetchDailySleep(startDate: string, endDate: string) {
    return this.get<{
      day: string;
      score: number;
      contributors: Record<string, number>;
      total_sleep_duration: number;
      deep_sleep_duration: number;
      rem_sleep_duration: number;
      light_sleep_duration: number;
      awake_time: number;
      efficiency: number;
      latency: number;
      timing: number;
    }>("/v2/usercollection/daily_sleep", {
      start_date: startDate,
      end_date: endDate,
    });
  }

  async fetchDailyActivity(startDate: string, endDate: string) {
    return this.get<{
      day: string;
      score: number;
      active_calories: number;
      steps: number;
      equivalent_walking_distance: number;
    }>("/v2/usercollection/daily_activity", {
      start_date: startDate,
      end_date: endDate,
    });
  }

  async fetchDailyStress(startDate: string, endDate: string) {
    return this.get<{
      day: string;
      stress_high: number;
      stress_low: number;
      recovery: number;
      rest: number;
      day_summary: string;
    }>("/v2/usercollection/daily_stress", {
      start_date: startDate,
      end_date: endDate,
    });
  }

  async fetchDailyResilience(startDate: string, endDate: string) {
    return this.get<{
      day: string;
      daytime_recovery: number;
      sleep_recovery: number;
      level: string;
    }>("/v2/usercollection/daily_resilience", {
      start_date: startDate,
      end_date: endDate,
    });
  }

  async fetchVo2Max(startDate: string, endDate: string) {
    return this.get<{
      day: string;
      vo2_max: number;
    }>("/v2/usercollection/vo2_max", {
      start_date: startDate,
      end_date: endDate,
    });
  }

  async fetchWorkouts(startDate: string, endDate: string) {
    return this.get<{
      id: string;
      day: string;
      activity: string;
      calories: number;
      distance: number;
      duration: number;
      start_datetime: string;
      end_datetime: string;
      average_heart_rate: number;
      max_heart_rate: number;
      source: string;
    }>("/v2/usercollection/workout", {
      start_date: startDate,
      end_date: endDate,
    });
  }

  async fetchPersonalInfo(): Promise<{
    age: number;
    weight: number;
    height: number;
    biological_sex: string;
  }> {
    const res = await fetchWithRetry(
      `${BASE_URL}/v2/usercollection/personal_info`,
      this.token
    );
    if (!res.ok) throw new Error(`Oura personal info error ${res.status}`);
    return res.json();
  }

  async syncToSupabase(userId: string, date: string): Promise<void> {
    const yesterday = new Date(date);
    yesterday.setDate(yesterday.getDate() - 1);
    const startDate = yesterday.toISOString().split("T")[0];
    const endDate = date;

    const [readiness, sleep, activity, stress, resilience, vo2, workouts] =
      await Promise.allSettled([
        this.fetchDailyReadiness(startDate, endDate),
        this.fetchDailySleep(startDate, endDate),
        this.fetchDailyActivity(startDate, endDate),
        this.fetchDailyStress(startDate, endDate),
        this.fetchDailyResilience(startDate, endDate),
        this.fetchVo2Max(startDate, endDate),
        this.fetchWorkouts(startDate, endDate),
      ]);

    const supabase = createSupabaseServiceClient();

    const datesMap: Record<string, Record<string, unknown>> = {};

    const readinessData =
      readiness.status === "fulfilled" ? readiness.value : [];
    const sleepData = sleep.status === "fulfilled" ? sleep.value : [];
    const activityData = activity.status === "fulfilled" ? activity.value : [];
    const stressData = stress.status === "fulfilled" ? stress.value : [];
    const resilienceData =
      resilience.status === "fulfilled" ? resilience.value : [];
    const vo2Data = vo2.status === "fulfilled" ? vo2.value : [];
    const workoutData = workouts.status === "fulfilled" ? workouts.value : [];

    for (const r of readinessData) {
      console.log('[oura] readiness raw:', JSON.stringify(r))
      datesMap[r.day] = {
        ...datesMap[r.day],
        readiness_score: r.score ?? null,
        hrv_balance: r.contributors?.hrv_balance ?? null,
        resting_heart_rate: r.contributors?.resting_heart_rate ?? null,
        body_temperature_deviation: r.temperature_deviation ?? null,
      };
    }

    for (const s of sleepData) {
      datesMap[s.day] = {
        ...datesMap[s.day],
        sleep_score: s.score,
        sleep_total_minutes: s.total_sleep_duration
          ? Math.round(s.total_sleep_duration / 60)
          : null,
        sleep_deep_minutes: s.deep_sleep_duration
          ? Math.round(s.deep_sleep_duration / 60)
          : null,
        sleep_rem_minutes: s.rem_sleep_duration
          ? Math.round(s.rem_sleep_duration / 60)
          : null,
        sleep_light_minutes: s.light_sleep_duration
          ? Math.round(s.light_sleep_duration / 60)
          : null,
        sleep_awake_minutes: s.awake_time
          ? Math.round(s.awake_time / 60)
          : null,
        sleep_efficiency: s.efficiency,
        sleep_latency: s.latency,
      };
    }

    for (const a of activityData) {
      console.log('[oura] activity raw:', JSON.stringify(a))
      datesMap[a.day] = {
        ...datesMap[a.day],
        activity_score: a.score ?? null,
        steps: a.steps ?? null,
        active_calories: a.active_calories ?? null,
      };
    }

    for (const st of stressData) {
      datesMap[st.day] = {
        ...datesMap[st.day],
        stress_high_minutes: st.stress_high,
        stress_low_minutes: st.stress_low,
        recovery_minutes: st.recovery,
      };
    }

    for (const res of resilienceData) {
      datesMap[res.day] = {
        ...datesMap[res.day],
        resilience_level: res.level,
      };
    }

    for (const v of vo2Data) {
      datesMap[v.day] = {
        ...datesMap[v.day],
        vo2_max: v.vo2_max,
      };
    }

    const upserts = Object.entries(datesMap).map(([day, metrics]) => ({
      user_id: userId,
      date: day,
      ...metrics,
    }));

    if (upserts.length > 0) {
      await supabase.from("oura_metrics").upsert(upserts, {
        onConflict: "user_id,date",
      });
    }

    if (workoutData.length > 0) {
      const workoutUpserts = workoutData.map((w) => ({
        user_id: userId,
        oura_id: w.id,
        date: w.day,
        activity: w.activity,
        calories: w.calories ?? null,
        distance: w.distance ?? null,
        duration_seconds: w.duration ?? null,
        start_datetime: w.start_datetime ?? null,
        end_datetime: w.end_datetime ?? null,
        average_heart_rate: w.average_heart_rate ?? null,
        max_heart_rate: w.max_heart_rate ?? null,
        source: w.source ?? null,
      }));
      await supabase.from("workout_logs").upsert(workoutUpserts, {
        onConflict: "user_id,oura_id",
      });
    }

    try {
      const info = await this.fetchPersonalInfo();
      if (info.weight) {
        await supabase
          .from("weight_entries")
          .upsert(
            { user_id: userId, date: endDate, weight_kg: info.weight },
            { onConflict: "user_id,date" }
          );
      }
    } catch {
      // personal info optional
    }
  }
}
