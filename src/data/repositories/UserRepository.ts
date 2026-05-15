import { createSupabaseServiceClient } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

export interface UserRecord {
  id: string;
  email?: string;
  user_metadata: {
    oura_connected?: boolean;
    oura_token?: string;
  } & Record<string, unknown>;
}

export class UserRepository {
  private supabase = createSupabaseServiceClient();

  async listOuraUsers(): Promise<UserRecord[]> {
    const { data: { users }, error } = await this.supabase.auth.admin.listUsers();
    if (error) throw error;
    
    return (users as User[]).filter(
      (u) => u.user_metadata?.oura_connected && u.user_metadata?.oura_token
    ) as UserRecord[];
  }

  async hasRecentMeals(userId: string, days = 7): Promise<boolean> {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);
    const since = sinceDate.toISOString().split('T')[0];

    const { data, error } = await this.supabase
      .from('meal_logs')
      .select('id')
      .eq('user_id', userId)
      .gte('timestamp', `${since}T00:00:00Z`)
      .limit(1);

    if (error) throw error;
    return (data?.length ?? 0) > 0;
  }

  async updateMetadata(userId: string, metadata: Record<string, unknown>): Promise<void> {
    const { error } = await this.supabase.auth.admin.updateUserById(userId, {
      user_metadata: metadata,
    });
    if (error) throw error;
  }
}
