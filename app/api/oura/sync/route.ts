export const dynamic = 'force-dynamic'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { OuraClient } from '@/lib/oura'
import { getMtnDate } from '@/lib/dates'

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

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ouraToken: string | undefined = user.user_metadata?.oura_token
    if (!ouraToken) {
      return NextResponse.json(
        { error: 'Oura token not found. Please connect your Oura Ring first.' },
        { status: 400 }
      )
    }

    const ouraClient = new OuraClient(ouraToken)

    const today = getMtnDate(0)
    const yesterday = getMtnDate(-1)

    await ouraClient.syncToSupabase(user.id, today)
    await ouraClient.syncToSupabase(user.id, yesterday)

    const syncedAt = new Date().toISOString()
    await supabase.auth.updateUser({
      data: { oura_last_sync: syncedAt },
    })

    return NextResponse.json({
      success: true,
      synced: [yesterday, today],
      synced_at: syncedAt,
    })
  } catch (error) {
    console.error('Oura sync error:', error)
    return NextResponse.json(
      { error: 'Failed to sync Oura data' },
      { status: 500 }
    )
  }
}
