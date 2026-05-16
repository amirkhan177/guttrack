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
  const redirectUri = `https://guttrack-xi.vercel.app/api/oura/callback`;
  
  if (!clientId) {
    return NextResponse.json({ error: 'OURA_CLIENT_ID is missing' }, { status: 500 });
  }

  // Exact same string as working example
  const scope = 'email+personal+daily+heartrate+tag+workout+session+spo2+ring_configuration+stress+heart_health';
  
  const finalUrl = `https://cloud.ouraring.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}`;

  console.log('[oura/connect] FINAL REDIRECT URL:', finalUrl);

  return NextResponse.redirect(finalUrl);
}

export async function POST(request: NextRequest) {
  // Manual token update support
  try {
    const supabase = getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { token } = await request.json();
    const useCase = new ConnectOuraUseCase();
    await useCase.execute(supabase, token);
    
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
