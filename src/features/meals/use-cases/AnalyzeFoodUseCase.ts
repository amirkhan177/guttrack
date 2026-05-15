import { AIService } from '@/src/data/services/AIService';
import { FoodAnalysis } from '@/src/core/entities/Meal';

export class AnalyzeFoodUseCase {
  private aiService: AIService;

  constructor(apiKey: string) {
    this.aiService = new AIService(apiKey);
  }

  async execute(description: string): Promise<FoodAnalysis> {
    if (!description || description.trim().length < 3) {
      throw new Error('Description too short for analysis');
    }
    
    return this.aiService.analyzeFood(description);
  }
}
