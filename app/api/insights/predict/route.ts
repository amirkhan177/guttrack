export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { PredictGutHealthUseCase } from '@/src/features/insights/use-cases/PredictGutHealthUseCase';

function getSupabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
}

export async function POST() {
  try {
    const supabase = getSupabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKey = user.user_metadata?.ai_api_key || user.user_metadata?.gemini_api_key || process.env.AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('AI API key not found in metadata or environment');
      return NextResponse.json({ error: 'AI API key is not set. Please provide it in Settings.' }, { status: 400 });
    }

    const useCase = new PredictGutHealthUseCase(apiKey);
    const prediction = await useCase.execute(user.id, user.user_metadata || {});

    return NextResponse.json(prediction);
  } catch (err: unknown) {
    console.error('Predict insights error:', err);
    const message = err instanceof Error ? err.message : 'Failed to generate prediction';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
