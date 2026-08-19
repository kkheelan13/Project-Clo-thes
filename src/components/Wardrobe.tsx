import {
  GARMENT_TYPES,
  TYPE_LABELS,
  TYPE_LABELS_SINGULAR,
  describeBlend,
  type Garment,
} from '../lib/types';
import { GarmentSprite } from '../sprites/Garment';

interface Props {
  garments: Garment[];
  onSelect(garment: Garment): void;
  onAdd(): void;
}

/**
 * The wardrobe itself: a shelf per garment type, every item visible at once.
 *
 * Items sit in a wrapped row rather than an overlapping pile because the whole
 * point is seeing everything in one go -- a pile hides most of what's in it.
 */
export function Wardrobe({ garments, onSelect, onAdd }: Props) {
  if (garments.length === 0) {
    return (
      <div className="empty">
        <h2>Your wardrobe is empty</h2>
        <p className="muted">
          Add the first thing you own and it will appear here as a miniature.
        </p>
        <button type="button" onClick={onAdd}>
          Add a garment
        </button>
      </div>
    );
  }

  const shelves = GARMENT_TYPES.map((type) => ({
    type,
    items: garments.filter((garment) => garment.type === type),
  })).filter((shelf) => shelf.items.length > 0);

  return (
    <div className="cabinet">
      {shelves.map((shelf) => (
        <section className="shelf" key={shelf.type}>
          <h2 className="shelf-label">
            {TYPE_LABELS[shelf.type]} <span>{shelf.items.length}</span>
          </h2>
          <div className="shelf-items">
            {shelf.items.map((garment) => (
              <button
                type="button"
                className="garment"
                key={garment.id}
                // The label belongs on the button: a name on the inner SVG is
                // not reachable from the control a screen reader lands on.
                aria-label={`${TYPE_LABELS_SINGULAR[garment.type]}, ${describeBlend(
                  garment.materials,
                )}`}
                onClick={() => onSelect(garment)}
              >
                <GarmentSprite garment={garment} />
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
