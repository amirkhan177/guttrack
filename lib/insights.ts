import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { MealLog, OuraMetrics, WorkoutLog, LabResult, Supplement, SupplementLog, WeightEntry, DailyFeedback } from './supabase'

export const INSIGHTS_MODEL = 'gemini-flash-latest'

export function getFiberLevel(carbs: string | null): string {
  if (!carbs) return 'low'
  const c = carbs.toLowerCase()
  if (['leafy greens', 'legumes', 'beans', 'oats', 'cooked vegetables'].some(t => c.includes(t))) return 'high'
  if (['lentils', 'dal', 'tofu'].some(t => c.includes(t))) return 'moderate'
  return 'low'
}

export function getTimeOfDay(timestamp: string): string {
  const hour = new Date(timestamp).getHours()
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}

export function formatMealPrompt(meal: MealLog, timeLabel: string): string {
  const fiber = getFiberLevel(meal.carbs)
  const symptoms = meal.symptom_tags?.length > 0 ? meal.symptom_tags.join(', ') : 'none'
  const foodDesc = meal.food_description ? ` [raw: ${meal.food_description}]` : ''
  return `  ${meal.meal_type} (${timeLabel}): protein=${meal.protein}, carbs=${meal.carbs} (fiber:${fiber}), spice=${meal.spice}, alcohol=${meal.alcohol || 'None'}, feeling=${meal.feeling}, symptoms=[${symptoms}]${foodDesc}`
}

export interface InsightsData {
  mealsYest: MealLog[]
  mealsToday: MealLog[]
  oura: OuraMetrics | null
  feedback: DailyFeedback[]
  weight: WeightEntry[]
  suppTaken: (SupplementLog & { supplements: Supplement })[]
  suppScheduled: Supplement[]
  workouts: WorkoutLog[]
  labs: LabResult[]
  userMetadata: Record<string, unknown>
}

export function constructInsightsPrompt(data: InsightsData): string {
  const { mealsYest, mealsToday, oura, feedback, weight, suppTaken, suppScheduled, workouts, labs, userMetadata } = data

  const mealsYestLines = mealsYest.map(m => formatMealPrompt(m, getTimeOfDay(m.timestamp)))
  const mealsTodayLines = mealsToday.map(m => formatMealPrompt(m, getTimeOfDay(m.timestamp)))

  const mealsSection = [
    mealsYestLines.length > 0 ? `YESTERDAY MEALS:\n${mealsYestLines.join('\n')}` : 'YESTERDAY MEALS: None logged',
    mealsTodayLines.length > 0 ? `TODAY MEALS SO FAR:\n${mealsTodayLines.join('\n')}` : 'TODAY MEALS SO FAR: None yet',
  ].join('\n\n')

  let ouraSection = 'OURA BIOMETRICS (yesterday): No data'
  if (oura) {
    const lines = Object.entries(oura)
      .filter(([k, v]) => !['id', 'user_id', 'created_at'].includes(k) && v !== null)
      .map(([k, v]) => `  ${k}: ${v}`)
    ouraSection = `OURA BIOMETRICS (yesterday):\n${lines.join('\n')}`
  }

  const workoutLines = workouts.map((w) =>
    `  ${w.date} ${w.activity}: ${w.duration_seconds ? Math.round(w.duration_seconds / 60) + 'min' : ''} ${w.calories ? w.calories + 'kcal' : ''} avg_hr=${w.average_heart_rate ?? '?'}`
  )
  const workoutsSection = workoutLines.length > 0
    ? `WORKOUTS (recent):\n${workoutLines.join('\n')}`
    : 'WORKOUTS: None recorded'

  const feedbackLines = feedback.map((fb) =>
    `  ${fb.date}: predicted=${fb.predicted_flare_level}, actual=${fb.actual_flare_level}, accuracy=${fb.accuracy_score}%`
  )
  const feedbackSection = feedbackLines.length > 0
    ? `PREDICTION ACCURACY HISTORY (use to calibrate — correct for past over/under prediction):\n${feedbackLines.join('\n')}`
    : 'PREDICTION ACCURACY HISTORY: No entries yet — use clinical defaults'

  let weightSection = 'WEIGHT: No data'
  if (weight.length > 0) {
    const vals = weight.map((w) => `${w.date}:${w.weight_kg}kg`).join(', ')
    const delta = weight.length >= 2
      ? ` (7d delta: ${(weight[0].weight_kg! - weight[weight.length - 1].weight_kg!).toFixed(1)}kg)`
      : ''
    weightSection = `WEIGHT: ${vals}${delta}`
  }

  const suppMap: Record<string, boolean> = {}
  for (const log of suppTaken) {
    const name = log.supplements?.name ?? log.supplement_id
    suppMap[name] = true
  }
  const meds = suppScheduled.filter((s) => s.category === 'medication')
  const supps = suppScheduled.filter((s) => s.category !== 'medication')

  const suppLines = supps.map((s) =>
    `  ${s.name} ${s.dosage ?? ''}${s.unit ?? ''}: ${suppMap[s.name] ? 'taken' : 'skipped'}`
  )
  const medLines = meds.map((s) =>
    `  ${s.name} ${s.dosage ?? ''}${s.unit ?? ''} (${s.frequency ?? 'daily'}): ${suppMap[s.name] ? 'taken' : 'MISSED'}`
  )
  const suppSection = suppLines.length > 0 ? `SUPPLEMENTS:\n${suppLines.join('\n')}` : 'SUPPLEMENTS: None'
  const medSection = medLines.length > 0
    ? `MEDICATIONS (missed doses clinically significant for IgA nephropathy):\n${medLines.join('\n')}`
    : 'MEDICATIONS: None'

  const labLines = labs.slice(0, 10).map((l) =>
    `  ${l.name}: ${l.value} ${l.unit ?? ''} [${l.status ?? 'Unknown'}] (${l.date ?? 'no date'})`
  )
  const labsSection = labLines.length > 0 ? `RECENT LAB RESULTS:\n${labLines.join('\n')}` : ''

  const profileLines: string[] = []
  if (userMetadata.age) profileLines.push(`Age: ${userMetadata.age}`)
  if (userMetadata.height_cm) {
    const height = userMetadata.height_cm as number
    const totalIn = Math.round(height / 2.54)
    profileLines.push(`Height: ${Math.floor(totalIn / 12)}ft ${totalIn % 12}in`)
  }
  if (userMetadata.ethnicity) profileLines.push(`Ethnicity: ${userMetadata.ethnicity}`)
  const profileSection = profileLines.length > 0
    ? `PATIENT PROFILE:\n${profileLines.join('\n')}`
    : ''

  const coldStart = feedback.length < 3
    ? '\nNOTE: Fewer than 3 feedback entries — apply conservative post-giardia IgA nephropathy clinical defaults. Flag low confidence.'
    : ''

  return [
    profileSection, mealsSection, ouraSection, workoutsSection,
    feedbackSection, weightSection, suppSection, medSection, labsSection,
  ].filter(Boolean).join('\n\n') + coldStart
}

export async function generateDailyInsights(genAI: GoogleGenerativeAI, promptData: string) {
  const model = genAI.getGenerativeModel({
    model: INSIGHTS_MODEL,
    safetySettings: [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
    ],
    systemInstruction: `You are a personal gut health AI specializing in post-giardia gut recovery and IgA nephropathy kidney protection.

You receive yesterday's complete health data (sleep, biometrics, workouts, meals, medications, supplements, lab results) plus a history of past prediction accuracy.

Your job is TWO things in ONE response:
1. Analyze what happened yesterday and why the gut responded the way it did
2. Forecast how the person will feel TODAY and give concrete food/lifestyle guidance for today

Use the feedback accuracy history to calibrate — correct for past over or under-prediction patterns.
Return ONLY valid JSON. Zero markdown.`,
  })

  return model.generateContent(`Analyze yesterday's data and forecast today. Return this exact JSON:
{
  "summary": {
    "gut_score": <int 0-100>,
    "readiness_label": <string e.g. "Well Rested">,
    "sleep_quality": <string e.g. "Deep sleep low">,
    "stress_level": <string e.g. "Elevated">,
    "one_line": <string — single sentence summary of yesterday>
  },
  "flare_risk": {
    "level": <"None"|"Low"|"Moderate"|"High"|"Critical">,
    "reason": <specific paragraph referencing actual signals>,
    "contributing_factors": <string[]>
  },
  "what_happened": <plain English narrative — connect food, sleep, stress, symptoms>,
  "symptoms": <string[] — symptoms logged>,
  "today_forecast": {
    "how_youll_feel": <paragraph — how gut will likely feel today based on yesterday's signals>,
    "flare_risk_level": <"None"|"Low"|"Moderate"|"High"|"Critical">,
    "confidence_percent": <int 0-100>,
    "reasoning": <why this forecast — reference specific signals>
  },
  "avoid_today": [{ "label": <string>, "reason": <string>, "duration": <string> }],
  "add_to_diet_today": [{ "label": <string>, "reason": <string>, "timing": <string e.g. "with lunch"> }],
  "watch_for": <string[] — symptom signals to monitor today>,
  "patterns": <string[] — recurring patterns detected across history>
}

DATA:
${promptData}`)
}
