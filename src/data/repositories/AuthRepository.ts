import { createSupabaseBrowserClient } from '@/lib/supabase';

export class AuthRepository {
  private supabase = createSupabaseBrowserClient();

  async signInWithOtp(email: string) {
    const { error } = await this.supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    if (error) throw error;
  }

  async verifyOtp(email: string, token: string) {
    const { error } = await this.supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });
    if (error) throw error;
  }

  async signOut() {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw error;
  }

  async getUser() {
    const { data: { user }, error } = await this.supabase.auth.getUser();
    if (error) throw error;
    return user;
  }

  async updateUserMetadata(data: Record<string, unknown>) {
    const { error } = await this.supabase.auth.updateUser({
      data,
    });
    if (error) throw error;
  }
}
