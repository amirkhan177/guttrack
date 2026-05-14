export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { OuraClient } from '@/lib/oura'
import { getMtnDate } from '@/lib/dates'
import { 
  constructInsightsPrompt, 
  generateDailyInsights, 
  InsightsData 
} from '@/lib/insights'
import type { 
  MealLog, 
  OuraMetrics, 
  DailyFeedback, 
  WeightEntry, 
  SupplementLog, 
  Supplement, 
  WorkoutLog, 
  LabResult 
} from '@/lib/supabase'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

interface UserRecord {
  id: string
  email?: string
  user_metadata: {
    oura_connected?: boolean
    oura_token?: string
    [key: string]: unknown
  }
}

async function hasRecentMeals(userId: string, service: ReturnType<typeof getServiceClient>): Promise<boolean> {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const since = sevenDaysAgo.toISOString().split('T')[0]

  const { data, error } = await service
    .from('meal_logs')
    .select('id')
    .eq('user_id', userId)
    .gte('timestamp', `${since}T00:00:00Z`)
    .limit(1)

  if (error) {
    console.error(`[cron/daily-insights] meal check error for ${userId}:`, error)
    return false
  }
  return (data?.length ?? 0) > 0
}

async function generateInsightsForUser(
  userId: string,
  userMetadata: Record<string, unknown>,
  service: ReturnType<typeof getServiceClient>,
  genAI: GoogleGenerativeAI
): Promise<void> {
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
    service.from('meal_logs').select('*').eq('user_id', userId)
      .gte('timestamp', new Date(`${yesterday}T00:00:00-07:00`).toISOString())
      .lte('timestamp', new Date(`${yesterday}T23:59:59-07:00`).toISOString()),

    service.from('meal_logs').select('*').eq('user_id', userId)
      .gte('timestamp', new Date(`${today}T00:00:00-07:00`).toISOString())
      .lte('timestamp', new Date(`${today}T23:59:59-07:00`).toISOString()),

    service.from('oura_metrics').select('*').eq('user_id', userId).eq('date', yesterday).maybeSingle(),

    service.from('daily_feedback').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(30),

    service.from('weight_entries').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(7),

    service.from('supplement_logs').select('*, supplements(*)').eq('user_id', userId).eq('date', yesterday),

    service.from('supplements').select('*').eq('user_id', userId).eq('active', true),

    service.from('workout_logs').select('*').eq('user_id', userId)
      .gte('date', yesterday).lte('date', today).order('date', { ascending: false }),

    service.from('lab_results').select('*').eq('user_id', userId)
      .order('date', { ascending: false }).limit(20),
  ])

  const insightsData: InsightsData = {
    mealsYest: (mealsYestResult.status === 'fulfilled' ? mealsYestResult.value.data as MealLog[] : []) ?? [],
    mealsToday: (mealsTodayResult.status === 'fulfilled' ? mealsTodayResult.value.data as MealLog[] : []) ?? [],
    oura: (ouraResult.status === 'fulfilled' ? ouraResult.value.data as OuraMetrics : null),
    feedback: (feedbackResult.status === 'fulfilled' ? feedbackResult.value.data as DailyFeedback[] : []) ?? [],
    weight: (weightResult.status === 'fulfilled' ? weightResult.value.data as WeightEntry[] : []) ?? [],
    suppTaken: (suppTakenResult.status === 'fulfilled' ? suppTakenResult.value.data as (SupplementLog & { supplements: Supplement })[] : []) ?? [],
    suppScheduled: (suppScheduledResult.status === 'fulfilled' ? suppScheduledResult.value.data as Supplement[] : []) ?? [],
    workouts: (workoutsResult.status === 'fulfilled' ? workoutsResult.value.data as WorkoutLog[] : []) ?? [],
    labs: (labsResult.status === 'fulfilled' ? labsResult.value.data as LabResult[] : []) ?? [],
    userMetadata: userMetadata
  }

  const promptData = constructInsightsPrompt(insightsData)
  const result = await generateDailyInsights(genAI, promptData)
  const response = await result.response
  const rawText = response.text()

  let parsed: Record<string, unknown>
  try {
    const match = rawText.match(/\{[\s\S]*\}/)
    parsed = JSON.parse(match ? match[0] : rawText)
  } catch (e) {
    console.error(`[cron/daily-insights] JSON parse error for ${userId}: ${e}`)
    return
  }

  const flareRisk = parsed.flare_risk as Record<string, unknown>
  const forecast = parsed.today_forecast as Record<string, unknown>

  await service.from('daily_insights').upsert({
    user_id: userId,
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
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const service = getServiceClient()
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

    const { data: usersData, error: usersError } = await service.auth.admin.listUsers()
    if (usersError) {
      console.error('[cron/daily-insights] failed to list users:', usersError)
      return NextResponse.json({ error: 'Failed to list users' }, { status: 500 })
    }

    const ouraUsers = (usersData.users as UserRecord[]).filter(
      u => u.user_metadata?.oura_connected && u.user_metadata?.oura_token
    )

    const yesterday = getMtnDate(-1)
    const today = getMtnDate(0)

    let processed = 0
    const errors: string[] = []

    for (const user of ouraUsers) {
      try {
        // Check for recent meal activity
        const hasActivity = await hasRecentMeals(user.id, service)
        if (!hasActivity) {
          console.log(`[cron/daily-insights] skipping user ${user.id} — no recent meals`)
          continue
        }

        // Sync Oura data for yesterday and today
        const ouraToken = user.user_metadata.oura_token as string
        if (ouraToken) {
          const ouraClient = new OuraClient(ouraToken)
          await Promise.allSettled([
            ouraClient.syncToSupabase(user.id, yesterday),
            ouraClient.syncToSupabase(user.id, today),
          ])
        }

        // Generate insights
        await generateInsightsForUser(user.id, user.user_metadata, service, genAI)

        processed++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[cron/daily-insights] error for user ${user.id}:`, msg)
        errors.push(`user ${user.id}: ${msg}`)
      }
    }

    return NextResponse.json({ processed, errors })
  } catch (err) {
    console.error('[cron/daily-insights] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
