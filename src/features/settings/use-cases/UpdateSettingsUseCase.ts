import { createSupabaseBrowserClient } from "@/lib/supabase";

export class UpdateSettingsUseCase {
  private supabase = createSupabaseBrowserClient();

  async updateAIKey(key: string) {
    const { error } = await this.supabase.auth.updateUser({
      data: { ai_api_key: key.trim() },
    });
    if (error) throw error;
  }

  async updateNotifications(data: {
    meal_reminders: boolean;
    breakfast_time: string;
    lunch_time: string;
    dinner_time: string;
    feedback_reminder: boolean;
  }) {
    const { error } = await this.supabase.auth.updateUser({
      data,
    });
    if (error) throw error;
  }

  async updateWeightUnit(unit: "lbs" | "kg") {
    const { error } = await this.supabase.auth.updateUser({
      data: { weight_unit: unit },
    });
    if (error) throw error;
  }

  async updateHealthProfile(data: {
    age: number | null;
    ethnicity: string | null;
    height_cm: number | null;
  }) {
    const { error } = await this.supabase.auth.updateUser({
      data,
    });
    if (error) throw error;
  }
}
