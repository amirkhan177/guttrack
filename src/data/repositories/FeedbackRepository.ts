import { createSupabaseServiceClient } from '@/lib/supabase';
import { DailyFeedback, DailyFeedbackSchema } from '@/src/core/entities/DailyFeedback';

export class FeedbackRepository {
  private supabase = createSupabaseServiceClient();

  async getRecentFeedback(userId: string, limit = 7): Promise<DailyFeedback[]> {
    const { data, error } = await this.supabase
      .from('daily_feedback')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).map((f) => DailyFeedbackSchema.parse(f));
  }

  async upsertFeedback(feedback: Omit<DailyFeedback, 'id' | 'submitted_at'>): Promise<void> {
    const { error } = await this.supabase
      .from('daily_feedback')
      .upsert(feedback, { onConflict: 'user_id,date' });

    if (error) throw error;
  }
}
