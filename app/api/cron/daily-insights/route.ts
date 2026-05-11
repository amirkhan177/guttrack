export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { TextBlock } from '@anthropic-ai/sdk/resources/messages/messages'
import { OuraClient } from '@/lib/oura'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

function getMtnDateStr(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Denver' })
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
    .gte('date', since)
    .limit(1)

  if (error) {
    console.error(`[cron/daily-insights] meal check error for ${userId}:`, error)
    return false
  }
  return (data?.length ?? 0) > 0
}

async function generateInsightsForUser(
  userId: string,
  date: string,
  service: ReturnType<typeof getServiceClient>,
  anthropic: Anthropic
): Promise<void> {
  const yesterday = getMtnDateStr(-1)

  // Fetch all relevant data for the user
  const [mealsRes, ouraRes, feedbackRes, weightRes, supplementsRes] = await Promise.allSettled([
    service
      .from('meal_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('date', yesterday)
      .lte('date', date)
      .order('date', { ascending: false }),
    service
      .from('oura_metrics')
      .select('*')
      .eq('user_id', userId)
      .gte('date', yesterday)
      .lte('date', date)
      .order('date', { ascending: false }),
    service
      .from('daily_feedback')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(14),
    service
      .from('weight_entries')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(7),
    service
      .from('supplement_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('date', yesterday)
      .lte('date', date),
  ])

  const meals = mealsRes.status === 'fulfilled' ? (mealsRes.value.data ?? []) : []
  const oura = ouraRes.status === 'fulfilled' ? (ouraRes.value.data ?? []) : []
  const feedback = feedbackRes.status === 'fulfilled' ? (feedbackRes.value.data ?? []) : []
  const weight = weightRes.status === 'fulfilled' ? (weightRes.value.data ?? []) : []
  const supplements = supplementsRes.status === 'fulfilled' ? (supplementsRes.value.data ?? []) : []

  const contextBlock = JSON.stringify({
    date,
    meals,
    oura_metrics: oura,
    recent_feedback: feedback,
    weight_entries: weight,
    supplements,
  })

  // Generate daily summary insight
  const summaryMessage = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: `You are GutTrack, an AI gut health analyst. Analyze the user's health data and generate a concise daily summary. Return valid JSON only with these fields:
{
  "summary": "string - 2-3 sentence overview",
  "gut_score": number (0-100),
  "flare_risk_level": "None" | "Low" | "Moderate" | "High" | "Critical",
  "key_observations": ["string"],
  "recommendations": ["string"]
}`,
    messages: [
      {
        role: 'user',
        content: `Generate a daily gut health summary for ${date}.\n\nData:\n${contextBlock}`,
      },
    ],
  })

  const summaryTextBlock = summaryMessage.content.find(
    (b): b is TextBlock => b.type === 'text'
  )
  const summaryText = summaryTextBlock?.text ?? '{}'

  let summaryData: Record<string, unknown> = {}
  try {
    summaryData = JSON.parse(summaryText)
  } catch {
    console.error(`[cron/daily-insights] failed to parse summary JSON for user ${userId}`)
  }

  // Upsert summary insight
  await service.from('daily_insights').upsert(
    {
      user_id: userId,
      date,
      window_type: 'summary',
      summary: summaryData.summary ?? null,
      gut_score: summaryData.gut_score ?? null,
      flare_risk_level: summaryData.flare_risk_level ?? null,
      key_observations: summaryData.key_observations ?? [],
      recommendations: summaryData.recommendations ?? [],
      prediction: null,
      generated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,date,window_type' }
  )

  // Generate prediction insight for tomorrow
  const tomorrow = getMtnDateStr(1)
  const predictionMessage = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: `You are GutTrack, an AI gut health predictor. Based on today's data, predict tomorrow's gut health. Return valid JSON only:
{
  "flare_risk_level": "None" | "Low" | "Moderate" | "High" | "Critical",
  "confidence": number (0-100),
  "watch_for": ["string - symptom names"],
  "reasoning": "string",
  "preventive_actions": ["string"]
}`,
    messages: [
      {
        role: 'user',
        content: `Predict gut health for ${tomorrow} based on today's (${date}) data.\n\nData:\n${contextBlock}`,
      },
    ],
  })

  const predictionTextBlock = predictionMessage.content.find(
    (b): b is TextBlock => b.type === 'text'
  )
  const predictionText = predictionTextBlock?.text ?? '{}'

  let predictionData: Record<string, unknown> = {}
  try {
    predictionData = JSON.parse(predictionText)
  } catch {
    console.error(`[cron/daily-insights] failed to parse prediction JSON for user ${userId}`)
  }

  // Upsert prediction insight
  await service.from('daily_insights').upsert(
    {
      user_id: userId,
      date: tomorrow,
      window_type: 'prediction',
      summary: null,
      gut_score: null,
      flare_risk_level: predictionData.flare_risk_level ?? null,
      key_observations: [],
      recommendations: predictionData.preventive_actions ?? [],
      prediction: predictionData,
      generated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,date,window_type' }
  )
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const service = getServiceClient()
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const { data: usersData, error: usersError } = await service.auth.admin.listUsers()
    if (usersError) {
      console.error('[cron/daily-insights] failed to list users:', usersError)
      return NextResponse.json({ error: 'Failed to list users' }, { status: 500 })
    }

    const ouraUsers = (usersData.users as UserRecord[]).filter(
      u => u.user_metadata?.oura_connected && u.user_metadata?.oura_token
    )

    const yesterday = getMtnDateStr(-1)
    const today = getMtnDateStr(0)

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
        const ouraClient = new OuraClient(user.user_metadata.oura_token as string)
        await Promise.allSettled([
          ouraClient.syncToSupabase(user.id, yesterday),
          ouraClient.syncToSupabase(user.id, today),
        ])

        // Generate insights for today
        await generateInsightsForUser(user.id, today, service, anthropic)

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
