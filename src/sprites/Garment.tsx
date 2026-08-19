import { dominantMaterial, type Garment } from '../lib/types';
import { GRID, shapeFor } from './shapes';
import { TEXTURE_ID } from './materials';

interface Props {
  garment: Pick<Garment, 'type' | 'colour' | 'materials' | 'sleeve'>;
  size?: number;
  /** Worn but unwashed -- desaturated and dimmed. Used from phase 3 onward. */
  faded?: boolean;
  title?: string;
}

/**
 * Draws one garment as a pixel sprite.
 *
 * Colour and material come straight from the record: the fill is the sampled
 * colour, and the texture is the blend's dominant component. Because patterns
 * tile in sprite space, painting each rectangle separately still yields one
 * continuous weave across the whole silhouette -- no clip paths needed.
 */
export function GarmentSprite({ garment, size = 46, faded, title }: Props) {
  const { base, detail } = shapeFor(garment.type, garment.sleeve);
  const texture = TEXTURE_ID[dominantMaterial(garment.materials)];

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
          fill={garment.colour}
        />
      ))}

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
