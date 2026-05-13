# GutTrack Project Instructions

## Project Context
GutTrack is a personal health AI for post-giardia recovery and IgA nephropathy tracking. It uses Next.js, Supabase, and Gemini AI.

## Architectural Standards
- **Strict TypeScript**: Avoid `any` or `Record<string, unknown>` when domain types are available in `lib/supabase.ts`.
- **Timezone Management**: All daily logic targets **Mountain Time** (`America/Denver`). Use robust date handling to avoid DST issues.
- **Service Pattern**: Logic for data processing and AI interaction should live in `lib/` services, not directly in API route handlers.
- **Security**:
  - No passwords; Magic Link only.
  - Client-side encryption with 4-digit PIN (AES-256-GCM).
  - RLS enabled on all tables.

## Database
- Migrations are stored in `supabase/migrations/`.
- Critical tables: `meal_logs`, `oura_metrics`, `workout_logs`, `daily_insights`, `daily_feedback`.

## AI Implementation
- Model: Prefer `gemini-2.0-flash`.
- Prompts: Use structured JSON responses. Validate AI output with schema-like checks.
