const BASE_URL = 'https://api.ouraring.com';

async function fetchWithRetry(url: string, token: string, attempt = 0): Promise<Response> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 429 && attempt < 3) {
    await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
    return fetchWithRetry(url, token, attempt + 1);
  }

  return res;
}

export class OuraService {
  constructor(private token: string) {}

  private async get<T>(path: string, params: Record<string, string>): Promise<T[]> {
    const url = new URL(`${BASE_URL}${path}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetchWithRetry(url.toString(), this.token);
    if (!res.ok) throw new Error(`Oura API error ${res.status}: ${path}`);
    const json = await res.json();
    return json.data ?? [];
  }

  async fetchDailyReadiness(startDate: string, endDate: string) {
    return this.get<Record<string, unknown>>('/v2/usercollection/daily_readiness', {
      start_date: startDate,
      end_date: endDate,
    });
  }

  async fetchDailySleep(startDate: string, endDate: string) {
    return this.get<Record<string, unknown>>('/v2/usercollection/daily_sleep', {
      start_date: startDate,
      end_date: endDate,
    });
  }

  async fetchDailyActivity(startDate: string, endDate: string) {
    return this.get<Record<string, unknown>>('/v2/usercollection/daily_activity', {
      start_date: startDate,
      end_date: endDate,
    });
  }

  async fetchDailyStress(startDate: string, endDate: string) {
    return this.get<Record<string, unknown>>('/v2/usercollection/daily_stress', {
      start_date: startDate,
      end_date: endDate,
    });
  }

  async fetchDailyResilience(startDate: string, endDate: string) {
    return this.get<Record<string, unknown>>('/v2/usercollection/daily_resilience', {
      start_date: startDate,
      end_date: endDate,
    });
  }

  async fetchVo2Max(startDate: string, endDate: string) {
    return this.get<Record<string, unknown>>('/v2/usercollection/vo2_max', {
      start_date: startDate,
      end_date: endDate,
    });
  }

  async fetchWorkouts(startDate: string, endDate: string) {
    return this.get<Record<string, unknown>>('/v2/usercollection/workout', {
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
    const res = await fetchWithRetry(`${BASE_URL}/v2/usercollection/personal_info`, this.token);
    if (!res.ok) throw new Error(`Oura personal info error ${res.status}`);
    return res.json();
  }
}
