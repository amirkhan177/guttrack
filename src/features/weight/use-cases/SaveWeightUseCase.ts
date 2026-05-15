import { WeightRepository } from '@/src/data/repositories/WeightRepository';

export class SaveWeightUseCase {
  private weightRepo = new WeightRepository();

  async execute(userId: string, weight: number, unit: 'kg' | 'lbs', date?: string): Promise<void> {
    if (isNaN(weight) || weight <= 0) {
      throw new Error('Invalid weight value');
    }
    
    const kg = unit === 'lbs' ? weight / 2.20462 : weight;
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    await this.weightRepo.upsertWeight({
      user_id: userId,
      date: targetDate,
      weight_kg: parseFloat(kg.toFixed(2)),
    });
  }
}
