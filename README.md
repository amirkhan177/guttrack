# GutTrack

Personal gut health AI. Post-giardia recovery + IgA nephropathy tracking. iPhone PWA.

## Stack

- Next.js 14 App Router + TypeScript (strict)
- Supabase (auth + database + RLS)
- Vercel (deployment + cron)
- Oura Ring API (biometric data)
- Gemini AI (insights + predictions)
- Web Push (notifications)

---

## Setup

### 1. Supabase Project

1. Create project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → run `supabase/migrations/001_initial_schema.sql`
3. Verify RLS is enabled on all tables (Table Editor → check shield icons)
4. Go to **Authentication → Email** → enable "Magic Links", disable "Confirm email" if testing

### 2. VAPID Keys

Generate Web Push key pair:
```bash
npx web-push generate-vapid-keys
```
Copy both keys to `.env.local`.

### 3. Environment Variables

Create `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

GEMINI_API_KEY=AIzaSy...

CRON_SECRET=generate-a-random-string-here
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
```

Generate `CRON_SECRET`: `openssl rand -hex 32`

### 4. Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Vercel Deployment

```bash
npm install -g vercel
vercel
```

Add all environment variables in Vercel project settings.
Cron jobs in `vercel.json` activate automatically on deploy (Pro plan required for cron).

### 6. Oura Ring Setup

1. Go to [cloud.ouraring.com/personal-access-tokens](https://cloud.ouraring.com/personal-access-tokens)
2. Create a personal access token
3. In GutTrack → Settings → Oura Ring → paste token → Save
4. Tap "Test Connection" to verify sync works

---

## First Login Walkthrough

1. Open app → enter email → tap **Send Magic Link**
2. Check email → click link → redirected to PIN setup
3. Create 4-digit PIN (this encrypts all your data)
4. Confirm PIN → dashboard loads
5. Allow notifications when prompted
6. Go to Settings → add Oura token → sync data
7. Log your first meal in the Log tab
8. Tomorrow morning: insights generate automatically at 8am MT
9. Each night at 10pm: feedback reminder notification fires

---

## Architecture Notes

### Security
- No passwords stored — magic link email auth only
- PIN stored as SHA-256 hash in Supabase user metadata
- AES-256-GCM encryption on sensitive data client-side using PIN as key material
- Auto-lock after 5 minutes of inactivity
- 10 failed PIN attempts → full session wipe

### Insights Pipeline
- 8am MT cron: syncs Oura data, generates yesterday's analysis (complete data), generates today's prediction
- Analysis targets **yesterday** because Oura Ring data for a day is fully available only after the night completes
- Prediction calibrates against historical feedback accuracy

### Data Flow
```
Oura Ring API → oura_metrics table
Meal logs → meal_logs table
Both → Gemini API → daily_insights table
Nightly feedback → daily_feedback table → improves future predictions
```

### PWA (iPhone)
- Safari: tap Share → Add to Home Screen
- Service worker handles offline caching
- Push notifications work after user grants permission
- Status bar black-translucent for edge-to-edge feel
- No user scaling (medical app precision UI)

---

## Cron Schedule (Mountain Time)

| Route | Schedule | Purpose |
|-------|----------|---------|
| `/api/cron/daily-insights` | 8:00 AM | Sync Oura + generate insights |
| `/api/notifications/meal-reminders` | 8:00 AM | Breakfast reminder |
| `/api/notifications/feedback-reminder` | 10:00 PM | Nightly feedback prompt |

---

## Adding Icons

The manifest references `/icon-192.png` and `/icon-512.png`. Add these to `/public/`:
- Create a 512×512 PNG with ⚕ symbol on `#0A0A0F` background
- Resize to 192×192 for the smaller version
- Use [maskable.app](https://maskable.app) to test safe zone

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `meal_logs` | All meal entries with protein/carbs/spice/feeling |
| `weight_entries` | Daily weights (Oura also syncs here) |
| `oura_metrics` | Full Oura biometric data per day |
| `lab_results` | Manual lab test entries |
| `supplements` | Supplement registry |
| `supplement_logs` | Daily supplement taken records |
| `daily_insights` | Gemini-generated analysis + predictions |
| `daily_feedback` | Nightly feedback + accuracy scores |
