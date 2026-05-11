export const dynamic = 'force-dynamic'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { OuraClient } from '@/lib/oura'

function getSupabaseServer() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
}

interface ConnectBody {
  token: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServer()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: ConnectBody
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    if (!body.token || typeof body.token !== 'string' || body.token.trim() === '') {
      return NextResponse.json(
        { error: 'Token is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    const ouraClient = new OuraClient(body.token)

    try {
      await ouraClient.fetchPersonalInfo()
    } catch {
      return NextResponse.json(
        { error: 'Invalid Oura token. Please check your token and try again.' },
        { status: 400 }
      )
    }

    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        oura_token: body.token,
        oura_connected: true,
        oura_connected_at: new Date().toISOString(),
      },
    })

    if (updateError) {
      console.error('Failed to save Oura token:', updateError)
      return NextResponse.json(
        { error: 'Failed to save Oura token' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Oura Ring connected',
    })
  } catch (error) {
    console.error('Oura connect error:', error)
    return NextResponse.json(
      { error: 'Failed to connect Oura Ring' },
      { status: 500 }
    )
  }
}
