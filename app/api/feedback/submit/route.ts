export const dynamic = 'force-dynamic'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

function getSupabaseServer() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
}

const FLARE_ORDER: Record<string, number> = {
  None: 0,
  Low: 1,
  Moderate: 2,
  High: 3,
  Critical: 4,
}

function computeAccuracyScore(
  predictedFlareLevel: string | null,
  actualFlareLevel: string,
  predictedSymptoms: string[],
  actualSymptoms: string[]
): number {
  let score = 100

  // Flare level comparison
  if (predictedFlareLevel !== null) {
    const predictedOrder = FLARE_ORDER[predictedFlareLevel] ?? 0
    const actualOrder = FLARE_ORDER[actualFlareLevel] ?? 0
    const diff = Math.abs(predictedOrder - actualOrder)
    if (diff === 1) score -= 25
    else if (diff === 2) score -= 50
    else if (diff >= 3) score -= 75
  } else {
    // No prediction available — penalise fully
    const actualOrder = FLARE_ORDER[actualFlareLevel] ?? 0
    if (actualOrder > 0) score -= 50
  }

  // Symptom comparison
  const predictedSet = new Set(predictedSymptoms)
  const actualSet = new Set(actualSymptoms)

  // Use Array.from to avoid downlevelIteration requirement for Set iteration
  for (const sym of Array.from(actualSet)) {
    if (!predictedSet.has(sym)) score -= 5
  }
  for (const sym of Array.from(predictedSet)) {
    if (!actualSet.has(sym)) score -= 3
  }

  return Math.max(0, score)
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseServer()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: {
      date: string
      feeling_score: string
      actual_flare_level: string
      actual_symptoms: string[]
      notes?: string
    }

    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { date, feeling_score, actual_flare_level, actual_symptoms, notes } = body

    if (!date || !feeling_score || !actual_flare_level || !Array.isArray(actual_symptoms)) {
      return NextResponse.json(
        { error: 'Missing required fields: date, feeling_score, actual_flare_level, actual_symptoms' },
        { status: 400 }
      )
    }

    if (!(actual_flare_level in FLARE_ORDER)) {
      return NextResponse.json(
        { error: `Invalid actual_flare_level. Must be one of: ${Object.keys(FLARE_ORDER).join(', ')}` },
        { status: 400 }
      )
    }

    // Load prediction from daily_insights — daily record is stored under yesterday's date
    const feedbackDate = new Date(date + 'T12:00:00')
    feedbackDate.setDate(feedbackDate.getDate() - 1)
    const insightDate = feedbackDate.toISOString().split('T')[0]

    const { data: insight } = await supabase
      .from('daily_insights')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', insightDate)
      .eq('window_type', 'daily')
      .maybeSingle()

    const predictionJson = insight?.prediction as { flare_risk_level?: string; watch_for?: string[] } | null
    const predictedFlareLevel: string | null = predictionJson?.flare_risk_level ?? insight?.flare_risk_level ?? null
    const predictedSymptoms: string[] = predictionJson?.watch_for ?? []

    const accuracyScore = computeAccuracyScore(
      predictedFlareLevel,
      actual_flare_level,
      predictedSymptoms,
      actual_symptoms
    )

    const { error: upsertError } = await supabase
      .from('daily_feedback')
      .upsert(
        {
          user_id: user.id,
          date,
          predicted_flare_level: predictedFlareLevel,
          actual_flare_level,
          predicted_symptoms: predictedSymptoms,
          actual_symptoms,
          feeling_score,
          accuracy_score: accuracyScore,
          notes: notes ?? null,
          submitted_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,date' }
      )

    if (upsertError) {
      console.error('[feedback/submit] upsert error:', upsertError)
      return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 })
    }

    let message = 'Feedback submitted successfully.'
    if (accuracyScore >= 90) message = 'Great prediction accuracy!'
    else if (accuracyScore >= 70) message = 'Good prediction. Small gaps noted.'
    else if (accuracyScore >= 50) message = 'Moderate accuracy. Your data will help improve predictions.'
    else message = 'Significant difference from prediction. This feedback is valuable for learning.'

    return NextResponse.json({ accuracy_score: accuracyScore, message })
  } catch (err) {
    console.error('[feedback/submit] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
