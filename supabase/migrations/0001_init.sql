-- Wardrobe schema. One row per garment -- there are no images anywhere in this
-- design, because the wardrobe is drawn from attributes rather than photographs.
-- Run this in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).

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
  created_at   timestamptz not null default now(),

  -- A blend must be a non-empty array of {material, percent} totalling 100.
  -- Enforced here so a malformed blend can never reach the sprite renderer and
  -- leave a garment with no dominant material to take its texture from.
  constraint materials_is_valid_blend check (
    jsonb_typeof(materials) = 'array'
    and jsonb_array_length(materials) between 1 and 5
    and not exists (
      select 1
      from jsonb_array_elements(materials) as part
      where part->>'material' is null
         or part->>'material' not in (
              'cotton', 'linen', 'denim', 'wool', 'polyester',
              'viscose', 'silk', 'nylon', 'elastane'
            )
         or jsonb_typeof(part->'percent') <> 'number'
         or (part->>'percent')::numeric <= 0
    )
    and (
      select sum((part->>'percent')::numeric)
      from jsonb_array_elements(materials) as part
    ) = 100
  )
);

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
