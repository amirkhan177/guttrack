import { createSupabaseServiceClient } from '@/lib/supabase';
import { DailyInsight, DailyInsightSchema } from '@/src/core/entities/Insight';

export class InsightRepository {
  private supabase = createSupabaseServiceClient();

  async getInsightsForDate(userId: string, date: string, limit?: number): Promise<DailyInsight[]> {
    let query = this.supabase
      .from('daily_insights')
      .select('*')
      .eq('user_id', userId)
      .lte('date', date)
      .order('date', { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data || []).map((i) => DailyInsightSchema.parse(i));
  }

  async deleteInsightsForDate(userId: string, date: string, windowType: string): Promise<void> {
    const { error } = await this.supabase
      .from('daily_insights')
      .delete()
      .eq('user_id', userId)
      .eq('date', date)
      .eq('window_type', windowType);

    if (error) throw error;
  }

  async getLatestInsight(userId: string, windowType: string): Promise<DailyInsight | null> {
    const { data, error } = await this.supabase
      .from('daily_insights')
      .select('*')
      .eq('user_id', userId)
      .eq('window_type', windowType)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return DailyInsightSchema.parse(data);
  }

  async upsertInsight(insight: Omit<DailyInsight, 'id' | 'created_at'>): Promise<void> {
    // 1. Delete any existing insight for this user, date, and window_type
    // We use delete first because the production DB may lack the unique constraint 
    // required for a single-call "ON CONFLICT" upsert.
    const { error: deleteError } = await this.supabase
      .from('daily_insights')
      .delete()
      .eq('user_id', insight.user_id)
      .eq('date', insight.date)
      .eq('window_type', insight.window_type);

    if (deleteError) throw deleteError;

    // 2. Insert the new insight
    const { error: insertError } = await this.supabase
      .from('daily_insights')
      .insert(insight);

    if (insertError) throw insertError;
  }
}
