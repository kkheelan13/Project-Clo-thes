import type { GarmentType, Sleeve } from '../lib/types';

/** Sprites are drawn on a 16x16 grid, Minecraft-style. */
export const GRID = 16;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Shape {
  /** Filled with the garment's colour and overlaid with its material texture. */
  base: Rect[];
  /** Darker accents -- collars, waistbands, plackets. */
  detail: Rect[];
}

/** How far down the sleeve rectangles reach for each sleeve length. */
const SLEEVE_HEIGHT: Record<Sleeve, number> = { none: 0, half: 4, full: 9 };

interface SleeveParts {
  base: Rect[];
  /** Armhole seams -- see below. */
  seams: Rect[];
}

/**
 * Sleeve rectangles plus the seam where they meet the body.
 *
 * The seam matters: a full-sleeve shirt is otherwise one solid block of colour
 * from cuff to cuff and stops reading as a shirt at all. A one-unit darker
 * column at each armhole restores the silhouette without changing it.
 */
function sleeves(
  sleeve: Sleeve,
  y: number,
  left: number,
  right: number,
  bodyLeft: number,
  bodyRight: number,
): SleeveParts {
  const h = SLEEVE_HEIGHT[sleeve];

  // Sleeveless still gets a shoulder cap -- without one the sprite is a bare
  // rectangle and stops reading as a garment.
  if (h === 0) {
    return {
      base: [
        { x: left + 2, y, w: 1, h: 2 },
        { x: right, y, w: 1, h: 2 },
      ],
      seams: [],
    };
  }

  return {
    base: [
      { x: left, y, w: 3, h },
      { x: right, y, w: 3, h },
    ],
    seams: [
      { x: bodyLeft, y, w: 1, h },
      { x: bodyRight - 1, y, w: 1, h },
    ],
  };
}

/**
 * Garment silhouettes. Sleeve length is a parameter rather than a separate
 * shape, so a half-sleeve and full-sleeve shirt stay the same garment.
 */
export function shapeFor(type: GarmentType, sleeve: Sleeve): Shape {
  switch (type) {
    case 'tshirt': {
      const arms = sleeves(sleeve, 3, 1, 12, 4, 12);
      return {
        base: [{ x: 4, y: 3, w: 8, h: 11 }, ...arms.base],
        detail: [{ x: 6, y: 3, w: 4, h: 2 }, ...arms.seams],
      };
    }

    case 'shirt': {
      const arms = sleeves(sleeve, 3, 1, 12, 4, 12);
      return {
        base: [{ x: 4, y: 3, w: 8, h: 11 }, ...arms.base],
        detail: [
          { x: 6, y: 2, w: 4, h: 2 },
          { x: 7, y: 4, w: 1, h: 10 },
          ...arms.seams,
        ],
      };
    }

    case 'jacket': {
      const arms = sleeves(sleeve, 3, 0, 13, 3, 13);
      return {
        base: [{ x: 3, y: 3, w: 10, h: 11 }, ...arms.base],
        detail: [
          { x: 5, y: 3, w: 6, h: 2 },
          { x: 7, y: 4, w: 2, h: 10 },
          ...arms.seams,
        ],
      };
    }

    case 'trousers':
      return {
        base: [
          { x: 4, y: 2, w: 8, h: 3 },
          { x: 4, y: 5, w: 3, h: 9 },
          { x: 9, y: 5, w: 3, h: 9 },
        ],
        detail: [{ x: 4, y: 2, w: 8, h: 1 }],
      };

    case 'shorts':
      return {
        base: [
          { x: 4, y: 4, w: 8, h: 3 },
          { x: 4, y: 7, w: 3, h: 5 },
          { x: 9, y: 7, w: 3, h: 5 },
        ],
        detail: [{ x: 4, y: 4, w: 8, h: 1 }],
      };

    case 'socks':
      return {
        base: [
          { x: 5, y: 2, w: 4, h: 8 },
          { x: 5, y: 10, w: 7, h: 3 },
        ],
        detail: [{ x: 5, y: 2, w: 4, h: 1 }],
      };

    case 'underwear':
      return {
        base: [
          { x: 4, y: 4, w: 8, h: 5 },
          { x: 4, y: 9, w: 3, h: 2 },
          { x: 9, y: 9, w: 3, h: 2 },
        ],
        detail: [{ x: 4, y: 4, w: 8, h: 1 }],
      };
  }
}
