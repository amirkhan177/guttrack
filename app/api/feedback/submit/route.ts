export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { SubmitFeedbackUseCase } from '@/src/features/feedback/use-cases/SubmitFeedbackUseCase';

function getSupabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseServer();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    interface FeedbackRequest {
      date: string;
      feeling_score: string;
      actual_flare_level: string;
      actual_symptoms: string[];
      notes?: string;
    }

    let body: FeedbackRequest;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const useCase = new SubmitFeedbackUseCase();
    const result = await useCase.execute(user.id, body);

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error('[feedback/submit] unexpected error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
