export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { AnalyzeFoodUseCase } from '@/src/features/meals/use-cases/AnalyzeFoodUseCase';

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
    // 1. Auth check
    const supabase = getSupabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Input validation
    const { description } = await req.json();
    if (!description) {
      return NextResponse.json({ error: 'Missing description' }, { status: 400 });
    }

    // 3. Execute Use Case
    const apiKey = user.user_metadata?.ai_api_key || user.user_metadata?.gemini_api_key || process.env.AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('AI API key not found in metadata or environment');
      return NextResponse.json({ error: 'AI API key is not set. Please provide it in Settings.' }, { status: 400 });
    }

    const useCase = new AnalyzeFoodUseCase(apiKey);
    const analysis = await useCase.execute(description);

    return NextResponse.json(analysis);
  } catch (err: unknown) {
    console.error('Food analyze error:', err);
    const message = err instanceof Error ? err.message : 'Analysis failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
