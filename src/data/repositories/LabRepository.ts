import { createSupabaseServiceClient } from '@/lib/supabase';
import { LabResult, LabResultSchema } from '@/src/core/entities/LabResult';

export class LabRepository {
  private supabase = createSupabaseServiceClient();

  async getRecentLabs(userId: string, limit = 10): Promise<LabResult[]> {
    const { data, error } = await this.supabase
      .from('lab_results')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).map((l) => LabResultSchema.parse(l));
  }
}
