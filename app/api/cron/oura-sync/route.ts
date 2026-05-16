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
          const meta = user.user_metadata;
          let accessToken = meta.oura_token;
          const refreshToken = meta.oura_refresh_token;
          const expiresAt = meta.oura_token_expires_at;

          // Refresh if expired or expiring soon (within 1 hour for cron)
          if (refreshToken && expiresAt && (new Date(expiresAt).getTime() - Date.now() < 3600000)) {
            console.log(`[cron/oura-sync] Refreshing token for user ${user.id}`);
            try {
              const newTokens = await OuraClient.refreshAccessToken(refreshToken);
              accessToken = newTokens.access_token;
              
              await service.auth.admin.updateUserById(user.id, {
                user_metadata: {
                  ...meta,
                  oura_token: newTokens.access_token,
                  oura_refresh_token: newTokens.refresh_token,
                  oura_token_expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
                }
              });
            } catch (err) {
              console.error(`[cron/oura-sync] Refresh failed for user ${user.id}:`, err);
            }
          }

          const client = new OuraClient(accessToken)
          // Sync yesterday + today to catch any late-arriving data
          await Promise.allSettled([
            client.syncToSupabase(user.id, yesterday),
            client.syncToSupabase(user.id, today),
          ])

          // Update last sync timestamp
          await service.auth.admin.updateUserById(user.id, {
            user_metadata: {
              ...(await service.auth.admin.getUserById(user.id)).data.user?.user_metadata, // Get latest metadata to avoid overwriting tokens
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
