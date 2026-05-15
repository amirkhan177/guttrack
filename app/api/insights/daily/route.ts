export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { GenerateDailyInsightUseCase } from '@/src/features/insights/use-cases/GenerateDailyInsightUseCase';
import { InsightRepository } from '@/src/data/repositories/InsightRepository';
import { getMtnDate } from '@/lib/dates';

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
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const apiKey = user.user_metadata?.ai_api_key || user.user_metadata?.gemini_api_key || process.env.AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('AI API key is not set. Please provide it in Settings.');

    const useCase = new GenerateDailyInsightUseCase(apiKey);
    await useCase.execute(user.id, user.user_metadata || {});

    // Return the generated insight
    const insightRepo = new InsightRepository();
    const yesterday = getMtnDate(-1);
    const insights = await insightRepo.getInsightsForDate(user.id, yesterday);

    return NextResponse.json(insights[0] || { success: true });
  } catch (error: unknown) {
    console.error('Daily insights error:', error);
    let message = 'Failed to generate insights';
    
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === 'object' && error !== null) {
      message = JSON.stringify(error);
    } else if (typeof error === 'string') {
      message = error;
    }

    return NextResponse.json({ 
      error: 'Failed to generate insights',
      message
    }, { status: 500 });
  }
}
