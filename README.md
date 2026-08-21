# Wardrobe

A miniature of everything you own. Every garment is drawn as a pixel sprite from
its own attributes — type, colour, material blend, sleeve length — so you can see
your whole wardrobe at a glance, on a phone or a laptop.

**No photo is ever stored.** The camera exists only to sample the real colour off
a garment; the image is read in memory, the colour is extracted, and the file is
discarded. Nothing is uploaded, and there is no image storage anywhere in the
design. A garment is roughly 240 bytes of JSON.

## Running it

```bash
npm install && npm run dev
```

With no Supabase credentials configured, the wardrobe is stored in your browser
via IndexedDB. That is a fully working app — set up the cloud when you want the
same wardrobe on your phone and your laptop.

## Connecting Supabase

1. Create a project at [supabase.com](https://supabase.com) (the free tier is
   plenty — this app stores kilobytes).
2. In **SQL Editor → New query**, run the migrations **in order**:
   [`0001_init.sql`](supabase/migrations/0001_init.sql) creates the `garments`
   table, row-level security, and a constraint keeping every material blend at
   100%; [`0002_wear_laundry_rail.sql`](supabase/migrations/0002_wear_laundry_rail.sql)
   adds wear logging, laundry, and the hanging rail.

   ⚠️ Run `0002` **before** deploying v0.2. The app reads columns it creates, so
   a deploy that lands first will error on load.
3. In **Authentication → Sign In / Providers**, make sure **Email** is enabled.
   No password is used — sign-in is a magic link.
4. In **Project Settings → Data API** copy the project URL, and from **API Keys**
   copy the `anon` key.
5. `cp .env.example .env` and paste both values in. Restart `npm run dev`.

Both values are safe to ship in a browser bundle — the anon key is designed to be
public, and the row-level security from step 2 is what actually protects your
data.

Anything you added before connecting Supabase is offered for a one-time move
into your account the first time you sign in.

## Deploying

```bash
npx vercel
```

Then, so magic links work away from your own machine:

- Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in **Vercel → Project →
  Settings → Environment Variables**, and redeploy so they're baked in.
- In **Supabase → Authentication → URL Configuration**, set **Site URL** to your
  deployed origin and add it to **Redirect URLs**. Skipping this is the usual
  reason a magic link opens to a blank page.

On your phone, open the deployed URL and use **Add to Home Screen**.

## How a garment moves through the week

Wear it, and it fades on the shelf and joins the laundry count — one wear is
enough. Wearing also creases it, so it stops being ironed and comes off the
rail if it was hanging. Wash it and it is clean again but still creased. Iron
it, and it can be paired with an ironed top or bottom and hung together.

Cleanliness is derived from the wear log rather than stored as a flag, so the
two can never disagree. Wears and washes are ordered by a single monotonic
client clock: comparing calendar dates alone would call a shirt clean if you
washed it in the morning and wore it that evening.

## How the sprites work

- `src/sprites/shapes.ts` — each garment type as rectangles on a 16×16 grid.
  Sleeve length is a parameter, so a half- and full-sleeve shirt are one shape.
  Adding a garment type is a handful of rectangles.
- `src/sprites/textures.tsx` — an SVG pattern per material, tiled in the sprite's
  own coordinate space so the weave scales with the garment. Cotton is a plain
  fill by design.
- `src/sprites/Garment.tsx` — draws one garment. The fill is its colour; the
  texture is its blend's **dominant** component, so a 60/40 cotton-polyester
  shirt reads as cotton while still recording the full breakdown.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Typecheck and build to `dist/` |
| `npm run lint` | Lint |
| `npm run icons` | Regenerate the app icons from the sprite grid |

## Where this is going

v0.1 built the wardrobe; v0.2 added wear logging, laundry, and the rail. Ideas
from here: a least-worn view to surface what you never reach for, retiring
garments without losing their history, and packing lists built from outfits.
