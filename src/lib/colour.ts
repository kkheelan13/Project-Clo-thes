/**
 * Samples a garment's colour from a photo.
 *
 * The photo is only ever read here, in memory. It is never written to disk,
 * never uploaded, and no reference to it escapes this module -- callers get a
 * few hex strings and nothing else.
 */

/** The photo is shrunk to this before sampling; more pixels buy no accuracy. */
const SAMPLE_EDGE = 64;

/** Channel bucket width. 16 levels per channel groups shades of one colour. */
const BUCKET = 16;

/** Pixels this close to the estimated background are ignored. */
const BACKGROUND_TOLERANCE = 44;

/** Candidates must differ by at least this much to both be offered. */
const CANDIDATE_SPREAD = 52;

export class ColourError extends Error {}

interface Bucket {
  count: number;
  r: number;
  g: number;
  b: number;
}

function toHex(r: number, g: number, b: number): string {
  const part = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value)))
      .toString(16)
      .padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`.toUpperCase();
}

function distance(
  ar: number, ag: number, ab: number,
  br: number, bg: number, bb: number,
): number {
  return Math.hypot(ar - br, ag - bg, ab - bb);
}

function key(r: number, g: number, b: number): number {
  return (
    Math.floor(r / BUCKET) * 4096 +
    Math.floor(g / BUCKET) * 64 +
    Math.floor(b / BUCKET)
  );
}

function tally(map: Map<number, Bucket>, r: number, g: number, b: number) {
  const id = key(r, g, b);
  const bucket = map.get(id);
  if (bucket) {
    bucket.count += 1;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
  } else {
    map.set(id, { count: 1, r, g, b });
  }
}

function rank(map: Map<number, Bucket>): Bucket[] {
  return [...map.values()].sort((a, b) => b.count - a.count);
}

function average(bucket: Bucket) {
  return {
    r: bucket.r / bucket.count,
    g: bucket.g / bucket.count,
    b: bucket.b / bucket.count,
  };
}

async function decode(file: File): Promise<ImageBitmap> {
  try {
    // `from-image` applies EXIF orientation, so a portrait phone photo isn't
    // sampled sideways -- which matters when we read its border for background.
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ColourError("That file couldn't be read as an image.");
  }
}

function pixelsOf(bitmap: ImageBitmap): ImageData {
  const longest = Math.max(bitmap.width, bitmap.height);
  const scale = Math.min(1, SAMPLE_EDGE / longest);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new ColourError('Canvas is unavailable in this browser.');
  ctx.drawImage(bitmap, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

/**
 * Estimates the background from the outer ring of the photo.
 *
 * Discarding "light" pixels would be simpler but wrong -- a white shirt is a
 * real garment. Reading the border instead means a white shirt on a wooden
 * floor and black trousers on a white bed both survive.
 */
function estimateBackground(image: ImageData) {
  const { width, height, data } = image;
  const ring = Math.max(1, Math.round(Math.min(width, height) * 0.06));
  const border = new Map<number, Bucket>();

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const onBorder =
        x < ring || y < ring || x >= width - ring || y >= height - ring;
      if (!onBorder) continue;
      const i = (y * width + x) * 4;
      if (data[i + 3] < 128) continue;
      tally(border, data[i], data[i + 1], data[i + 2]);
    }
  }

  const top = rank(border)[0];
  return top ? average(top) : undefined;
}

/**
 * Returns up to three candidate colours, most likely first.
 *
 * Three rather than one because extraction on a patterned or badly lit garment
 * will sometimes pick the wrong thing, and a choice turns that into a one-tap
 * correction instead of a wrong colour living in the wardrobe forever.
 */
export async function extractColours(file: File): Promise<string[]> {
  if (!file.type.startsWith('image/')) {
    throw new ColourError('Pick an image file.');
  }

  const bitmap = await decode(file);

  try {
    const image = pixelsOf(bitmap);
    const { data } = image;
    const background = estimateBackground(image);

    const foreground = new Map<number, Bucket>();
    const everything = new Map<number, Bucket>();

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      tally(everything, r, g, b);

      const isBackground =
        background !== undefined &&
        distance(r, g, b, background.r, background.g, background.b) <
          BACKGROUND_TOLERANCE;
      if (!isBackground) tally(foreground, r, g, b);
    }

    const total = data.length / 4;
    const kept = [...foreground.values()].reduce((sum, b) => sum + b.count, 0);

    // If the garment fills the frame, the "background" estimate was really the
    // garment itself -- fall back to sampling everything rather than nothing.
    const source = kept < total * 0.1 ? everything : foreground;
    const ordered = rank(source);
    if (ordered.length === 0) {
      throw new ColourError("That photo didn't have enough colour to read.");
    }

    // Widen the net if the first pass finds too few distinct colours. On a
    // garment photographed against a near-identical background the strict
    // spread can collapse everything into one candidate, which would leave the
    // user with nothing to choose between when the top pick is wrong.
    const picked: { r: number; g: number; b: number }[] = [];
    const used = new Set<Bucket>();

    for (const spread of [CANDIDATE_SPREAD, CANDIDATE_SPREAD / 2, CANDIDATE_SPREAD / 5]) {
      for (const bucket of ordered) {
        if (picked.length === 3) break;
        if (used.has(bucket)) continue;
        const colour = average(bucket);
        const tooSimilar = picked.some(
          (chosen) =>
            distance(colour.r, colour.g, colour.b, chosen.r, chosen.g, chosen.b) <
            spread,
        );
        if (tooSimilar) continue;
        used.add(bucket);
        picked.push(colour);
      }
      if (picked.length === 3) break;
    }

    return picked.map((colour) => toHex(colour.r, colour.g, colour.b));
  } finally {
    // Release the decoded full-resolution pixels immediately.
    bitmap.close();
  }
}
