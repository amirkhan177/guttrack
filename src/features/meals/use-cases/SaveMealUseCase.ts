import { MealRepository } from '@/src/data/repositories/MealRepository';
import { Meal } from '@/src/core/entities/Meal';

export class SaveMealUseCase {
  private mealRepo = new MealRepository();

  async execute(meal: Omit<Meal, 'id' | 'created_at'>): Promise<Meal> {
    if (!meal.timestamp) meal.timestamp = new Date().toISOString();
    return this.mealRepo.createMeal(meal);
  }
}
