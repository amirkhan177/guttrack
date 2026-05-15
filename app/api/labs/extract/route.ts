export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { ExtractLabResultsUseCase } from '@/src/features/labs/use-cases/ExtractLabResultsUseCase';

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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const mimeType = file.type || 'application/octet-stream';

    const apiKey = user.user_metadata?.ai_api_key || user.user_metadata?.gemini_api_key || process.env.AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('AI API key not found in metadata or environment');
      return NextResponse.json({ error: 'AI API key is not set. Please provide it in Settings.' }, { status: 400 });
    }

    const useCase = new ExtractLabResultsUseCase(apiKey);
    const labs = await useCase.execute(base64, mimeType);

    return NextResponse.json({ labs, count: labs.length });
  } catch (err: unknown) {
    console.error('Lab extract error:', err);
    const message = err instanceof Error ? err.message : 'Extraction failed. Check file and try again.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
