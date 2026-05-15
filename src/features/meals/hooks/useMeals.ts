import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MealRepository } from '@/src/data/repositories/MealRepository';
import { Meal } from '@/src/core/entities/Meal';

const mealRepo = new MealRepository();

export function useMeals(userId: string, start: string, end: string) {
  return useQuery({
    queryKey: ['meals', userId, start, end],
    queryFn: () => mealRepo.getMealsForDate(userId, start, end),
    enabled: !!userId,
  });
}

export function useCreateMeal() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (meal: Omit<Meal, 'id' | 'created_at'>) => mealRepo.createMeal(meal),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meals'] });
    },
  });
}

export function useDeleteMeal() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ userId, mealId }: { userId: string; mealId: string }) => 
      mealRepo.deleteMeal(userId, mealId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meals'] });
    },
  });
}
