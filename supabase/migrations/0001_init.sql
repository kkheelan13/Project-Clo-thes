-- Wardrobe schema. One row per garment -- there are no images anywhere in this
-- design, because the wardrobe is drawn from attributes rather than photographs.
-- Run this in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).
--
-- Safe to re-run: every step is idempotent.

create table if not exists public.garments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  type         text not null check (
                 type in ('tshirt', 'shirt', 'jacket', 'trousers',
                          'shorts', 'socks', 'underwear')
               ),
  colour       text not null check (colour ~* '^#[0-9a-f]{6}$'),
  materials    jsonb not null,
  sleeve       text not null check (sleeve in ('none', 'half', 'full')),
  purchased_on date not null,
  created_at   timestamptz not null default now()
);

-- A blend must be a non-empty array of {material, percent} totalling 100.
--
-- This lives in a function rather than inline in the CHECK because Postgres
-- rejects subqueries in a constraint expression, and validating the elements of
-- a JSON array needs one. plpgsql with early returns rather than a chain of
-- ANDs: SQL does not guarantee left-to-right evaluation, so jsonb_array_length
-- could otherwise run against a value that is not an array at all.
create or replace function public.is_valid_blend(blend jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  total numeric;
begin
  if blend is null or jsonb_typeof(blend) <> 'array' then
    return false;
  end if;

  if jsonb_array_length(blend) < 1 or jsonb_array_length(blend) > 5 then
    return false;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(blend) as part
    where part->>'material' is null
       or part->>'material' not in (
            'cotton', 'linen', 'denim', 'wool', 'polyester',
            'viscose', 'silk', 'nylon', 'elastane'
          )
       or jsonb_typeof(part->'percent') <> 'number'
       or (part->>'percent')::numeric <= 0
  ) then
    return false;
  end if;

  select sum((part->>'percent')::numeric)
    into total
    from jsonb_array_elements(blend) as part;

  return total = 100;
end;
$$;

alter table public.garments
  drop constraint if exists materials_is_valid_blend;

alter table public.garments
  add constraint materials_is_valid_blend check (public.is_valid_blend(materials));

create index if not exists garments_user_purchased_idx
  on public.garments (user_id, purchased_on desc, created_at desc);

alter table public.garments enable row level security;

-- Each user sees and writes only their own wardrobe. Present from the first
-- migration so a second user needs no schema change.
drop policy if exists "garments are private to their owner" on public.garments;
create policy "garments are private to their owner"
  on public.garments
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
