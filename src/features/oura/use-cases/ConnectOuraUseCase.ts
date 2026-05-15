import { OuraService } from '@/src/data/services/OuraService';
import { SupabaseClient } from '@supabase/supabase-js';

export class ConnectOuraUseCase {
  async execute(supabase: SupabaseClient, token: string): Promise<void> {
    if (!token || typeof token !== 'string' || token.trim() === '') {
      throw new Error('Token is required');
    }

    const ouraService = new OuraService(token);

    try {
      await ouraService.fetchPersonalInfo();
    } catch {
      throw new Error('Invalid Oura token');
    }

    const { error } = await supabase.auth.updateUser({
      data: {
        oura_token: token,
        oura_connected: true,
        oura_connected_at: new Date().toISOString(),
      },
    });

    if (error) throw error;
  }
}
