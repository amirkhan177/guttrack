import { createSupabaseServiceClient } from '@/lib/supabase';
import { Meal, MealSchema } from '@/src/core/entities/Meal';

export class MealRepository {
  private supabase = createSupabaseServiceClient();

  async getMealsForDate(userId: string, start: string, end: string): Promise<Meal[]> {
    const { data, error } = await this.supabase
      .from('meal_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('timestamp', start)
      .lte('timestamp', end)
      .order('timestamp', { ascending: false });

    if (error) throw error;
    return (data || []).map((m) => MealSchema.parse(m));
  }

  async createMeal(meal: Omit<Meal, 'id' | 'created_at'>): Promise<Meal> {
    const { data, error } = await this.supabase
      .from('meal_logs')
      .insert(meal)
      .select()
      .single();

    if (error) throw error;
    return MealSchema.parse(data);
  }

  async updateMeal(userId: string, mealId: string, updates: Partial<Meal>): Promise<Meal> {
    const { data, error } = await this.supabase
      .from('meal_logs')
      .update(updates)
      .eq('id', mealId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return MealSchema.parse(data);
  }

  async getRecentMeals(userId: string, limit = 20): Promise<Meal[]> {
    const { data, error } = await this.supabase
      .from('meal_logs')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).map((m) => MealSchema.parse(m));
  }

  async deleteMeal(userId: string, mealId: string): Promise<void> {
    const { error } = await this.supabase
      .from('meal_logs')
      .delete()
      .eq('id', mealId)
      .eq('user_id', userId);

    if (error) throw error;
  }
}
