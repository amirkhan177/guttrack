import OpenAI from 'openai';
import { FoodAnalysis, FoodAnalysisSchema } from '@/src/core/entities/Meal';

export interface DailyInsightAIResponse {
  flare_risk: {
    level: 'None' | 'Low' | 'Moderate' | 'High' | 'Critical';
    reason: string;
    contributing_factors: string[];
  };
  gut_score: number;
  one_line_summary: string;
  biometric_analysis: {
    readiness_label: string;
    sleep_quality: string;
    stress_level: string;
  };
  what_happened_yesterday: {
    description: string;
    symptom_tags: string[];
  };
  today_forecast: {
    how_youll_feel: string;
    reasoning: string;
    confidence_percent: number;
    watch_for: string[];
  };
  dietary_guidance: {
    avoid_today: { item: string; reason: string; duration: string }[];
    add_to_diet_today: { item: string; reason: string; timing: string }[];
  };
  patterns_detected: string[];
}

export class AIService {
  private openai: OpenAI;
  private modelName = 'baidu/cobuddy:free';

  constructor(apiKey: string) {
    this.openai = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://guttrack.app', // Optional, for OpenRouter rankings
        'X-Title': 'GutTrack', // Optional
      }
    });
  }

  private async withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
    try {
      return await fn();
    } catch (err: any) {
      const status = err.status || 0;
      if ((status === 503 || status === 429) && retries > 0) {
        console.warn(`[AIService] AI service busy (${status}). Retrying in ${delay}ms... (${retries} left)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.withRetry(fn, retries - 1, delay * 2);
      }
      throw err;
    }
  }

  private parseJsonFromResponse(raw: string): unknown {
    try {
      return JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) {
        console.error('Failed to parse JSON from AI response. Raw output:', raw);
        throw new Error('AI failed to return valid JSON');
      }
      return JSON.parse(match[0]);
    }
  }

  async analyzeFood(description: string): Promise<FoodAnalysis> {
    const systemPrompt = `You are a gut health nutrition analyst specializing in post-giardia gut recovery and IgA nephropathy kidney protection.
Given a food description, map it to structured fields and provide gut-specific analysis.

PROTEIN options (pick the single closest match): Chicken, Fish, Eggs, Red Meat, Lentils/Dal, Tofu, None
CARBS options (pick the single closest match): White Rice, Bread, Pasta, Cooked Vegetables, Leafy Greens, Legumes/Beans, Oats, None
SPICE options (pick one): None, Mild, Medium, Hot, Very Hot

Return JSON with exactly this structure:
{
  "protein": "string",
  "carbs": "string",
  "spice": "string",
  "gut_notes": "string",
  "fiber_level": "high" | "moderate" | "low",
  "key_nutrients": ["string"],
  "gut_cautions": ["string"],
  "ibs_trigger_risk": "low" | "moderate" | "high",
  "kidney_notes": "string"
}`;

    return this.withRetry(async () => {
      const response = await this.openai.chat.completions.create({
        model: this.modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analyze this food for gut health impact: "${description}"` }
        ],
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0].message.content || '';
      return FoodAnalysisSchema.parse(this.parseJsonFromResponse(content));
    });
  }

  async generateDailyInsight(promptData: string): Promise<DailyInsightAIResponse> {
    const systemPrompt = `You are a personal gut health AI.
Analyze biometrics and meals to provide daily insights.

REQUIRED JSON STRUCTURE:
{
  "flare_risk": {
    "level": "None" | "Low" | "Moderate" | "High" | "Critical",
    "reason": "short explanation",
    "contributing_factors": ["string"]
  },
  "gut_score": number (0-100),
  "one_line_summary": "one sentence summary",
  "biometric_analysis": {
    "readiness_label": "e.g. Optimal Readiness",
    "sleep_quality": "e.g. Good Rest",
    "stress_level": "e.g. Low Stress"
  },
  "what_happened_yesterday": {
    "description": "summary of yesterday",
    "symptom_tags": ["string"]
  },
  "today_forecast": {
    "how_youll_feel": "forecast for today",
    "reasoning": "why",
    "confidence_percent": number,
    "watch_for": ["string"]
  },
  "dietary_guidance": {
    "avoid_today": [{ "item": "string", "reason": "string", "duration": "string" }],
    "add_to_diet_today": [{ "item": "string", "reason": "string", "timing": "string" }]
  },
  "patterns_detected": ["string"]
}`;

    return this.withRetry(async () => {
      const response = await this.openai.chat.completions.create({
        model: this.modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: promptData }
        ],
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0].message.content || '';
      return this.parseJsonFromResponse(content) as DailyInsightAIResponse;
    });
  }

  async predictFutureHealth(promptData: string): Promise<Record<string, unknown>> {
    const systemPrompt = `You are a personalized gut health prediction engine. You have today's Oura biometrics, recent meal patterns, and this person's history of predictions versus actual outcomes. Your job is to forecast tomorrow's gut health. Use the feedback accuracy history to calibrate — if you previously over-predicted flares adjust downward. If certain food and stress signal combinations reliably triggered symptoms weight those heavily. Return only valid JSON.`;

    return this.withRetry(async () => {
      const response = await this.openai.chat.completions.create({
        model: this.modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Predict tomorrow's gut health and return JSON matching exactly this schema:
{
  "forecast": { "flare_risk_level": "None"|"Low"|"Moderate"|"High"|"Critical", "confidence_percent": number, "reasoning": string },
  "avoid_tomorrow": [{ "label": string, "reason": string }],
  "eat_tomorrow": [{ "label": string, "reason": string, "timing": string }],
  "watch_for": string[]
}

DATA:
${promptData}` }
        ],
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0].message.content || '';
      return this.parseJsonFromResponse(content) as Record<string, unknown>;
    });
  }

  async extractFromImage(fileBase64: string, mimeType: string, systemPrompt: string, userPrompt: string): Promise<string> {
    const visionModel = 'baidu/ernie-4.5-vl-28b-a3b'; // Using ERNIE 4.5 VL for vision

    return this.withRetry(async () => {
      const response = await this.openai.chat.completions.create({
        model: visionModel,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${fileBase64}`,
                },
              },
            ],
          },
        ],
      });

      return response.choices[0].message.content || '';
    });
  }
}
