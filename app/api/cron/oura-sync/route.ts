export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { OuraClient } from '@/lib/oura'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

function getMtnDate(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Denver' })
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = getServiceClient()
  const today = getMtnDate(0)
  const yesterday = getMtnDate(-1)

  let processed = 0
  const errors: string[] = []

  try {
    const { data: { users } } = await service.auth.admin.listUsers({ perPage: 1000 })

    const ouraUsers = users.filter(u =>
      u.user_metadata?.oura_connected && u.user_metadata?.oura_token
    )

    await Promise.allSettled(
      ouraUsers.map(async (user) => {
        try {
          const client = new OuraClient(user.user_metadata.oura_token as string)
          // Sync yesterday + today to catch any late-arriving data
          await Promise.allSettled([
            client.syncToSupabase(user.id, yesterday),
            client.syncToSupabase(user.id, today),
          ])

          // Update last sync timestamp
          await service.auth.admin.updateUserById(user.id, {
            user_metadata: {
              ...user.user_metadata,
              oura_last_sync: new Date().toISOString(),
            },
          })

          processed++
        } catch (err) {
          errors.push(`${user.id}: ${err instanceof Error ? err.message : 'unknown error'}`)
        }
      })
    )

    return NextResponse.json({
      ok: true,
      processed,
      total_oura_users: ouraUsers.length,
      synced_dates: [yesterday, today],
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Oura sync cron error:', err)
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}
