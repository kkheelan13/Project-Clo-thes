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
2. In **SQL Editor → New query**, paste and run
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql). It
   creates the `garments` table, the row-level security policies, and a
   constraint that keeps every material blend totalling 100%.
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

This is phase one. Planned next, in order: logging what you wear each day (which
gives you each garment's age and how often you actually reach for it), then
laundry — worn garments fade and collect in a basket — then a hanging rail where
ironed shirt-and-trouser pairs hang together.
