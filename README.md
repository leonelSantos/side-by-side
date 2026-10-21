# Side by Side

A shared weekly planner for two people. Each person enters their own busy and free time; the week view shows both schedules next to each other, highlights when you're **both free**, and lets you plan time together — picking a workout from a pre-written library or a dinner from a list of food options.

**Stack:** React 18 + Vite on the frontend, Supabase (Postgres, Auth, Realtime, row-level security) on the backend.

## Features

- **Accounts & pairing** — email/password sign-up. One person starts a pair and gets a 6-character invite code; the other joins with it. A pair is capped at two people.
- **Side-by-side week** — Monday–Sunday grid, 6am–midnight. Each day has two lanes (you | partner). Solid blocks are busy, dashed blocks are free.
- **Both-free bands** — green bands appear wherever both people marked themselves free. Click one to plan something for that exact window.
- **Time together** — purple events span both lanes. Types: 🏋️ workout, 🍽️ dinner, 💛 hang out. Either person can create, edit or cancel them. The form warns you if the plan overlaps someone's busy time.
- **Workout library** — 10 starter workouts (strength, cardio, HIIT, yoga, mobility) with exercises, duration and difficulty. Filter, search, or hit 🎲 *Surprise us*.
- **Dinner ideas** — 12 starter options across cook-at-home, takeout and eat-out.
- **Add your own** — both libraries accept custom entries, visible only to your pair.
- **Live updates** — your partner's changes appear without refreshing (Supabase Realtime).

## Setup

### 1. Create the Supabase project
1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste the contents of `supabase/schema.sql`, and run it.
3. Run `supabase/seed.sql` the same way to load the starter workouts and dinners.
4. *(Optional, for quick testing)* **Authentication → Providers → Email**: turn off "Confirm email" so sign-ups log in immediately.

### 2. Run the app
```bash
cp .env.example .env.local      # then paste your Project URL and anon key (Project Settings → API)
npm install
npm run dev
```
Open http://localhost:5173. Sign up as person A, click **Start a new pair**, and share the code. Sign up as person B (another browser or a private window) and **Join** with the code.

### 3. Deploy
`npm run build` produces a static `dist/` folder — deploy to Vercel, Netlify, Cloudflare Pages, etc. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables there, and add your production URL under **Authentication → URL Configuration** in Supabase.

## Data model

| Table | Purpose |
|---|---|
| `profiles` | Display name for each user (auto-created on sign-up by a trigger) |
| `pairs`, `pair_members` | The two-person group and its invite code |
| `schedule_blocks` | One person's busy/free time (`status`, `label`, `starts_at`, `ends_at`) |
| `shared_events` | Time together (`kind`: workout / dinner / hangout, optional `workout_id` / `food_id`) |
| `workouts` | Workout library; `exercises` is JSON `[{name, detail}]`. `pair_id` null = built-in |
| `foods` | Dinner options. `pair_id` null = built-in |

Row-level security means each user can only read their own pair's data, edit only their own schedule blocks, and both partners can manage shared events. Pairing goes through two `security definer` functions, `create_pair()` and `join_pair(code)`.

## Project layout

```
supabase/
  schema.sql          tables, RLS policies, RPCs, realtime
  seed.sql            starter workouts and dinners
src/
  App.jsx             session handling, pairing gate, tabs
  supabaseClient.js
  lib/time.js         grid math, interval overlap helpers
  lib/useWeekData.js  loads a week + realtime subscription
  components/
    Auth.jsx          sign in / sign up
    PairSetup.jsx     start or join a pair
    WeekView.jsx      side-by-side calendar
    EventModal.jsx    add/edit my time or time together
    Picker.jsx        searchable workout/dinner chooser
    Library.jsx       browse and add workouts / dinner ideas
    catalog.jsx       shared labels and detail renderers
  styles.css
```

## Ideas for next steps
- Recurring blocks (e.g. "work, weekdays 9–5") so you don't re-enter the same week every week.
- Drag to create or resize blocks on the grid.
- Mark a workout as done and keep a simple history / streak.
- Grocery list generated from the dinners planned this week.
