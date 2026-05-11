export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

interface UserRecord {
  id: string
  user_metadata: {
    push_subscription?: webpush.PushSubscription
    [key: string]: unknown
  }
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    webpush.setVapidDetails(
      'mailto:guttrack@example.com',
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    )

    const service = getServiceClient()

    const { data: usersData, error: usersError } = await service.auth.admin.listUsers()
    if (usersError) {
      console.error('[notifications/feedback-reminder] failed to list users:', usersError)
      return NextResponse.json({ error: 'Failed to list users' }, { status: 500 })
    }

    const pushUsers = (usersData.users as UserRecord[]).filter(
      u => u.user_metadata?.push_subscription
    )

    let sent = 0
    let failed = 0

    const payload = JSON.stringify({
      title: 'GutTrack',
      body: 'How did today go? Log your feedback to improve predictions.',
      tag: 'feedback-reminder',
      type: 'feedback',
    })

    await Promise.allSettled(
      pushUsers.map(async user => {
        try {
          const sub = user.user_metadata.push_subscription as webpush.PushSubscription
          await webpush.sendNotification(sub, payload)
          sent++
        } catch (err) {
          console.error(`[notifications/feedback-reminder] failed to send to user ${user.id}:`, err)
          failed++

          // If the subscription is gone (410 Gone or 404), remove it from metadata
          if (
            err instanceof Error &&
            (err.message.includes('410') || err.message.includes('404'))
          ) {
            try {
              await service.auth.admin.updateUserById(user.id, {
                user_metadata: {
                  ...user.user_metadata,
                  push_subscription: null,
                  notifications_enabled: false,
                },
              })
            } catch (cleanupErr) {
              console.error(`[notifications/feedback-reminder] failed to clear stale sub for ${user.id}:`, cleanupErr)
            }
          }
        }
      })
    )

    return NextResponse.json({ sent, failed })
  } catch (err) {
    console.error('[notifications/feedback-reminder] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
