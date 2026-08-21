/**
 * Turns a cropped region of a photo into a pixel pattern for a sprite.
 *
 * As with colour sampling, the photo is only ever read here. What comes out is
 * a palette of a few colours plus one index per cell -- a few hundred bytes.
 * That is not a photograph and cannot be turned back into one, so the app still
 * stores no images.
 */

/** Cells across the sprite. Matches the sprite grid in `sprites/shapes.ts`. */
export const PATTERN_GRID = 32;

/** Clusters sought before near-identical ones are merged. */
const CLUSTERS = 8;

/** Centres closer than this collapse into one, in RGB distance. */
const MERGE_DISTANCE = 42;

/**
 * The crop is quantised at this multiple of the sprite grid, then reduced by
 * majority vote.
 *
 * Averaging straight down to the grid blends every stripe boundary, so a
 * navy-and-cream shirt came out as a six-step grey ramp instead of two colours.
 * Quantising first and then taking the most common colour in each cell keeps
 * edges crisp -- the way indexed pixel art is downscaled.
 */
const OVERSAMPLE = 6;

/**
 * Cells of the low-frequency luminance estimate used to cancel shading.
 *
 * Deliberately coarse. At 8x8 the field starts modelling the garment's own
 * pattern rather than the room's lighting, and a perfectly flat navy tee came
 * back as two different navies.
 */
const SHADE_GRID = 4;

export class PatternError extends Error {}

/** Where the print sits on the garment. */
export type Placement = 'allover' | 'chest';

export interface Pattern {
  grid: number;
  /** Up to 16 hex colours. */
  palette: string[];
  /** One hex character per cell, row-major: `grid * grid` characters. */
  cells: string;
  placement: Placement;
}

/** A crop box in normalised (0-1) coordinates of the source image. */
export interface Crop {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

const luminance = (c: Rgb) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

function toHex({ r, g, b }: Rgb): string {
  const part = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`.toUpperCase();
}

function distance(a: Rgb, b: Rgb): number {
  return (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2;
}

function drawCrop(
  bitmap: ImageBitmap,
  crop: Crop,
  size: number,
): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new PatternError('Canvas is unavailable in this browser.');

  // Letting the browser downscale averages each cell over its whole source
  // region, so a fine stripe becomes a blended cell rather than a coin flip on
  // one pixel.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    bitmap,
    crop.x * bitmap.width,
    crop.y * bitmap.height,
    crop.w * bitmap.width,
    crop.h * bitmap.height,
    0,
    0,
    size,
    size,
  );
  return ctx.getImageData(0, 0, size, size);
}

/**
 * Cancels the photo's lighting gradient.
 *
 * A garment photographed on a bed is brighter near the window and shadowed in
 * the folds. Left alone that gradient becomes palette entries of its own, and
 * the sprite ends up wearing the room's lighting -- a plain navy tee comes out
 * as four different navies. Dividing out a very low-resolution luminance field
 * keeps the print's own contrast while flattening the slow shading across it.
 */
function flatten(cells: Rgb[], shade: Rgb[], grid: number): Rgb[] {
  const shadeLum = shade.map(luminance);
  const mean = shadeLum.reduce((a, b) => a + b, 0) / shadeLum.length;
  if (mean <= 1) return cells;

  return cells.map((cell, index) => {
    const x = index % grid;
    const y = Math.floor(index / grid);
    const sx = Math.min(SHADE_GRID - 1, Math.floor((x / grid) * SHADE_GRID));
    const sy = Math.min(SHADE_GRID - 1, Math.floor((y / grid) * SHADE_GRID));
    const local = shadeLum[sy * SHADE_GRID + sx];
    if (local <= 1) return cell;

    // Clamped so a genuinely dark motif is not blown out into the background.
    const gain = Math.max(0.6, Math.min(1.6, mean / local));
    return { r: cell.r * gain, g: cell.g * gain, b: cell.b * gain };
  });
}

function quantise(cells: Rgb[], k: number) {
  let centres: Rgb[] = [];
  const sorted = [...cells].sort((a, b) => luminance(a) - luminance(b));
  for (let i = 0; i < k; i += 1) {
    centres.push(sorted[Math.floor((i + 0.5) * (sorted.length / k))]);
  }

  for (let pass = 0; pass < 12; pass += 1) {
    const sums = centres.map(() => ({ r: 0, g: 0, b: 0, n: 0 }));
    for (const cell of cells) {
      let best = 0;
      let bestDistance = Infinity;
      centres.forEach((centre, index) => {
        const d = distance(cell, centre);
        if (d < bestDistance) {
          bestDistance = d;
          best = index;
        }
      });
      sums[best].r += cell.r;
      sums[best].g += cell.g;
      sums[best].b += cell.b;
      sums[best].n += 1;
    }
    centres = centres.map((centre, index) =>
      sums[index].n === 0
        ? centre
        : {
            r: sums[index].r / sums[index].n,
            g: sums[index].g / sums[index].n,
            b: sums[index].b / sums[index].n,
          },
    );
  }

  const indices = cells.map((cell) => {
    let best = 0;
    let bestDistance = Infinity;
    centres.forEach((centre, index) => {
      const d = distance(cell, centre);
      if (d < bestDistance) {
        bestDistance = d;
        best = index;
      }
    });
    return best;
  });

  return { centres, indices };
}

/**
 * Collapses near-identical centres.
 *
 * k-means always returns exactly k clusters, so a plain navy tee came back as
 * six slightly different navies and a two-colour stripe as a gradient. Merging
 * neighbours leaves a palette that matches what the garment actually is.
 */
function merge(centres: Rgb[], indices: number[]) {
  const mapping = new Map<number, number>();
  const kept: Rgb[] = [];

  centres.forEach((centre, index) => {
    const existing = kept.findIndex(
      (other) => Math.sqrt(distance(centre, other)) < MERGE_DISTANCE,
    );
    if (existing >= 0) {
      mapping.set(index, existing);
    } else {
      mapping.set(index, kept.length);
      kept.push(centre);
    }
  });

  return {
    centres: kept,
    indices: indices.map((index) => mapping.get(index) ?? 0),
  };
}

/** Reduces a fine index grid to the sprite grid by most-common-wins. */
function vote(indices: number[], from: number, to: number): number[] {
  const factor = from / to;
  const out: number[] = [];

  for (let y = 0; y < to; y += 1) {
    for (let x = 0; x < to; x += 1) {
      const tally = new Map<number, number>();
      for (let dy = 0; dy < factor; dy += 1) {
        for (let dx = 0; dx < factor; dx += 1) {
          const index =
            indices[(y * factor + dy) * from + (x * factor + dx)] ?? 0;
          tally.set(index, (tally.get(index) ?? 0) + 1);
        }
      }
      let best = 0;
      let bestCount = -1;
      for (const [index, count] of tally) {
        if (count > bestCount) {
          bestCount = count;
          best = index;
        }
      }
      out.push(best);
    }
  }
  return out;
}

/** Reads the pixels of a decoded image region as cells. */
function cellsOf(image: ImageData): Rgb[] {
  const out: Rgb[] = [];
  for (let i = 0; i < image.data.length; i += 4) {
    out.push({ r: image.data[i], g: image.data[i + 1], b: image.data[i + 2] });
  }
  return out;
}

export async function extractPattern(
  file: File,
  crop: Crop,
  placement: Placement,
): Promise<Pattern> {
  if (!file.type.startsWith('image/')) {
    throw new PatternError('Pick an image file.');
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new PatternError("That file couldn't be read as an image.");
  }

  try {
    const fine = PATTERN_GRID * OVERSAMPLE;
    const sampled = cellsOf(drawCrop(bitmap, crop, fine));
    const shade = cellsOf(drawCrop(bitmap, crop, SHADE_GRID));

    const { centres, indices } = quantise(
      flatten(sampled, shade, fine),
      CLUSTERS,
    );
    const merged = merge(centres, indices);
    const cells = vote(merged.indices, fine, PATTERN_GRID);

    return {
      grid: PATTERN_GRID,
      palette: merged.centres.map(toHex),
      // One hex character per cell keeps the row compact without a binary blob.
      cells: cells.map((index) => index.toString(16)).join(''),
      placement,
    };
  } finally {
    bitmap.close();
  }
}

/** The colour of a single cell, for rendering. */
export function cellColour(pattern: Pattern, x: number, y: number): string {
  const index = parseInt(pattern.cells[y * pattern.grid + x] ?? '0', 16);
  return pattern.palette[index] ?? pattern.palette[0];
}

/** The most common colour -- used for sleeves under a chest print. */
export function baseColourOf(pattern: Pattern): string {
  const counts = new Array(pattern.palette.length).fill(0);
  for (const character of pattern.cells) {
    const index = parseInt(character, 16);
    if (index < counts.length) counts[index] += 1;
  }
  let best = 0;
  counts.forEach((count, index) => {
    if (count > counts[best]) best = index;
  });
  return pattern.palette[best];
}
