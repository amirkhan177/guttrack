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

export async function POST() {
  try {
    const supabase = getSupabaseServer()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const today = getMtnDate(0)
    const yesterday = getMtnDate(-1)

    // Fetch all data in parallel
    const [
      ouraResult,
      mealsTodayResult,
      mealsYesterdayResult,
      feedbackResult,
      insightHistoryResult,
      medicationsResult,
    ] = await Promise.all([
      supabase
        .from('oura_metrics')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', yesterday)
        .maybeSingle(),

      supabase
        .from('meal_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('timestamp', new Date(`${today}T00:00:00-07:00`).toISOString())
        .lte('timestamp', new Date(`${today}T23:59:59-07:00`).toISOString()),

      supabase
        .from('meal_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('timestamp', new Date(`${yesterday}T00:00:00-07:00`).toISOString())
        .lte('timestamp', new Date(`${yesterday}T23:59:59-07:00`).toISOString()),

      supabase
        .from('daily_feedback')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(30),

      supabase
        .from('daily_insights')
        .select('*')
        .eq('user_id', user.id)
        .eq('window_type', 'analysis')
        .order('date', { ascending: false })
        .limit(30),

      supabase
        .from('supplements')
        .select('*')
        .eq('user_id', user.id)
        .eq('active', true)
        .eq('category', 'medication'),
    ])

    const oura = ouraResult.data
    const mealsToday = mealsTodayResult.data ?? []
    const mealsYesterday = mealsYesterdayResult.data ?? []
    const feedback = feedbackResult.data ?? []
    const insightHistory = insightHistoryResult.data ?? []
    const medications = medicationsResult.data ?? []

    // Cold start check
    const coldStartNote =
      feedback.length < 3
        ? '\n\nCOLD START: Fewer than 3 feedback entries exist. Use general post-giardia and IgA nephropathy clinical defaults and note low confidence.'
        : ''

    // Build prompt sections
    let ouraSection = 'YESTERDAY OURA SIGNALS: No data available'
    if (oura) {
      const ouraLines = Object.entries(oura)
        .filter(([key, val]) => !['id', 'user_id', 'created_at', 'updated_at'].includes(key) && val !== null && val !== undefined)
        .map(([key, val]) => `${key}: ${val}`)
      ouraSection = `YESTERDAY OURA SIGNALS:\n${ouraLines.join('\n')}`
    }

    const formatMeals = (meals: Record<string, unknown>[], label: string): string => {
      if (meals.length === 0) return `${label}: No meals logged`
      const lines = meals.map((meal) => {
        const symptoms = Array.isArray(meal.symptom_tags) ? meal.symptom_tags.join(', ') : ''
        return `  - ${meal.meal_type}: protein=${meal.protein}, carbs=${meal.carbs}, spice=${meal.spice}, alcohol=${meal.alcohol || 'None'}, feeling=${meal.feeling}, symptoms=[${symptoms}]`
      })
      return `${label}:\n${lines.join('\n')}`
    }

    const mealsTodaySection = formatMeals(mealsToday as Record<string, unknown>[], "TODAY'S MEALS SO FAR")
    const mealsYesterdaySection = formatMeals(mealsYesterday as Record<string, unknown>[], "YESTERDAY'S MEALS")

    const feedbackLines = feedback.map((fb: Record<string, unknown>) =>
      `  ${fb.date}: predicted ${fb.predicted_score}, actual ${fb.actual_score}, accuracy ${fb.accuracy_percent}%`
    )
    const feedbackSection = feedbackLines.length > 0
      ? `FEEDBACK ACCURACY HISTORY (last ${feedback.length} entries):\n${feedbackLines.join('\n')}`
      : 'FEEDBACK ACCURACY HISTORY: No entries yet'

    const patternLines = insightHistory
      .map((insight: Record<string, unknown>) => {
        const patterns = Array.isArray(insight.patterns) ? insight.patterns.join('; ') : ''
        return patterns ? `  ${insight.date}: ${patterns}` : null
      })
      .filter(Boolean)
    const insightSection = patternLines.length > 0
      ? `RECENT ANALYSIS PATTERNS:\n${patternLines.join('\n')}`
      : 'RECENT ANALYSIS PATTERNS: No history available'

    const medicationLines = (medications as Record<string, unknown>[]).map(m =>
      `  ${m.name} ${m.dosage ?? ''}${m.unit ?? ''} — ${m.frequency ?? 'daily'} (${m.time_of_day ?? 'unspecified time'})`
    )
    const medicationsSection = medicationLines.length > 0
      ? `DAILY MEDICATIONS (assume taken unless otherwise noted — factor these into prediction; these are prescribed for IgA nephropathy and post-giardia recovery):\n${medicationLines.join('\n')}`
      : 'DAILY MEDICATIONS: None'

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

    const promptSections = [
      profileSection,
      ouraSection,
      mealsTodaySection,
      mealsYesterdaySection,
      feedbackSection,
      insightSection,
      medicationsSection,
    ].filter(Boolean).join('\n\n')

    // Call Anthropic
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: `You are a personalized gut health prediction engine. You have today's Oura biometrics, recent meal patterns, and this person's history of predictions versus actual outcomes. Your job is to forecast tomorrow's gut health. Use the feedback accuracy history to calibrate — if you previously over-predicted flares adjust downward. If certain food and stress signal combinations reliably triggered symptoms weight those heavily. Return only valid JSON.`,
      messages: [
        {
          role: 'user',
          content: `Predict tomorrow's gut health and return JSON matching exactly this schema:
{
  "forecast": { "flare_risk_level": "None"|"Low"|"Moderate"|"High"|"Critical", "confidence_percent": number, "reasoning": string },
  "avoid_tomorrow": [{ "label": string, "reason": string }],
  "eat_tomorrow": [{ "label": string, "reason": string, "timing": string }],
  "watch_for": string[]
}

DATA:
${promptSections}${coldStartNote}`,
        },
      ],
    })

    const rawText =
      response.content[0].type === 'text' ? response.content[0].text : ''

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(rawText)
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/)
      if (!match) {
        return NextResponse.json(
          { error: 'Failed to parse AI response as JSON' },
          { status: 500 }
        )
      }
      parsed = JSON.parse(match[0])
    }

    const forecast = parsed.forecast as Record<string, unknown>

    // Delete existing prediction for today and insert fresh
    await supabase
      .from('daily_insights')
      .delete()
      .eq('user_id', user.id)
      .eq('date', today)
      .eq('window_type', 'prediction')

    await supabase.from('daily_insights').insert({
      user_id: user.id,
      date: today,
      window_type: 'prediction',
      generated_at: new Date().toISOString(),
      flare_risk_level: forecast.flare_risk_level,
      flare_risk_reason: forecast.reasoning,
      prediction: parsed,
      prediction_confidence: forecast.confidence_percent,
    })

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Predict insights error:', error)
    return NextResponse.json(
      { error: 'Failed to generate prediction' },
      { status: 500 }
    )
  }
}
