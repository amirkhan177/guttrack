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

export async function GET() {
  const clientId = process.env.OURA_CLIENT_ID;
  
  // Use exact production origin to prevent mismatch
  const redirectUri = `https://guttrack-xi.vercel.app/api/oura/callback`;
  
  // Simplified scopes - only the standard ones
  const scopes = [
    'email',
    'personal',
    'daily',
    'heartrate',
    'workout',
    'tag',
    'session',
    'spo2',
    'stress'
  ];
  
  const scope = scopes.join(' ');
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
