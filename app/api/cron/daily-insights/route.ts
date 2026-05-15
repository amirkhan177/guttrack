export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { UserRepository } from '@/src/data/repositories/UserRepository';
import { SyncOuraDataUseCase } from '@/src/features/oura/use-cases/SyncOuraDataUseCase';
import { GenerateDailyInsightUseCase } from '@/src/features/insights/use-cases/GenerateDailyInsightUseCase';
import { getMtnDate } from '@/lib/dates';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRepo = new UserRepository();
    const apiKey = process.env.AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('AI API key is not set');
    }

    const insightUseCase = new GenerateDailyInsightUseCase(apiKey);
    const ouraUsers = await userRepo.listOuraUsers();

    const yesterday = getMtnDate(-1);
    const today = getMtnDate(0);

    let processed = 0;
    const errors: string[] = [];

    for (const user of ouraUsers) {
      try {
        // 1. Activity check
        const hasActivity = await userRepo.hasRecentMeals(user.id);
        if (!hasActivity) {
          console.log(`[cron/daily-insights] skipping user ${user.id} — no recent meals`);
          continue;
        }

        // 2. Sync Oura
        const ouraToken = user.user_metadata.oura_token as string;
        if (ouraToken) {
          const syncUseCase = new SyncOuraDataUseCase(ouraToken);
          await Promise.allSettled([
            syncUseCase.execute(user.id, yesterday),
            syncUseCase.execute(user.id, today),
          ]);
        }

        // 3. Generate Insights
        await insightUseCase.execute(user.id, user.user_metadata);

        processed++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[cron/daily-insights] error for user ${user.id}:`, msg);
        errors.push(`user ${user.id}: ${msg}`);
      }
    }

    return NextResponse.json({ processed, errors });
  } catch (err) {
    console.error('[cron/daily-insights] unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
