import type { SupabaseClient } from '@supabase/supabase-js';
import {
  byPurchasedOnDesc,
  type Garment,
  type GarmentType,
  type MaterialPart,
  type NewGarment,
  type Sleeve,
  type WardrobeStore,
} from '../types';

const COLUMNS =
  'id, type, colour, materials, sleeve, purchased_on, created_at';

interface GarmentRow {
  id: string;
  type: GarmentType;
  colour: string;
  materials: MaterialPart[];
  sleeve: Sleeve;
  purchased_on: string;
  created_at: string;
}

function toGarment(row: GarmentRow): Garment {
  return {
    id: row.id,
    type: row.type,
    colour: row.colour,
    materials: row.materials,
    sleeve: row.sleeve,
    purchasedOn: row.purchased_on,
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

  async list(): Promise<Garment[]> {
    const { data, error } = await this.client
      .from('garments')
      .select(COLUMNS)
      .order('purchased_on', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data as GarmentRow[]).map(toGarment).sort(byPurchasedOnDesc);
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
      .select(COLUMNS)
      .single();

    if (error) throw new Error(error.message);
    return toGarment(data as GarmentRow);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.client.from('garments').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }
}
