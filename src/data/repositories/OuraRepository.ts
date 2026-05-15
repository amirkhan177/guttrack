import { createSupabaseServiceClient } from '@/lib/supabase';
import { OuraMetrics, OuraMetricsSchema } from '@/src/core/entities/OuraMetrics';

export class OuraRepository {
  private supabase = createSupabaseServiceClient();

  async getMetricsForDate(userId: string, date: string): Promise<OuraMetrics | null> {
    const { data, error } = await this.supabase
      .from('oura_metrics')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return OuraMetricsSchema.parse(data);
  }

  async upsertMetrics(metrics: Omit<OuraMetrics, 'id' | 'created_at'>): Promise<void> {
    const { error } = await this.supabase
      .from('oura_metrics')
      .upsert(metrics, { onConflict: 'user_id,date' });

    if (error) throw error;
  }
}
