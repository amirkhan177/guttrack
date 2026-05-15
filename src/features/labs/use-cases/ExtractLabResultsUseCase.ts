import { AIService } from '@/src/data/services/AIService';

export type ExtractedLab = {
  name: string;
  value: string;
  unit: string;
  status: 'Normal' | 'Elevated' | 'Low' | 'Unknown';
  reference_range: string;
  date: string | null;
};

const SYSTEM_PROMPT = `You are a medical lab report parser. Your job is to extract structured lab test results from lab reports.

CRITICAL PRIVACY RULES — YOU MUST FOLLOW THESE WITHOUT EXCEPTION:
- IGNORE and DO NOT output: patient name, date of birth, age, address, phone number, email, MRN/patient ID, doctor name, clinic name, account number, SSN, insurance ID
- Only extract the actual lab test measurements and their values
- If you see any PII, treat it as invisible

Your task: extract every lab test result and return structured JSON.

Return ONLY valid JSON, no markdown, no explanation. Schema:
{
  "labs": [
    {
      "name": "test name (e.g. Creatinine, eGFR, Hemoglobin)",
      "value": "numeric or text value as string",
      "unit": "unit of measurement (e.g. mg/dL, g/dL, %)",
      "status": "Normal | Elevated | Low | Unknown",
      "reference_range": "reference range if visible (e.g. 0.6-1.2) else empty string",
      "date": "collection date as YYYY-MM-DD if visible in report else null"
    }
  ]
}

Determine status from:
- Explicit H/L/HIGH/LOW/ABNORMAL flags in the report
- Whether the value is outside the reference range
- If unclear: "Unknown"`;

export class ExtractLabResultsUseCase {
  private aiService: AIService;

  constructor(apiKey: string) {
    this.aiService = new AIService(apiKey);
  }

  async execute(fileBase64: string, mimeType: string): Promise<ExtractedLab[]> {
    // Map MIME type
    let finalMime = mimeType;
    if (mimeType === 'image/jpg') finalMime = 'image/jpeg';

    const raw = await this.aiService.extractFromImage(
      fileBase64,
      finalMime,
      SYSTEM_PROMPT,
      'Extract all lab test results from this report. Remember: ignore all patient PII. Return only the JSON object.'
    );

    let parsed: { labs: ExtractedLab[] };

    try {
      const match = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(match ? match[0] : raw);
    } catch {
      throw new Error('No JSON in response from AI');
    }

    if (!Array.isArray(parsed.labs)) {
      throw new Error('Could not parse lab results from document');
    }

    // Enforce status values
    const validStatuses = ['Normal', 'Elevated', 'Low', 'Unknown'];
    return parsed.labs.map((lab) => ({
      ...lab,
      status: validStatuses.includes(lab.status)
        ? (lab.status as ExtractedLab['status'])
        : 'Unknown',
    }));
  }
}
