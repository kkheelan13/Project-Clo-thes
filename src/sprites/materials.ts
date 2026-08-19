import type { Material } from '../lib/types';

/**
 * Pattern id per material, matching the definitions in `textures.tsx`.
 *
 * Cotton is deliberately absent: a plain solid fill reads as cotton, and it is
 * the commonest material, so the commonest garment stays the cleanest sprite.
 */
export const TEXTURE_ID: Partial<Record<Material, string>> = {
  linen: 'tex-linen',
  denim: 'tex-denim',
  wool: 'tex-wool',
  polyester: 'tex-polyester',
  viscose: 'tex-viscose',
  silk: 'tex-silk',
  nylon: 'tex-nylon',
  elastane: 'tex-elastane',
};
