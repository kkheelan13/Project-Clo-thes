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
  /** Full fabric breakdown. Percentages total 100. */
  materials: MaterialPart[];
  sleeve: Sleeve;
  /** ISO date (YYYY-MM-DD) the garment was bought. */
  purchasedOn: string;
  createdAt: string;
}

export type NewGarment = Omit<Garment, 'id' | 'createdAt'>;

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

export interface WardrobeStore {
  mode: StoreMode;
  list(): Promise<Garment[]>;
  add(input: NewGarment): Promise<Garment>;
  remove(id: string): Promise<void>;
}

/** Newest purchase first, then newest entry. */
export function byPurchasedOnDesc(a: Garment, b: Garment): number {
  return (
    b.purchasedOn.localeCompare(a.purchasedOn) ||
    b.createdAt.localeCompare(a.createdAt)
  );
}
