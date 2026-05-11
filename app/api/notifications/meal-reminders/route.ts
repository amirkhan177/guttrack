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
    meal_reminders_enabled?: boolean
    [key: string]: unknown
  }
}

function getMealName(): string {
  const mtnHour = parseInt(
    new Date().toLocaleString('en-US', {
      timeZone: 'America/Denver',
      hour: 'numeric',
      hour12: false,
    })
  )

  if (mtnHour >= 12 && mtnHour < 15) return 'Lunch'
  if (mtnHour >= 17) return 'Dinner'
  return 'Breakfast'
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
      console.error('[notifications/meal-reminders] failed to list users:', usersError)
      return NextResponse.json({ error: 'Failed to list users' }, { status: 500 })
    }

    // Only send to users who have both push subscriptions AND meal reminders enabled
    const eligibleUsers = (usersData.users as UserRecord[]).filter(
      u => u.user_metadata?.push_subscription && u.user_metadata?.meal_reminders_enabled === true
    )

    const mealName = getMealName()

    const payload = JSON.stringify({
      title: 'GutTrack',
      body: `Time to log your ${mealName}!`,
      tag: 'meal-reminder',
      type: 'meal',
    })

    let sent = 0
    let failed = 0

    await Promise.allSettled(
      eligibleUsers.map(async user => {
        try {
          const sub = user.user_metadata.push_subscription as webpush.PushSubscription
          await webpush.sendNotification(sub, payload)
          sent++
        } catch (err) {
          console.error(`[notifications/meal-reminders] failed to send to user ${user.id}:`, err)
          failed++

          // Clean up expired/gone subscriptions
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
                  meal_reminders_enabled: false,
                },
              })
            } catch (cleanupErr) {
              console.error(`[notifications/meal-reminders] failed to clear stale sub for ${user.id}:`, cleanupErr)
            }
          }
        }
      })
    )

    return NextResponse.json({ sent, failed, meal: mealName })
  } catch (err) {
    console.error('[notifications/meal-reminders] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
