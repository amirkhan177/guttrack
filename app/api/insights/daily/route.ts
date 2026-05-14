import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { 
  constructInsightsPrompt, 
  generateDailyInsights, 
  InsightsData 
} from '@/lib/insights'
import { getMtnDate } from '@/lib/dates'
import { 
  MealLog, 
  OuraMetrics, 
  DailyFeedback, 
  WeightEntry, 
  SupplementLog, 
  Supplement, 
  WorkoutLog, 
  LabResult 
} from '@/lib/supabase'


function getSupabaseServer() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
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

    const insightsData: InsightsData = {
      mealsYest: (mealsYestResult.data as MealLog[]) ?? [],
      mealsToday: (mealsTodayResult.data as MealLog[]) ?? [],
      oura: ouraResult.data as OuraMetrics,
      feedback: (feedbackResult.data as DailyFeedback[]) ?? [],
      weight: (weightResult.data as WeightEntry[]) ?? [],
      suppTaken: (suppTakenResult.data as (SupplementLog & { supplements: Supplement })[]) ?? [],
      suppScheduled: (suppScheduledResult.data as Supplement[]) ?? [],
      workouts: (workoutsResult.data as WorkoutLog[]) ?? [],
      labs: (labsResult.data as LabResult[]) ?? [],
      userMetadata: user.user_metadata ?? {}
    }

    const promptData = constructInsightsPrompt(insightsData)
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
    const result = await generateDailyInsights(genAI, promptData)
    const response = await result.response
    const rawText = response.text()

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(rawText)
    } catch (e) {
      console.error(`[api/insights/daily] JSON parse error: ${e}. Raw text: ${rawText}`)
      const match = rawText.match(/\{[\s\S]*\}/)
      if (!match) {
        return NextResponse.json({ 
          error: 'Failed to parse AI response',
          details: rawText.slice(0, 100) 
        }, { status: 500 })
      }
      try {
        parsed = JSON.parse(match[0])
      } catch {
        return NextResponse.json({ 
          error: 'Failed to parse AI response (regex match failed)',
          details: match[0].slice(0, 100)
        }, { status: 500 })
      }
    }

    const flareRisk = parsed.flare_risk as Record<string, unknown>
    const forecast = parsed.today_forecast as Record<string, unknown>

    // Store as single 'daily' record — using upsert pattern if possible
    await supabase.from('daily_insights').upsert({
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
    }, { onConflict: 'user_id,date,window_type' })

    return NextResponse.json(parsed)
  } catch (error: unknown) {
    console.error('Daily insights error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ 
      error: 'Failed to generate insights',
      message
    }, { status: 500 })
  }
}

