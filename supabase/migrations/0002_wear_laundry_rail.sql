-- Wear logging, laundry, and the hanging rail.
--
-- Additive only: 0001 has already been applied, so nothing here alters an
-- existing column. Run this in the Supabase SQL editor after 0001.

-- One row per garment per day it was worn. The unique constraint makes logging
-- the same garment twice in a day a no-op rather than a double count.
create table if not exists public.wears (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  garment_id uuid not null references public.garments (id) on delete cascade,
  worn_on    date not null,
  -- Assigned by the client, not defaulted to now(): this is compared against
  -- garments.last_washed_at to decide cleanliness, and the two must come from
  -- the same clock or skew between browser and database decides the answer.
  recorded_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (garment_id, worn_on)
);

create index if not exists wears_user_garment_idx
  on public.wears (user_id, garment_id, worn_on desc);

-- Laundry and ironing state live on the garment.
--
-- Cleanliness is derived rather than stored: a garment is dirty when it has been
-- worn since its last wash. Storing a boolean too would let the two drift apart,
-- and the wear log is the thing that actually happened.
--
-- A timestamp rather than a date, deliberately. Washing a shirt in the morning
-- and wearing it that evening are both "today", and a date cannot say which came
-- first -- so a date would report that shirt clean.
alter table public.garments
  add column if not exists last_washed_at timestamptz;

alter table public.garments
  add column if not exists is_ironed boolean not null default false;

-- An ironed top paired with an ironed bottom, hung together.
create table if not exists public.outfits (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  top_id     uuid not null references public.garments (id) on delete cascade,
  bottom_id  uuid not null references public.garments (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- A garment can only hang on one hanger at a time.
  unique (top_id),
  unique (bottom_id)
);

create index if not exists outfits_user_idx on public.outfits (user_id, created_at desc);

alter table public.wears enable row level security;
alter table public.outfits enable row level security;

drop policy if exists "wears are private to their owner" on public.wears;
create policy "wears are private to their owner"
  on public.wears for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "outfits are private to their owner" on public.outfits;
create policy "outfits are private to their owner"
  on public.outfits for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
