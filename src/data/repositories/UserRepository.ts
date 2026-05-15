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

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: 'user' | 'admin' | 'clinician';
  avatar_url: string | null;
}

export class UserRepository {
  private supabase = createSupabaseServiceClient();

  async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) return null;
    return data as Profile;
  }

  async updateProfile(userId: string, data: Partial<Profile>): Promise<void> {
    const { error } = await this.supabase
      .from('profiles')
      .update(data)
      .eq('id', userId);
    if (error) throw error;
  }

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
