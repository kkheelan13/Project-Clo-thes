import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MATERIAL_LABELS, type MaterialPart } from '../lib/types';

export interface TipAnchor {
  materials: MaterialPart[];
  /** Horizontal centre of the garment. */
  x: number;
  /** Top and bottom of the garment, so the tip can flip when space is tight. */
  top: number;
  bottom: number;
}

/** Keeps the tip clear of the screen edges. */
const MARGIN = 8;

/** Distance between the tip and the garment it describes. */
const GAP = 8;

/**
 * The fabric split, shown on hover or long press.
 *
 * Rendered through a portal rather than inside the shelf: the cabinet clips its
 * children to get its rounded corners, which would cut the tip off for anything
 * on the top row or at either end.
 */
export function MaterialTip({ anchor }: { anchor: TipAnchor }) {
  const box = useRef<HTMLDivElement>(null);
  const [placed, setPlaced] = useState<{ left: number; top: number }>();

  /*
   * Positioned after measuring, because the tip is as wide as its text.
   * Clamping the anchor point alone is not enough -- the tip is centred on it,
   * so half of it still hung off the screen for the first garment on a shelf.
   */
  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return;
    const { offsetWidth: width, offsetHeight: height } = element;

    const half = width / 2;
    const left = Math.min(
      window.innerWidth - MARGIN - half,
      Math.max(MARGIN + half, anchor.x),
    );

    // Above the garment by default; below it when there is no room, which is
    // the case for anything hanging on the rail at the top of the cabinet.
    const above = anchor.top - GAP - height;
    const top = above < MARGIN ? anchor.bottom + GAP + height : anchor.top - GAP;

    setPlaced({ left, top });
  }, [anchor]);

  const total = anchor.materials.reduce((sum, part) => sum + part.percent, 0) || 1;

  return createPortal(
    <div
      ref={box}
      className="material-tip"
      role="tooltip"
      style={{
        left: placed?.left ?? anchor.x,
        top: placed?.top ?? anchor.top,
        // Hidden for the single frame before it has been measured, so it never
        // flashes in the wrong place.
        visibility: placed ? 'visible' : 'hidden',
      }}
    >
      <div className="material-bar" aria-hidden="true">
        {anchor.materials.map((part, index) => (
          <span
            key={part.material}
            style={{
              width: `${(part.percent / total) * 100}%`,
              // Shades of one ink rather than a colour per material: the point
              // is the proportion, and a palette here would compete with the
              // garments it is sitting on top of.
              opacity: 1 - index * 0.22,
            }}
          />
        ))}
      </div>
      <p>
        {anchor.materials.map((part) => (
          <span key={part.material}>
            <strong>{part.percent}%</strong>{' '}
            {MATERIAL_LABELS[part.material].toLowerCase()}
          </span>
        ))}
      </p>
    </div>,
    document.body,
  );
}
