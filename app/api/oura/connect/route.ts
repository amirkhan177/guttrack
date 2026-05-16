export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { ConnectOuraUseCase } from '@/src/features/oura/use-cases/ConnectOuraUseCase';

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
  const clientId = process.env.OURA_CLIENT_ID;
  const { origin } = new URL(request.url);
  
  // Use HTTPS origin in production
  const finalOrigin = origin.includes('localhost') ? origin : 'https://guttrack-xi.vercel.app';
  const redirectUri = `${finalOrigin}/api/oura/callback`;
  
  // Scopes from user example, but formatted with + as separators if needed
  const scope = 'email personal daily heartrate tag workout session spo2 ring_configuration stress heart_health';
  const state = Math.random().toString(36).substring(7);

  const url = `https://cloud.ouraring.com/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${state}`;

  console.log('[oura/connect] Redirecting to Oura...', {
    clientId: clientId?.substring(0, 5) + '...',
    redirectUri,
    scope
  });

  return NextResponse.redirect(url);
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[oura/connect] Auth error:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { token } = await request.json();
    const useCase = new ConnectOuraUseCase();
    await useCase.execute(supabase, token);

    return NextResponse.json({
      success: true,
      message: 'Oura Ring connected',
    });
  } catch (err: unknown) {
    console.error('[oura/connect] Error:', err);
    const message = err instanceof Error ? err.message : 'Failed to connect Oura Ring';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
