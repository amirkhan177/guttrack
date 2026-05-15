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

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[oura/connect] Auth error:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { token } = await request.json();
    console.log('[oura/connect] Attempting connect for user:', user.id);

    const useCase = new ConnectOuraUseCase();
    await useCase.execute(supabase, token);

    console.log('[oura/connect] Success for user:', user.id);
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
