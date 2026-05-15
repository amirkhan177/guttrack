import { createSupabaseServiceClient } from '@/lib/supabase';
import { Supplement, SupplementSchema, SupplementLog, SupplementLogSchema } from '@/src/core/entities/Supplement';

export class SupplementRepository {
  private supabase = createSupabaseServiceClient();

  async getActiveSupplements(userId: string): Promise<Supplement[]> {
    const { data, error } = await this.supabase
      .from('supplements')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true);

    if (error) throw error;
    return (data || []).map((s) => SupplementSchema.parse(s));
  }

  async getSupplementLogsForDate(userId: string, date: string): Promise<(SupplementLog & { supplements: Supplement })[]> {
    const { data, error } = await this.supabase
      .from('supplement_logs')
      .select('*, supplements(*)')
      .eq('user_id', userId)
      .eq('date', date);

    if (error) throw error;
    
    interface JoinedSupplementLog extends SupplementLog {
      supplements: Supplement;
    }

    return (data || []).map((log) => {
      const parsedLog = SupplementLogSchema.parse(log);
      return {
        ...parsedLog,
        supplements: SupplementSchema.parse((log as unknown as JoinedSupplementLog).supplements),
      };
    });
  }
}
