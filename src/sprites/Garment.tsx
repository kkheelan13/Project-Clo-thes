import { baseColourOf, cellColour, type Pattern } from '../lib/pattern';
import { dominantMaterial, type Garment } from '../lib/types';
import { GRID, shapeFor, type Rect } from './shapes';
import { TEXTURE_ID } from './materials';

interface Props {
  garment: Pick<Garment, 'type' | 'colour' | 'materials' | 'sleeve' | 'pattern'>;
  size?: number;
  /** Worn but unwashed -- desaturated and dimmed. */
  faded?: boolean;
  title?: string;
}

/** The box a pattern is mapped onto. */
function boundsOf(rects: Rect[]): Rect {
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  const right = Math.max(...rects.map((r) => r.x + r.w));
  const bottom = Math.max(...rects.map((r) => r.y + r.h));
  return { x, y, w: right - x, h: bottom - y };
}

/**
 * Paints a pattern as one rect per cell.
 *
 * An all-over print runs across the whole garment, sleeves included, so it maps
 * to the full sprite. A chest print maps to the body panel instead, so the crop
 * you took lands on the chest at the size you framed it rather than being cut
 * off by the silhouette.
 */
function patternCells(pattern: Pattern, box: Rect, silhouette: Rect[]) {
  const cells = [];
  const cellW = box.w / pattern.grid;
  const cellH = box.h / pattern.grid;

  for (let y = 0; y < pattern.grid; y += 1) {
    for (let x = 0; x < pattern.grid; x += 1) {
      const left = box.x + x * cellW;
      const top = box.y + y * cellH;

      // Both the cells and the silhouette are axis-aligned rects on the same
      // grid, so testing the cell centre is enough -- cheaper than a clip path,
      // and it avoids duplicate SVG ids across every sprite on screen.
      const cx = left + cellW / 2;
      const cy = top + cellH / 2;
      const inside = silhouette.some(
        (r) => cx >= r.x && cx < r.x + r.w && cy >= r.y && cy < r.y + r.h,
      );
      if (!inside) continue;

      cells.push(
        <rect
          key={`p${x}-${y}`}
          x={left}
          y={top}
          // Overlapped slightly so no hairline of background shows between
          // cells when the sprite is scaled to an awkward size.
          width={cellW + 0.02}
          height={cellH + 0.02}
          fill={cellColour(pattern, x, y)}
        />,
      );
    }
  }
  return cells;
}

/**
 * Draws one garment as a pixel sprite.
 *
 * A plain garment is its sampled colour plus its material's weave. A printed
 * one is painted cell by cell from the pattern, which already carries its own
 * colours, so the weave is skipped -- overlaying it on a print muddies both.
 */
export function GarmentSprite({ garment, size = 46, faded, title }: Props) {
  const { base, detail } = shapeFor(garment.type, garment.sleeve);
  const pattern = garment.pattern;
  const texture = pattern
    ? undefined
    : TEXTURE_ID[dominantMaterial(garment.materials)];

  const body = base[0];
  const patternBox = pattern
    ? pattern.placement === 'chest'
      ? body
      : boundsOf(base)
    : undefined;

  // Under a chest print the sleeves take the print's own dominant colour, so
  // the garment reads as one thing rather than a panel stuck on a tee.
  const fill = pattern ? baseColourOf(pattern) : garment.colour;

  return (
    <svg
      viewBox={`0 0 ${GRID} ${GRID}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={faded ? 'sprite faded' : 'sprite'}
    >
      {title && <title>{title}</title>}

      {base.map((rect, index) => (
        <rect
          key={`c${index}`}
          x={rect.x}
          y={rect.y}
          width={rect.w}
          height={rect.h}
          fill={fill}
        />
      ))}

      {pattern &&
        patternBox &&
        patternCells(
          pattern,
          patternBox,
          // A chest print is confined to the body panel; an all-over one runs
          // across every panel including the sleeves.
          pattern.placement === 'chest' ? [body] : base,
        )}

      {texture &&
        base.map((rect, index) => (
          <rect
            key={`t${index}`}
            x={rect.x}
            y={rect.y}
            width={rect.w}
            height={rect.h}
            fill={`url(#${texture})`}
          />
        ))}

      {detail.map((rect, index) => (
        <rect
          key={`d${index}`}
          x={rect.x}
          y={rect.y}
          width={rect.w}
          height={rect.h}
          fill="rgba(0,0,0,.28)"
        />
      ))}
    </svg>
  );
}
