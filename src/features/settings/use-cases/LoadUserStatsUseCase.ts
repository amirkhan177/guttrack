import { createSupabaseBrowserClient } from "@/lib/supabase";

export class LoadUserStatsUseCase {
  private supabase = createSupabaseBrowserClient();

  async execute() {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    
    if (!user) return null;

    const uid = user.id;

    const [meals, supplements, labs, insights, feedback] = await Promise.all([
      this.supabase
        .from("meal_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid),
      this.supabase
        .from("supplements")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid)
        .eq("active", true),
      this.supabase
        .from("lab_results")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid),
      this.supabase
        .from("daily_insights")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid),
      this.supabase
        .from("daily_feedback")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid),
    ]);

    return {
      meals: meals.count ?? 0,
      supplements: supplements.count ?? 0,
      labs: labs.count ?? 0,
      insights: insights.count ?? 0,
      feedback: feedback.count ?? 0,
    };
  }
}
