import { createSupabaseServiceClient } from '@/lib/supabase';
import { WorkoutLog, WorkoutLogSchema } from '@/src/core/entities/WorkoutLog';

export class WorkoutRepository {
  private supabase = createSupabaseServiceClient();

  async getWorkoutsForDateRange(userId: string, start: string, end: string): Promise<WorkoutLog[]> {
    const { data, error } = await this.supabase
      .from('workout_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('date', start)
      .lte('date', end);

    if (error) throw error;
    return (data || []).map((w) => WorkoutLogSchema.parse(w));
  }

  async upsertWorkouts(workouts: Omit<WorkoutLog, 'id' | 'created_at'>[]): Promise<void> {
    const { error } = await this.supabase
      .from('workout_logs')
      .upsert(workouts, { onConflict: 'user_id,oura_id' });

    if (error) throw error;
  }
}
