import { useState, useCallback, useEffect } from 'react';
import { AnalyzeFoodUseCase } from '../use-cases/AnalyzeFoodUseCase';
import { SaveMealUseCase } from '../use-cases/SaveMealUseCase';
import { FoodAnalysis, Meal } from '@/src/core/entities/Meal';
import { AuthRepository } from '@/src/data/repositories/AuthRepository';
import { MealRepository } from '@/src/data/repositories/MealRepository';

export type MealType = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';
export type Feeling = 'Great' | 'Good' | 'Okay' | 'Bad' | 'Awful';

export function useMealLog() {
  const [step, setStep] = useState<number>(1);
  const [mealType, setMealType] = useState<MealType>('Breakfast');
  const [protein, setProtein] = useState<string | null>(null);
  const [carbs, setCarbs] = useState<string | null>(null);
  const [spice, setSpice] = useState<string | null>(null);
  const [alcohol, setAlcohol] = useState<string | null>(null);
  const [alcoholQty, setAlcoholQty] = useState(1);
  const [feeling, setFeeling] = useState<Feeling | null>(null);
  const [symptoms, setSymptoms] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const [foodDescription, setFoodDescription] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [foodAnalysis, setFoodAnalysis] = useState<FoodAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [apiKey, setApiKey] = useState<string>('');
  const [recentMeals, setRecentMeals] = useState<Meal[]>([]);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);

  const loadRecentMeals = useCallback(async () => {
    try {
      const authRepo = new AuthRepository();
      const user = await authRepo.getUser();
      if (!user) return;
      const mealRepo = new MealRepository();
      const meals = await mealRepo.getRecentMeals(user.id, 10);
      setRecentMeals(meals);
    } catch (e) {
      console.error('Failed to load recent meals:', e);
    }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const authRepo = new AuthRepository();
        const user = await authRepo.getUser();
        const meta = user?.user_metadata || {};
        const key = meta.ai_api_key || meta.gemini_api_key;
        if (key) {
          setApiKey(key);
        }
        await loadRecentMeals();
      } catch (e) {
        console.error('Failed to initialize meal log:', e);
      }
    }
    init();
  }, [loadRecentMeals]);

  const reset = useCallback(() => {
    setStep(1);
    setProtein(null);
    setCarbs(null);
    setSpice(null);
    setAlcohol(null);
    setAlcoholQty(1);
    setFeeling(null);
    setSymptoms(new Set());
    setFoodDescription('');
    setFoodAnalysis(null);
    setAnalyzing(false);
    setError(null);
    setEditingMealId(null);
  }, []);

  const editMeal = useCallback((meal: Meal) => {
    setEditingMealId(meal.id || null);
    setMealType(meal.meal_type as MealType);
    setProtein(meal.protein);
    setCarbs(meal.carbs);
    setSpice(meal.spice);
    
    if (meal.alcohol && meal.alcohol !== 'None') {
      const parts = meal.alcohol.split(':');
      setAlcohol(parts[0]);
      setAlcoholQty(parseInt(parts[1]) || 1);
    } else {
      setAlcohol('None');
      setAlcoholQty(1);
    }
    
    setFeeling(meal.feeling as Feeling);
    setSymptoms(new Set(meal.symptom_tags));
    setFoodDescription(meal.food_description || '');
    setStep(1); // Jump to first step to review
    
    // Smooth scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const deleteMeal = useCallback(async (mealId: string) => {
    try {
      const authRepo = new AuthRepository();
      const user = await authRepo.getUser();
      if (!user) throw new Error('Unauthorized');
      const mealRepo = new MealRepository();
      await mealRepo.deleteMeal(user.id, mealId);
      await loadRecentMeals();
    } catch (e) {
      console.error('Failed to delete meal:', e);
      setError('Failed to delete meal');
    }
  }, [loadRecentMeals]);

  const analyze = useCallback(async () => {
    if (!foodDescription.trim() || analyzing) return;
    setAnalyzing(true);
    setError(null);
    try {
      const useCase = new AnalyzeFoodUseCase(apiKey);
      const data = await useCase.execute(foodDescription);
      setFoodAnalysis(data);
      if (data.protein) setProtein(data.protein);
      if (data.carbs) setCarbs(data.carbs);
      if (data.spice) setSpice(data.spice);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  }, [foodDescription, analyzing, apiKey]);

  const save = useCallback(async () => {
    if (!feeling) return;
    setSaving(true);
    setError(null);
    try {
      const authRepo = new AuthRepository();
      const user = await authRepo.getUser();
      if (!user) throw new Error('Unauthorized');

      const buildAlcoholString = () => {
        if (!alcohol || alcohol === 'None') return 'None';
        const ALCOHOL_OZ: Record<string, number> = { Beer: 14, Wine: 6, Spirit: 2 };
        const oz = (ALCOHOL_OZ[alcohol] || 0) * alcoholQty;
        return `${alcohol}:${alcoholQty}:${oz}oz`;
      };

      const mealRepo = new MealRepository();
      const mealData: Omit<Meal, 'id' | 'created_at'> = {
        user_id: user.id,
        timestamp: editingMealId 
          ? recentMeals.find(m => m.id === editingMealId)?.timestamp || new Date().toISOString()
          : new Date().toISOString(),
        meal_type: mealType,
        protein,
        carbs,
        spice,
        alcohol: buildAlcoholString(),
        feeling,
        symptom_tags: Array.from(symptoms),
        food_description: foodDescription || null,
      };

      if (editingMealId) {
        await mealRepo.updateMeal(user.id, editingMealId, mealData);
      } else {
        const useCase = new SaveMealUseCase();
        await useCase.execute(mealData);
      }

      setShowSuccess(true);
      await loadRecentMeals();
      setTimeout(() => {
        setShowSuccess(false);
        reset();
      }, 1600);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [feeling, mealType, protein, carbs, spice, alcohol, alcoholQty, symptoms, foodDescription, reset, editingMealId, recentMeals, loadRecentMeals]);

  return {
    step, setStep,
    mealType, setMealType,
    protein, setProtein,
    carbs, setCarbs,
    spice, setSpice,
    alcohol, setAlcohol,
    alcoholQty, setAlcoholQty,
    feeling, setFeeling,
    symptoms, setSymptoms,
    foodDescription, setFoodDescription,
    foodAnalysis,
    analyzing,
    saving,
    showSuccess,
    error,
    analyze,
    save,
    reset,
    recentMeals,
    editMeal,
    deleteMeal,
    editingMealId,
  };
}
