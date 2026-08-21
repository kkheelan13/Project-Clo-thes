-- Printed and patterned garments.
--
-- Additive only: 0001 and 0002 have already been applied. Run this before
-- deploying v0.3.

-- A pixel pattern sampled from a photo, as
--   { grid, palette: [hex], cells: "<grid*grid hex chars>", placement }
--
-- Deliberately not an image and not a bucket reference. The photo is quantised
-- to a handful of colours at sprite resolution and only the palette indices are
-- kept, so this stays about a kilobyte and no photograph can be reconstructed
-- from it -- the app still stores no pictures.
alter table public.garments
  add column if not exists pattern jsonb;

alter table public.garments
  drop constraint if exists pattern_is_valid;

alter table public.garments
  add constraint pattern_is_valid check (
    pattern is null
    or (
      jsonb_typeof(pattern->'palette') = 'array'
      and jsonb_array_length(pattern->'palette') between 1 and 16
      and jsonb_typeof(pattern->'cells') = 'string'
      and (pattern->>'placement') in ('allover', 'chest')
      and (pattern->>'grid')::int between 8 and 64
      -- One character per cell, so the grid and the payload cannot disagree.
      and length(pattern->>'cells') = ((pattern->>'grid')::int) ^ 2
    )
  );
