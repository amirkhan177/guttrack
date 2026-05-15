import { createSupabaseBrowserClient } from "@/lib/supabase";

export class LoadUserDataUseCase {
  private supabase = createSupabaseBrowserClient();

  async execute() {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    
    if (!user) return null;

    const meta = user.user_metadata ?? {};
    
    return {
      oura_connected: !!meta.oura_connected,
      oura_last_sync: meta.oura_last_sync ?? null,
      ai_api_key: meta.ai_api_key ?? meta.gemini_api_key ?? "",
      meal_reminders: !!meta.meal_reminders,
      breakfast_time: meta.breakfast_time ?? "08:00",
      lunch_time: meta.lunch_time ?? "12:30",
      dinner_time: meta.dinner_time ?? "19:00",
      feedback_reminder: !!meta.feedback_reminder,
      weight_unit: meta.weight_unit === "kg" ? "kg" : "lbs",
      age: meta.age ?? "",
      ethnicity: meta.ethnicity ?? "",
      height_cm: meta.height_cm ?? null,
    };
  }
}
