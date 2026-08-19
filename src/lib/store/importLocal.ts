import type { LocalStore } from './local';
import type { WardrobeStore } from '../types';

export interface ImportResult {
  moved: number;
  total: number;
}

/**
 * Moves garments logged before sign-in into the cloud account.
 *
 * Local data is cleared only once every garment has landed. A partial failure
 * therefore leaves everything on the device, so a dropped connection halfway
 * through can't strand a wardrobe in a browser nobody looks at again.
 */
export async function importInto(
  cloud: WardrobeStore,
  local: LocalStore,
): Promise<ImportResult> {
  const garments = await local.list();
  let moved = 0;

  for (const garment of garments) {
    const { id: _id, createdAt: _createdAt, ...input } = garment;
    await cloud.add(input);
    moved += 1;
  }

  if (moved === garments.length) await local.clear();
  return { moved, total: garments.length };
}
