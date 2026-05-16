export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { SyncOuraDataUseCase } from '@/src/features/oura/use-cases/SyncOuraDataUseCase';
import { getMtnDate } from '@/lib/dates';

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

export async function POST() {
  try {
    const supabase = getSupabaseServer();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[oura/sync] Auth error:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ouraToken = user.user_metadata?.oura_token;
    if (!ouraToken) {
      console.warn('[oura/sync] No token for user:', user.id);
      return NextResponse.json(
        { error: 'Oura not connected. Please connect your Oura Ring in Settings.' },
        { status: 400 }
      );
    }

    console.log('[oura/sync] Starting sync for user:', user.id);
    const syncUseCase = new SyncOuraDataUseCase();

    const today = getMtnDate(0);
    const yesterday = getMtnDate(-1);

    await Promise.all([
      syncUseCase.execute(supabase, user.id, today),
      syncUseCase.execute(supabase, user.id, yesterday),
    ]);

    const syncedAt = new Date().toISOString();
    await supabase.auth.updateUser({
      data: { oura_last_sync: syncedAt },
    });

    console.log('[oura/sync] Success for user:', user.id);
    return NextResponse.json({
      success: true,
      synced_at: syncedAt,
    });
  } catch (error: unknown) {
    const err = error as { message?: string; stack?: string };
    console.error('[oura/sync] Detailed Error:', {
      message: err.message,
      stack: err.stack,
    });
    return NextResponse.json(
      { error: err.message || 'Failed to sync Oura data' },
      { status: 500 }
    );
  }
}
