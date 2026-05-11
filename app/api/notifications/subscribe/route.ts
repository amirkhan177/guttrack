export const dynamic = 'force-dynamic'

import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
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

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
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
      subscription: PushSubscriptionJSON
      userId?: string
    }

    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { subscription } = body

    if (
      !subscription ||
      typeof subscription !== 'object' ||
      !subscription.endpoint
    ) {
      return NextResponse.json(
        { error: 'Invalid subscription object — must include endpoint' },
        { status: 400 }
      )
    }

    // Fetch current user metadata so we can spread-merge it
    const service = getServiceClient()

    const { data: userData, error: userFetchError } = await service.auth.admin.getUserById(user.id)
    if (userFetchError) {
      console.error('[notifications/subscribe] failed to fetch user metadata:', userFetchError)
      return NextResponse.json({ error: 'Failed to fetch user data' }, { status: 500 })
    }

    const currentMeta = userData.user?.user_metadata ?? {}

    const { error: updateError } = await service.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...currentMeta,
        push_subscription: subscription,
        notifications_enabled: true,
      },
    })

    if (updateError) {
      console.error('[notifications/subscribe] failed to save subscription:', updateError)
      return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[notifications/subscribe] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
