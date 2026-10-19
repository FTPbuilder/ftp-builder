# Data Model: FTP Builder

État local unique `S` (localStorage `ftpb_state_v1`), synchronisé tel quel dans Supabase (`user_state.data jsonb`) en V1.5.

```js
S = {
  version: 1,
  profile: {
    name, sex: 'M'|'F', age, weightKg, heightCm,
    ftp, ftpSource: 'questionnaire'|'test'|'fit',
    hrMax, hrRest,
    goalFtp: 300, goalDate: '2027-03-05', endDate: '2027-03-15', minSessions: 35,
    startDate: '2026-10-20',
    days: { 1:{avail:true,max:75}, 2:{...}, ... 0:{avail:true,max:120} }, // 0 = dimanche
    keyPerWeek: 2, optionalPerWeek: 1,
    otherSports: true, testProtocol: '20min'|'ramp',
    blackout: [{from:'2026-12-24', to:'2026-12-27'}]
  },
  plan: [ { id, date:'YYYY-MM-DD', week, block, kind:'key'|'optional'|'test'|'recovery',
            workoutId, status:'planned'|'done'|'skipped', activityId } ],
  activities: [ { id, date, source:'fit'|'manual'|'strava', name,
                  durationS, distanceKm, avgPower, np, maxPower, avgHr, maxHr, avgCad,
                  tss, if, best:{s5,m1,m5,m20}, hasPower,
                  feel:{rpe, legs, breath, motivation, sleep, note},
                  planId, compliance } ],
  ftpHistory: [ { date, ftp, source:'initial'|'test', protocol, raw } ],
  settings: { theme: 'auto' }
}
```

## Supabase (V1.5)

```sql
create table public.user_state (
  user_id uuid primary key references auth.users on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.user_state enable row level security;
create policy "own state" on public.user_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- V2 Strava
create table public.strava_tokens (
  user_id uuid primary key references auth.users on delete cascade,
  athlete_id bigint unique not null,
  access_token text not null, refresh_token text not null, expires_at timestamptz not null
);
alter table public.strava_tokens enable row level security; -- accès service_role uniquement
```

## Modèles de séance (bibliothèque `WORKOUTS`)

`{ id, name, type, goal, steps:[ {d: secondes, lo: %FTP, hi: %FTP, cad?, label, int:'warmup'|'active'|'rest'|'cooldown'} | {repeat:n, steps:[...]} ] }`
