import { createSupabaseBrowserClient } from "@/lib/supabase";

export class DeleteUserDataUseCase {
  private supabase = createSupabaseBrowserClient();

  async execute() {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) return;

    const uid = user.id;

    await Promise.all([
      this.supabase.from("meal_logs").delete().eq("user_id", uid),
      this.supabase.from("weight_entries").delete().eq("user_id", uid),
      this.supabase.from("oura_metrics").delete().eq("user_id", uid),
      this.supabase.from("lab_results").delete().eq("user_id", uid),
      this.supabase.from("supplements").delete().eq("user_id", uid),
      this.supabase.from("supplement_logs").delete().eq("user_id", uid),
      this.supabase.from("daily_insights").delete().eq("user_id", uid),
      this.supabase.from("daily_feedback").delete().eq("user_id", uid),
    ]);

    await this.supabase.auth.signOut();
  }
}
