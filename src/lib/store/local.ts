import { openDB, type IDBPDatabase } from 'idb';
import {
  byPurchasedOnDesc,
  type Garment,
  type NewGarment,
  type WardrobeStore,
} from '../types';

const DB_NAME = 'wardrobe';
const STORE = 'garments';
const VERSION = 1;

/**
 * On-device store, used when no Supabase credentials are configured so the app
 * works before -- or without -- a cloud project.
 */
export class LocalStore implements WardrobeStore {
  readonly mode = 'local' as const;
  private db?: Promise<IDBPDatabase>;

  private open() {
    this.db ??= openDB(DB_NAME, VERSION, {
      upgrade(db) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      },
    });
    return this.db;
  }

  async list(): Promise<Garment[]> {
    const db = await this.open();
    const rows: Garment[] = await db.getAll(STORE);
    return rows.sort(byPurchasedOnDesc);
  }

  async add(input: NewGarment): Promise<Garment> {
    const db = await this.open();
    const garment: Garment = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    await db.put(STORE, garment);
    return garment;
  }

  async remove(id: string): Promise<void> {
    const db = await this.open();
    await db.delete(STORE, id);
  }

  /** How many garments are waiting to be moved into a cloud account. */
  async count(): Promise<number> {
    const db = await this.open();
    return db.count(STORE);
  }

  async clear(): Promise<void> {
    const db = await this.open();
    await db.clear(STORE);
  }
}
