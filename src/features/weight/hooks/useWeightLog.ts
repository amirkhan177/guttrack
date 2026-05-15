import { useState, useCallback, useEffect } from 'react';
import { WeightRepository } from '@/src/data/repositories/WeightRepository';
import { AuthRepository } from '@/src/data/repositories/AuthRepository';
import { SaveWeightUseCase } from '../use-cases/SaveWeightUseCase';
import { WeightEntry } from '@/src/core/entities/WeightEntry';

export function useWeightLog() {
  const [weightValue, setWeightValue] = useState('');
  const [weightUnit, setWeightUnit] = useState<'lbs' | 'kg'>('lbs');
  const [recentWeights, setRecentWeights] = useState<WeightEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWeights = useCallback(async () => {
    try {
      const authRepo = new AuthRepository();
      const weightRepo = new WeightRepository();
      const user = await authRepo.getUser();
      if (!user) return;
      const data = await weightRepo.getWeightHistory(user.id, 7);
      setRecentWeights(data);
    } catch (e) {
      console.error('Failed to load weights:', e);
    }
  }, []);

  useEffect(() => {
    loadWeights();
  }, [loadWeights, success]);

  const save = useCallback(async () => {
    if (!weightValue) return;
    setSaving(true);
    setError(null);
    try {
      const authRepo = new AuthRepository();
      const user = await authRepo.getUser();
      if (!user) throw new Error('Unauthorized');
      
      const useCase = new SaveWeightUseCase();
      await useCase.execute(user.id, parseFloat(weightValue), weightUnit);
      
      setWeightValue('');
      setSuccess((v) => !v);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [weightValue, weightUnit]);

  return {
    weightValue, setWeightValue,
    weightUnit, setWeightUnit,
    recentWeights,
    saving,
    success,
    error,
    save,
  };
}
