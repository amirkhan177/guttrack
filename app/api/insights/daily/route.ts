export const dynamic = 'force-dynamic'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

function getSupabaseServer() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
}

function getMtnDate(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Denver' })
}

function getFiberLevel(carbs: string): string {
  if (!carbs) return 'low'
  if (['Leafy Greens', 'Legumes/Beans', 'Oats', 'Cooked Vegetables'].some(t => carbs.includes(t))) return 'high'
  if (['Lentils/Dal', 'Tofu'].some(t => carbs.includes(t))) return 'moderate'
  return 'low'
}

function getTimeOfDay(timestamp: string): string {
  const hour = new Date(timestamp).getHours()
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}

export async function POST() {
  try {
    const supabase = getSupabaseServer()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const yesterday = getMtnDate(-1)
    const today = getMtnDate(0)

    // Fetch all data in parallel
    const [
      mealsYestResult,
      mealsTodayResult,
      ouraResult,
      feedbackResult,
      weightResult,
      suppTakenResult,
      suppScheduledResult,
      workoutsResult,
      labsResult,
    ] = await Promise.all([
      supabase.from('meal_logs').select('*').eq('user_id', user.id)
        .gte('timestamp', new Date(`${yesterday}T00:00:00-07:00`).toISOString())
        .lte('timestamp', new Date(`${yesterday}T23:59:59-07:00`).toISOString()),

      supabase.from('meal_logs').select('*').eq('user_id', user.id)
        .gte('timestamp', new Date(`${today}T00:00:00-07:00`).toISOString())
        .lte('timestamp', new Date(`${today}T23:59:59-07:00`).toISOString()),

      supabase.from('oura_metrics').select('*').eq('user_id', user.id).eq('date', yesterday).maybeSingle(),

      supabase.from('daily_feedback').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(30),

      supabase.from('weight_entries').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(7),

      supabase.from('supplement_logs').select('*, supplements(*)').eq('user_id', user.id).eq('date', yesterday),

      supabase.from('supplements').select('*').eq('user_id', user.id).eq('active', true),

      supabase.from('workout_logs').select('*').eq('user_id', user.id)
        .gte('date', yesterday).lte('date', today).order('date', { ascending: false }),

      supabase.from('lab_results').select('*').eq('user_id', user.id)
        .order('date', { ascending: false }).limit(20),
    ])

    const mealsYest = mealsYestResult.data ?? []
    const mealsToday = mealsTodayResult.data ?? []
    const oura = ouraResult.data
    const feedback = feedbackResult.data ?? []
    const weight = weightResult.data ?? []
    const suppTaken = suppTakenResult.data ?? []
    const suppScheduled = suppScheduledResult.data ?? []
    const workouts = workoutsResult.data ?? []
    const labs = labsResult.data ?? []

    // ── Build prompt sections ──

    const formatMeal = (meal: Record<string, unknown>, timeLabel: string) => {
      const fiber = getFiberLevel((meal.carbs as string) ?? '')
      const symptoms = Array.isArray(meal.symptom_tags) ? meal.symptom_tags.join(', ') : 'none'
      const foodDesc = meal.food_description ? ` [raw: ${meal.food_description}]` : ''
      return `  ${meal.meal_type} (${timeLabel}): protein=${meal.protein}, carbs=${meal.carbs} (fiber:${fiber}), spice=${meal.spice}, alcohol=${meal.alcohol || 'None'}, feeling=${meal.feeling}, symptoms=[${symptoms}]${foodDesc}`
    }

    const mealsYestLines = mealsYest.map(m => formatMeal(m as Record<string, unknown>, getTimeOfDay(m.timestamp)))
    const mealsTodayLines = mealsToday.map(m => formatMeal(m as Record<string, unknown>, getTimeOfDay(m.timestamp)))

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

    const workoutLines = workouts.map((w: Record<string, unknown>) =>
      `  ${w.date} ${w.activity}: ${w.duration_seconds ? Math.round((w.duration_seconds as number) / 60) + 'min' : ''} ${w.calories ? w.calories + 'kcal' : ''} avg_hr=${w.average_heart_rate ?? '?'}`
    )
    const workoutsSection = workoutLines.length > 0
      ? `WORKOUTS (recent):\n${workoutLines.join('\n')}`
      : 'WORKOUTS: None recorded'

    const feedbackLines = feedback.map((fb: Record<string, unknown>) =>
      `  ${fb.date}: predicted=${fb.predicted_flare_level}, actual=${fb.actual_flare_level}, accuracy=${fb.accuracy_score}%`
    )
    const feedbackSection = feedbackLines.length > 0
      ? `PREDICTION ACCURACY HISTORY (use to calibrate — correct for past over/under prediction):\n${feedbackLines.join('\n')}`
      : 'PREDICTION ACCURACY HISTORY: No entries yet — use clinical defaults'

    let weightSection = 'WEIGHT: No data'
    if (weight.length > 0) {
      const vals = weight.map((w: Record<string, unknown>) => `${w.date}:${w.weight_kg}kg`).join(', ')
      const delta = weight.length >= 2
        ? ` (7d delta: ${((weight[0].weight_kg as number) - (weight[weight.length - 1].weight_kg as number)).toFixed(1)}kg)`
        : ''
      weightSection = `WEIGHT: ${vals}${delta}`
    }

    const suppMap: Record<string, boolean> = {}
    for (const log of suppTaken) {
      const name = (log.supplements as Record<string, unknown>)?.name as string ?? log.supplement_id
      suppMap[name] = true
    }
    const meds = suppScheduled.filter((s: Record<string, unknown>) => s.category === 'medication')
    const supps = suppScheduled.filter((s: Record<string, unknown>) => s.category !== 'medication')

    const suppLines = supps.map((s: Record<string, unknown>) =>
      `  ${s.name} ${s.dosage ?? ''}${s.unit ?? ''}: ${suppMap[s.name as string] ? 'taken' : 'skipped'}`
    )
    const medLines = meds.map((s: Record<string, unknown>) =>
      `  ${s.name} ${s.dosage ?? ''}${s.unit ?? ''} (${s.frequency ?? 'daily'}): ${suppMap[s.name as string] ? 'taken' : 'MISSED'}`
    )
    const suppSection = suppLines.length > 0 ? `SUPPLEMENTS:\n${suppLines.join('\n')}` : 'SUPPLEMENTS: None'
    const medSection = medLines.length > 0
      ? `MEDICATIONS (missed doses clinically significant for IgA nephropathy):\n${medLines.join('\n')}`
      : 'MEDICATIONS: None'

    const labLines = labs.slice(0, 10).map((l: Record<string, unknown>) =>
      `  ${l.name}: ${l.value} ${l.unit ?? ''} [${l.status ?? 'Unknown'}] (${l.date ?? 'no date'})`
    )
    const labsSection = labLines.length > 0 ? `RECENT LAB RESULTS:\n${labLines.join('\n')}` : ''

    const meta = user.user_metadata ?? {}
    const profileLines: string[] = []
    if (meta.age) profileLines.push(`Age: ${meta.age}`)
    if (meta.height_cm) {
      const totalIn = Math.round(meta.height_cm / 2.54)
      profileLines.push(`Height: ${Math.floor(totalIn / 12)}ft ${totalIn % 12}in`)
    }
    if (meta.ethnicity) profileLines.push(`Ethnicity: ${meta.ethnicity}`)
    const profileSection = profileLines.length > 0
      ? `PATIENT PROFILE:\n${profileLines.join('\n')}`
      : ''

    const coldStart = feedback.length < 3
      ? '\nNOTE: Fewer than 3 feedback entries — apply conservative post-giardia IgA nephropathy clinical defaults. Flag low confidence.'
      : ''

    const promptData = [
      profileSection, mealsSection, ouraSection, workoutsSection,
      feedbackSection, weightSection, suppSection, medSection, labsSection,
    ].filter(Boolean).join('\n\n')

    // ── Single Claude call — analysis + forecast combined ──
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2500,
      system: `You are a personal gut health AI specializing in post-giardia gut recovery and IgA nephropathy kidney protection.

You receive yesterday's complete health data (sleep, biometrics, workouts, meals, medications, supplements, lab results) plus a history of past prediction accuracy.

Your job is TWO things in ONE response:
1. Analyze what happened yesterday and why the gut responded the way it did
2. Forecast how the person will feel TODAY and give concrete food/lifestyle guidance for today

Use the feedback accuracy history to calibrate — correct for past over or under-prediction patterns.
Return ONLY valid JSON. Zero markdown.`,
      messages: [{
        role: 'user',
        content: `Analyze yesterday's data and forecast today. Return this exact JSON:
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
${promptData}${coldStart}`
      }]
    })

    const rawText = response.content[0].type === 'text' ? response.content[0].text : ''
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(rawText)
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/)
      if (!match) return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
      parsed = JSON.parse(match[0])
    }

    const summary = parsed.summary as Record<string, unknown>
    const flareRisk = parsed.flare_risk as Record<string, unknown>
    const forecast = parsed.today_forecast as Record<string, unknown>

    // Store as single 'daily' record — delete old and insert fresh
    await supabase.from('daily_insights').delete()
      .eq('user_id', user.id).eq('date', yesterday).in('window_type', ['analysis', 'prediction', 'daily'])

    await supabase.from('daily_insights').insert({
      user_id: user.id,
      date: yesterday,
      window_type: 'daily',
      generated_at: new Date().toISOString(),
      flare_risk_level: flareRisk?.level ?? null,
      flare_risk_reason: flareRisk?.reason ?? null,
      contributing_factors: flareRisk?.contributing_factors ?? [],
      what_happened: parsed.what_happened ?? null,
      avoid: parsed.avoid_today ?? [],
      add_to_diet: parsed.add_to_diet_today ?? [],
      patterns: parsed.patterns ?? [],
      prediction: { ...forecast, watch_for: parsed.watch_for },
      prediction_confidence: forecast?.confidence_percent ?? null,
    })

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Daily insights error:', error)
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 })
  }
}
