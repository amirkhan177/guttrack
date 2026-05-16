export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

function getSupabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignore error if called from Server Component
          }
        },
      },
    }
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(`${window.location.origin}/settings?oura_error=${error}`);
  }

  if (!code) {
    return NextResponse.redirect(`${window.location.origin}/settings?oura_error=no_code`);
  }

  try {
    const clientId = process.env.OURA_CLIENT_ID;
    const clientSecret = process.env.OURA_CLIENT_SECRET;
    const redirectUri = `${new URL(request.url).origin}/api/oura/callback`;

    // Exchange code for token
    const tokenResponse = await fetch('https://api.ouraring.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId!,
        client_secret: clientSecret!,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errData = await tokenResponse.json();
      console.error('[oura/callback] Token exchange failed:', errData);
      return NextResponse.redirect(`${new URL(request.url).origin}/settings?oura_error=token_exchange_failed`);
    }

    const tokens = await tokenResponse.json();

    // Save tokens to Supabase
    const supabase = getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(`${new URL(request.url).origin}/auth`);
    }

    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        oura_token: tokens.access_token,
        oura_refresh_token: tokens.refresh_token,
        oura_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        oura_connected: true,
        oura_connected_at: new Date().toISOString(),
      },
    });

    if (updateError) throw updateError;

    return NextResponse.redirect(`${new URL(request.url).origin}/settings?oura_success=true`);
  } catch (err) {
    console.error('[oura/callback] Error:', err);
    return NextResponse.redirect(`${new URL(request.url).origin}/settings?oura_error=internal_error`);
  }
}
