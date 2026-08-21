import { openDB, type IDBPDatabase } from 'idb';
import { stamp } from '../clock';
import {
  byPurchasedOnDesc,
  type Garment,
  type NewGarment,
  type Outfit,
  type WardrobeSnapshot,
  type WardrobeStore,
  type Wear,
} from '../types';

const DB_NAME = 'wardrobe';
const GARMENTS = 'garments';
const WEARS = 'wears';
const OUTFITS = 'outfits';
const VERSION = 2;

/**
 * On-device store, used when no Supabase credentials are configured so the app
 * works before -- or without -- a cloud project.
 */
export class LocalStore implements WardrobeStore {
  readonly mode = 'local' as const;
  private db?: Promise<IDBPDatabase>;

  private open() {
    this.db ??= openDB(DB_NAME, VERSION, {
      upgrade(db, oldVersion) {
        // v1 held garments alone. Existing wardrobes upgrade in place rather
        // than being rebuilt, so nothing logged before this release is lost.
        if (oldVersion < 1) db.createObjectStore(GARMENTS, { keyPath: 'id' });
        if (oldVersion < 2) {
          const wears = db.createObjectStore(WEARS, { keyPath: 'id' });
          wears.createIndex('garmentId', 'garmentId');
          db.createObjectStore(OUTFITS, { keyPath: 'id' });
        }
      },
    });
    return this.db;
  }

  async read(): Promise<WardrobeSnapshot> {
    const db = await this.open();
    const [garments, wears, outfits] = await Promise.all([
      db.getAll(GARMENTS) as Promise<Garment[]>,
      db.getAll(WEARS) as Promise<Wear[]>,
      db.getAll(OUTFITS) as Promise<Outfit[]>,
    ]);
    return {
      // Older rows predate these fields; default them rather than migrating.
      garments: garments
        .map((g) => ({ ...g, isIroned: g.isIroned ?? false }))
        .sort(byPurchasedOnDesc),
      wears: wears.map((wear) => ({
        ...wear,
        recordedAt: wear.recordedAt ?? `${wear.wornOn}T12:00:00.000Z`,
      })),
      outfits,
    };
  }

  async add(input: NewGarment): Promise<Garment> {
    const db = await this.open();
    const garment: Garment = {
      ...input,
      id: crypto.randomUUID(),
      isIroned: false,
      createdAt: new Date().toISOString(),
    };
    await db.put(GARMENTS, garment);
    return garment;
  }

  async remove(id: string): Promise<void> {
    const db = await this.open();
    await Promise.all([
      db.delete(GARMENTS, id),
      this.clearWearsOf(id),
      this.clearOutfitOf(id),
    ]);
  }

  private async clearWearsOf(garmentId: string) {
    const db = await this.open();
    const wears: Wear[] = await db.getAllFromIndex(WEARS, 'garmentId', garmentId);
    await Promise.all(wears.map((wear) => db.delete(WEARS, wear.id)));
  }

  /** Taking a garment off the hanger takes its partner off too. */
  private async clearOutfitOf(garmentId: string) {
    const db = await this.open();
    const outfits: Outfit[] = await db.getAll(OUTFITS);
    const hanging = outfits.filter(
      (o) => o.topId === garmentId || o.bottomId === garmentId,
    );
    await Promise.all(hanging.map((o) => db.delete(OUTFITS, o.id)));
  }

  async logWear(garmentIds: string[], wornOn: string): Promise<void> {
    const db = await this.open();
    for (const garmentId of garmentIds) {
      const existing: Wear[] = await db.getAllFromIndex(
        WEARS,
        'garmentId',
        garmentId,
      );
      // One row per garment per day, so logging twice is not a double count.
      // The timestamp is refreshed either way: wearing something, washing it,
      // and wearing it again the same day has to leave it dirty, and it cannot
      // do that if the day's entry still predates the wash.
      const already = existing.find((wear) => wear.wornOn === wornOn);
      await db.put(WEARS, {
        id: already?.id ?? crypto.randomUUID(),
        garmentId,
        wornOn,
        recordedAt: stamp(),
      });
      // Wearing it creases it and takes it off the rail.
      await this.setIroned(garmentId, false);
    }
  }

  async removeWear(garmentId: string, wornOn: string): Promise<void> {
    const db = await this.open();
    const wears: Wear[] = await db.getAllFromIndex(WEARS, 'garmentId', garmentId);
    const match = wears.find((wear) => wear.wornOn === wornOn);
    if (match) await db.delete(WEARS, match.id);
  }

  async wash(garmentIds: string[]): Promise<void> {
    const db = await this.open();
    const washedAt = stamp();
    for (const id of garmentIds) {
      const garment: Garment | undefined = await db.get(GARMENTS, id);
      if (!garment) continue;
      // Out of the wash it is clean but creased.
      await db.put(GARMENTS, { ...garment, lastWashedAt: washedAt, isIroned: false });
      await this.clearOutfitOf(id);
    }
  }

  async setIroned(garmentId: string, ironed: boolean): Promise<void> {
    const db = await this.open();
    const garment: Garment | undefined = await db.get(GARMENTS, garmentId);
    if (!garment) return;
    await db.put(GARMENTS, { ...garment, isIroned: ironed });
    if (!ironed) await this.clearOutfitOf(garmentId);
  }

  async pair(topId: string, bottomId: string): Promise<void> {
    const db = await this.open();
    await this.clearOutfitOf(topId);
    await this.clearOutfitOf(bottomId);
    await db.put(OUTFITS, { id: crypto.randomUUID(), topId, bottomId });
  }

  async unpair(outfitId: string): Promise<void> {
    const db = await this.open();
    await db.delete(OUTFITS, outfitId);
  }

  /** How many garments are waiting to be moved into a cloud account. */
  async count(): Promise<number> {
    const db = await this.open();
    return db.count(GARMENTS);
  }

  async clear(): Promise<void> {
    const db = await this.open();
    await Promise.all([
      db.clear(GARMENTS),
      db.clear(WEARS),
      db.clear(OUTFITS),
    ]);
  }
}
