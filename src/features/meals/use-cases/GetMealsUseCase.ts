import { MealRepository } from '@/src/data/repositories/MealRepository';
import { Meal } from '@/src/core/entities/Meal';

export class GetMealsUseCase {
  private mealRepo = new MealRepository();

  async execute(userId: string, start: string, end: string): Promise<Meal[]> {
    return this.mealRepo.getMealsForDate(userId, start, end);
  }
}
