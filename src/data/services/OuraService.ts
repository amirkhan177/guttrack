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
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

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
      console.error('[OuraService] Token refresh failed:', error);
      throw new Error('Failed to refresh Oura access token');
    }

    return response.json();
  }

  updateToken(newToken: string) {
    this.token = newToken;
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
