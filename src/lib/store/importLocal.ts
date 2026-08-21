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
  const { garments, wears } = await local.read();
  let moved = 0;

  for (const garment of garments) {
    const {
      id: _id,
      createdAt: _createdAt,
      lastWashedAt,
      isIroned,
      ...input
    } = garment;

    const saved = await cloud.add(input);

    // Carry the history across too, not just the garment: wear dates are what
    // the age and frequency figures are built from, and re-deriving laundry
    // state from them keeps a dirty garment dirty through the move.
    const worn = wears
      .filter((wear) => wear.garmentId === garment.id)
      .map((wear) => wear.wornOn);
    for (const wornOn of worn) {
      await cloud.logWear([saved.id], wornOn);
    }
    if (lastWashedAt) await cloud.wash([saved.id]);
    if (isIroned) await cloud.setIroned(saved.id, true);

    moved += 1;
  }

  if (moved === garments.length) await local.clear();
  return { moved, total: garments.length };
}
