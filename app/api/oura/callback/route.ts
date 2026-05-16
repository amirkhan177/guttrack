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
            // Ignore error
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
  const origin = 'https://guttrack-xi.vercel.app';

  console.log('[oura/callback] START', { code: code ? 'exists' : 'missing', error });

  if (error) {
    return NextResponse.redirect(`${origin}/settings?oura_error=${error}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/settings?oura_error=no_code`);
  }

  try {
    const clientId = process.env.OURA_CLIENT_ID;
    const clientSecret = process.env.OURA_CLIENT_SECRET;
    const redirectUri = `${origin}/api/oura/callback`;

    if (!clientId || !clientSecret) {
      console.error('[oura/callback] Missing credentials in environment');
      return NextResponse.redirect(`${origin}/settings?oura_error=missing_credentials`);
    }

    console.log('[oura/callback] EXCHANGING_CODE');
    const tokenResponse = await fetch('https://api.ouraring.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      console.error('[oura/callback] TOKEN_EXCHANGE_FAILED', { status: tokenResponse.status, error: errText });
      return NextResponse.redirect(`${origin}/settings?oura_error=token_exchange_failed&details=${encodeURIComponent(errText.substring(0, 50))}`);
    }

    const tokens = await tokenResponse.json();
    console.log('[oura/callback] TOKENS_RECEIVED');

    const supabase = getSupabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[oura/callback] NO_USER_SESSION', authError);
      return NextResponse.redirect(`${origin}/auth?reason=no_session`);
    }

    console.log('[oura/callback] SAVING_TO_DB', { userId: user.id });
    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        oura_token: tokens.access_token,
        oura_refresh_token: tokens.refresh_token,
        oura_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        oura_connected: true,
        oura_connected_at: new Date().toISOString(),
      },
    });

    if (updateError) {
      console.error('[oura/callback] DB_UPDATE_FAILED', updateError);
      return NextResponse.redirect(`${origin}/settings?oura_error=db_update_failed`);
    }

    console.log('[oura/callback] SUCCESS');
    return NextResponse.redirect(`${origin}/settings?oura_success=true`);
  } catch (err: unknown) {
    const error = err as Error;
    console.error('[oura/callback] CRASH', { message: error.message, stack: error.stack });
    return NextResponse.redirect(`${origin}/settings?oura_error=internal_crash`);
  }
}
