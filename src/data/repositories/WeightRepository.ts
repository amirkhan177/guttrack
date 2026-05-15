import { createSupabaseServiceClient } from '@/lib/supabase';
import { WeightEntry, WeightEntrySchema } from '@/src/core/entities/WeightEntry';

export class WeightRepository {
  private supabase = createSupabaseServiceClient();

  async getWeightHistory(userId: string, limit = 7): Promise<WeightEntry[]> {
    const { data, error } = await this.supabase
      .from('weight_entries')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).map((w) => WeightEntrySchema.parse(w));
  }

  async upsertWeight(entry: Omit<WeightEntry, 'id' | 'created_at'>): Promise<void> {
    const { error } = await this.supabase
      .from('weight_entries')
      .upsert(entry, { onConflict: 'user_id,date' });

    if (error) throw error;
  }
}
