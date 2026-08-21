import type { SupabaseClient } from '@supabase/supabase-js';
import { stamp } from '../clock';
import {
  byPurchasedOnDesc,
  type Garment,
  type GarmentType,
  type MaterialPart,
  type NewGarment,
  type Sleeve,
  type WardrobeSnapshot,
  type WardrobeStore,
} from '../types';

const GARMENT_COLUMNS =
  'id, type, colour, materials, sleeve, purchased_on, last_washed_at, is_ironed, created_at';

interface GarmentRow {
  id: string;
  type: GarmentType;
  colour: string;
  materials: MaterialPart[];
  sleeve: Sleeve;
  purchased_on: string;
  last_washed_at: string | null;
  is_ironed: boolean;
  created_at: string;
}

interface WearRow {
  id: string;
  garment_id: string;
  worn_on: string;
  recorded_at: string;
}

interface OutfitRow {
  id: string;
  top_id: string;
  bottom_id: string;
}

function toGarment(row: GarmentRow): Garment {
  return {
    id: row.id,
    type: row.type,
    colour: row.colour,
    materials: row.materials,
    sleeve: row.sleeve,
    purchasedOn: row.purchased_on,
    lastWashedAt: row.last_washed_at ?? undefined,
    isIroned: row.is_ironed,
    createdAt: row.created_at,
  };
}

/**
 * Supabase-backed store. Garments are pure attribute rows -- there is no object
 * storage here because no image is ever kept. Row-level security scopes every
 * read and write to the signed-in user, so filtering happens server-side.
 */
export class CloudStore implements WardrobeStore {
  readonly mode = 'cloud' as const;
  private client: SupabaseClient;
  private userId: string;

  constructor(client: SupabaseClient, userId: string) {
    this.client = client;
    this.userId = userId;
  }

  async read(): Promise<WardrobeSnapshot> {
    const [garments, wears, outfits] = await Promise.all([
      this.client.from('garments').select(GARMENT_COLUMNS),
      this.client.from('wears').select('id, garment_id, worn_on, recorded_at'),
      this.client.from('outfits').select('id, top_id, bottom_id'),
    ]);

    for (const result of [garments, wears, outfits]) {
      if (result.error) throw new Error(result.error.message);
    }

    return {
      garments: (garments.data as GarmentRow[]).map(toGarment).sort(byPurchasedOnDesc),
      wears: (wears.data as WearRow[]).map((row) => ({
        id: row.id,
        garmentId: row.garment_id,
        wornOn: row.worn_on,
        recordedAt: row.recorded_at,
      })),
      outfits: (outfits.data as OutfitRow[]).map((row) => ({
        id: row.id,
        topId: row.top_id,
        bottomId: row.bottom_id,
      })),
    };
  }

  async add(input: NewGarment): Promise<Garment> {
    const { data, error } = await this.client
      .from('garments')
      .insert({
        user_id: this.userId,
        type: input.type,
        colour: input.colour,
        materials: input.materials,
        sleeve: input.sleeve,
        purchased_on: input.purchasedOn,
      })
      .select(GARMENT_COLUMNS)
      .single();

    if (error) throw new Error(error.message);
    return toGarment(data as GarmentRow);
  }

  async remove(id: string): Promise<void> {
    // Wears and outfits cascade on the foreign key, so one delete is enough.
    const { error } = await this.client.from('garments').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  async logWear(garmentIds: string[], wornOn: string): Promise<void> {
    if (garmentIds.length === 0) return;

    // The unique (garment_id, worn_on) constraint keeps one row per day, so a
    // repeat log is not a double count. It updates rather than ignoring the
    // conflict so recorded_at moves forward: wearing something, washing it, and
    // wearing it again the same day has to leave it dirty.
    const { error } = await this.client
      .from('wears')
      .upsert(
        garmentIds.map((garment_id) => ({
          user_id: this.userId,
          garment_id,
          worn_on: wornOn,
          recorded_at: stamp(),
        })),
        { onConflict: 'garment_id,worn_on' },
      );
    if (error) throw new Error(error.message);

    // Wearing it creases it and takes it off the rail.
    await this.unironAll(garmentIds);
  }

  async removeWear(garmentId: string, wornOn: string): Promise<void> {
    const { error } = await this.client
      .from('wears')
      .delete()
      .eq('garment_id', garmentId)
      .eq('worn_on', wornOn);
    if (error) throw new Error(error.message);
  }

  async wash(garmentIds: string[]): Promise<void> {
    if (garmentIds.length === 0) return;
    // Out of the wash it is clean but creased.
    const { error } = await this.client
      .from('garments')
      .update({ last_washed_at: stamp(), is_ironed: false })
      .in('id', garmentIds);
    if (error) throw new Error(error.message);
    await this.dissolveOutfitsOf(garmentIds);
  }

  async setIroned(garmentId: string, ironed: boolean): Promise<void> {
    const { error } = await this.client
      .from('garments')
      .update({ is_ironed: ironed })
      .eq('id', garmentId);
    if (error) throw new Error(error.message);
    if (!ironed) await this.dissolveOutfitsOf([garmentId]);
  }

  private async unironAll(garmentIds: string[]): Promise<void> {
    const { error } = await this.client
      .from('garments')
      .update({ is_ironed: false })
      .in('id', garmentIds);
    if (error) throw new Error(error.message);
    await this.dissolveOutfitsOf(garmentIds);
  }

  /** Taking a garment off the hanger takes its partner off too. */
  private async dissolveOutfitsOf(garmentIds: string[]): Promise<void> {
    const list = garmentIds.map((id) => `"${id}"`).join(',');
    const { error } = await this.client
      .from('outfits')
      .delete()
      .or(`top_id.in.(${list}),bottom_id.in.(${list})`);
    if (error) throw new Error(error.message);
  }

  async pair(topId: string, bottomId: string): Promise<void> {
    // A garment hangs on at most one hanger; clear both sides before hanging.
    await this.dissolveOutfitsOf([topId, bottomId]);
    const { error } = await this.client
      .from('outfits')
      .insert({ user_id: this.userId, top_id: topId, bottom_id: bottomId });
    if (error) throw new Error(error.message);
  }

  async unpair(outfitId: string): Promise<void> {
    const { error } = await this.client.from('outfits').delete().eq('id', outfitId);
    if (error) throw new Error(error.message);
  }
}
