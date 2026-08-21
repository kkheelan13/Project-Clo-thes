import { localDateOf } from './dates';
import type { Pattern } from './pattern';

export const GARMENT_TYPES = [
  'tshirt',
  'shirt',
  'jacket',
  'trousers',
  'shorts',
  'socks',
  'underwear',
] as const;

export type GarmentType = (typeof GARMENT_TYPES)[number];

export const TYPE_LABELS: Record<GarmentType, string> = {
  tshirt: 'T-shirts',
  shirt: 'Shirts',
  jacket: 'Jackets',
  trousers: 'Trousers',
  shorts: 'Shorts',
  socks: 'Socks',
  underwear: 'Underwear',
};

export const TYPE_LABELS_SINGULAR: Record<GarmentType, string> = {
  tshirt: 'T-shirt',
  shirt: 'Shirt',
  jacket: 'Jacket',
  trousers: 'Trousers',
  shorts: 'Shorts',
  socks: 'Socks',
  underwear: 'Underwear',
};

export const MATERIALS = [
  'cotton',
  'linen',
  'denim',
  'wool',
  'polyester',
  'viscose',
  'silk',
  'nylon',
  'elastane',
] as const;

export type Material = (typeof MATERIALS)[number];

export const MATERIAL_LABELS: Record<Material, string> = {
  cotton: 'Cotton',
  linen: 'Linen',
  denim: 'Denim',
  wool: 'Wool',
  polyester: 'Polyester',
  viscose: 'Viscose',
  silk: 'Silk',
  nylon: 'Nylon',
  elastane: 'Elastane',
};

export const SLEEVES = ['none', 'half', 'full'] as const;
export type Sleeve = (typeof SLEEVES)[number];

export const SLEEVE_LABELS: Record<Sleeve, string> = {
  none: 'Sleeveless',
  half: 'Half sleeve',
  full: 'Full sleeve',
};

/** Types whose sprite has sleeves; everything else ignores the setting. */
export const SLEEVED_TYPES: ReadonlySet<GarmentType> = new Set<GarmentType>([
  'tshirt',
  'shirt',
  'jacket',
]);

/** One component of a garment's fabric blend, e.g. 60% cotton. */
export interface MaterialPart {
  material: Material;
  percent: number;
}

export interface Garment {
  id: string;
  type: GarmentType;
  /** Hex colour sampled from the garment, e.g. `#378ADD`. */
  colour: string;
  /** A print sampled from the photo. Absent for a plain garment. */
  pattern?: Pattern;
  /** Full fabric breakdown. Percentages total 100. */
  materials: MaterialPart[];
  sleeve: Sleeve;
  /** ISO date (YYYY-MM-DD) the garment was bought. */
  purchasedOn: string;
  /** ISO timestamp of the last wash, or undefined if never washed. */
  lastWashedAt?: string;
  isIroned: boolean;
  createdAt: string;
}

export type NewGarment = Omit<
  Garment,
  'id' | 'createdAt' | 'lastWashedAt' | 'isIroned'
>;

/** One day a garment was worn. */
export interface Wear {
  id: string;
  garmentId: string;
  /** The day it was worn (YYYY-MM-DD), which may be backdated. */
  wornOn: string;
  /** When the entry was actually made -- breaks same-day ties against a wash. */
  recordedAt: string;
}

/** An ironed top and bottom hung together. */
export interface Outfit {
  id: string;
  topId: string;
  bottomId: string;
}

/** Types that can be the top half of an outfit. */
export const TOP_TYPES: ReadonlySet<GarmentType> = new Set<GarmentType>([
  'tshirt',
  'shirt',
  'jacket',
]);

/** Types that can be the bottom half. */
export const BOTTOM_TYPES: ReadonlySet<GarmentType> = new Set<GarmentType>([
  'trousers',
  'shorts',
]);

/** Types nobody irons -- they never appear in the ironing or pairing flows. */
export const UNIRONED_TYPES: ReadonlySet<GarmentType> = new Set<GarmentType>([
  'socks',
  'underwear',
]);

/**
 * The component that decides the sprite's texture. Ties break toward whichever
 * component was listed first, so the blend editor's ordering is meaningful.
 */
export function dominantMaterial(materials: MaterialPart[]): Material {
  let best = materials[0];
  for (const part of materials) {
    if (part.percent > best.percent) best = part;
  }
  return best.material;
}

/** "60% cotton · 40% polyester", ordered as entered. */
export function describeBlend(materials: MaterialPart[]): string {
  return materials
    .map((part) => `${part.percent}% ${MATERIAL_LABELS[part.material].toLowerCase()}`)
    .join(' · ');
}

/** Mirrors the database CHECK constraint, so bad blends fail before a round trip. */
export function blendError(materials: MaterialPart[]): string | undefined {
  if (materials.length === 0) return 'Add at least one material.';
  if (materials.some((part) => part.percent <= 0)) {
    return 'Every material needs a percentage above zero.';
  }
  const seen = new Set<Material>();
  for (const part of materials) {
    if (seen.has(part.material)) {
      return `${MATERIAL_LABELS[part.material]} is listed twice.`;
    }
    seen.add(part.material);
  }
  const total = materials.reduce((sum, part) => sum + part.percent, 0);
  if (total !== 100) return `Percentages add up to ${total}%, not 100%.`;
  return undefined;
}

export type StoreMode = 'cloud' | 'local';

/** Everything the app needs in one shot -- the whole wardrobe is a few kB. */
export interface WardrobeSnapshot {
  garments: Garment[];
  wears: Wear[];
  outfits: Outfit[];
}

export interface WardrobeStore {
  mode: StoreMode;
  /**
   * Reads the whole wardrobe at once.
   *
   * Mutations below return nothing and callers reload. With kilobytes of data
   * that is cheaper than reconciling three interdependent lists by hand --
   * wearing a garment also unirons it and dissolves its outfit, and keeping
   * that consistent in local state is where the bugs would live.
   */
  read(): Promise<WardrobeSnapshot>;
  add(input: NewGarment): Promise<Garment>;
  remove(id: string): Promise<void>;

  /** Logs a day's wear for several garments at once. Same-day repeats no-op. */
  logWear(garmentIds: string[], wornOn: string): Promise<void>;
  /** Removes a logged wear, for fixing a mistake. */
  removeWear(garmentId: string, wornOn: string): Promise<void>;
  /** Marks garments washed today: clean again, but no longer ironed. */
  wash(garmentIds: string[]): Promise<void>;
  setIroned(garmentId: string, ironed: boolean): Promise<void>;
  pair(topId: string, bottomId: string): Promise<void>;
  unpair(outfitId: string): Promise<void>;
}

/** Newest purchase first, then newest entry. */
export function byPurchasedOnDesc(a: Garment, b: Garment): number {
  return (
    b.purchasedOn.localeCompare(a.purchasedOn) ||
    b.createdAt.localeCompare(a.createdAt)
  );
}

/**
 * Wear dates for one garment, newest first.
 *
 * Callers pass the whole wear log rather than querying per garment: the data is
 * a few kilobytes, and one pass beats a round trip for each sprite on screen.
 */
export function wearsOf(garmentId: string, wears: Wear[]): string[] {
  return wears
    .filter((wear) => wear.garmentId === garmentId)
    .map((wear) => wear.wornOn)
    .sort((a, b) => b.localeCompare(a));
}

/**
 * Whether a garment needs washing. One wear is enough.
 *
 * Derived from the wear log rather than stored as a flag, so the two can never
 * disagree. Comparing dates alone is not sufficient: a wash and a wear on the
 * same day are ordered by when each was recorded, otherwise washing a shirt in
 * the morning and wearing it that evening would leave it looking clean. A wear
 * backdated to before the wash stays clean, since the wash came after it.
 */
export function isDirty(garment: Garment, wears: Wear[]): boolean {
  const mine = wears.filter((wear) => wear.garmentId === garment.id);
  if (mine.length === 0) return false;

  const washedAt = garment.lastWashedAt;
  if (!washedAt) return true;
  const washedOn = localDateOf(washedAt);

  return mine.some(
    (wear) =>
      wear.wornOn > washedOn ||
      (wear.wornOn === washedOn && wear.recordedAt > washedAt),
  );
}

/** Whole days since an ISO date, floor 0. */
export function daysSince(iso: string, from = new Date()): number {
  const [y, m, d] = iso.split('-').map(Number);
  const then = new Date(y, m - 1, d);
  const now = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.max(0, Math.round((now.getTime() - then.getTime()) / 86_400_000));
}

/** "3 years old", "8 months old", "new this week". */
export function describeAge(purchasedOn: string, from = new Date()): string {
  const days = daysSince(purchasedOn, from);
  if (days < 7) return 'new this week';
  if (days < 60) return `${Math.floor(days / 7)} weeks old`;
  if (days < 730) return `${Math.floor(days / 30)} months old`;
  return `${Math.floor(days / 365)} years old`;
}

/**
 * Average wears per month since purchase.
 *
 * Reported over the time you have actually owned it, so a jacket bought last
 * week isn't flattered by a short window -- anything owned under a month is
 * measured against a full month rather than its true age.
 */
export function wearsPerMonth(garment: Garment, wears: Wear[]): number {
  const count = wearsOf(garment.id, wears).length;
  if (count === 0) return 0;
  const months = Math.max(1, daysSince(garment.purchasedOn) / 30);
  return Math.round((count / months) * 10) / 10;
}

/** The outfit a garment currently hangs in, if any. */
export function outfitOf(garmentId: string, outfits: Outfit[]) {
  return outfits.find((o) => o.topId === garmentId || o.bottomId === garmentId);
}
