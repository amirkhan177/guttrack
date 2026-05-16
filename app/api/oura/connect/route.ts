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
  const clientId = process.env.OURA_CLIENT_ID;
  const redirectUri = `https://guttrack-xi.vercel.app/api/oura/callback`;
  
  if (!clientId) {
    return NextResponse.json({ error: 'OURA_CLIENT_ID is missing' }, { status: 500 });
  }

  // Exact same string as working example
  const scope = 'email+personal+daily+heartrate+tag+workout+session+spo2+ring_configuration+stress+heart_health';
  
  // Use URL object to construct to ensure perfect encoding
  const url = new URL('https://cloud.ouraring.com/oauth/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  // Note: URLSearchParams will encode + as %2B or spaces as +. 
  // Oura might be picky. Let's try literal string first as it worked in example.
  
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
    const { error } = await supabase.auth.updateUser({
      data: {
        oura_token: token,
        oura_connected: true,
        oura_connected_at: new Date().toISOString()
      }
    });
    
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
