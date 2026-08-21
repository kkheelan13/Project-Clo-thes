import { useEffect, useRef, useState } from 'react';
import {
  BOTTOM_TYPES,
  GARMENT_TYPES,
  TOP_TYPES,
  TYPE_LABELS,
  TYPE_LABELS_SINGULAR,
  describeBlend,
  isDirty,
  type Garment,
  type WardrobeSnapshot,
} from '../lib/types';
import { GarmentSprite } from '../sprites/Garment';
import { MaterialTip, type TipAnchor } from './MaterialTip';

interface Props {
  snapshot: WardrobeSnapshot;
  onSelect(garment: Garment): void;
  onAdd(): void;
  onPair(): void;
  onUnpair(outfitId: string): Promise<void>;
  onWash(garmentIds: string[]): Promise<void>;
}

/**
 * The wardrobe itself: a rail of hung outfits above shelves of everything else,
 * with the laundry basket at the bottom.
 *
 * Items sit in a wrapped row rather than an overlapping pile because the whole
 * point is seeing everything in one go -- a pile hides most of what's in it.
 */
export function Wardrobe({ snapshot, onSelect, onAdd, onPair, onUnpair, onWash }: Props) {
  const [busy, setBusy] = useState(false);
  const [tip, setTip] = useState<TipAnchor>();
  const pressTimer = useRef<number>(undefined);
  // Where the finger went down, so jitter can be told from a scroll.
  const pressOrigin = useRef({ x: 0, y: 0 });
  // Set when a long press opens the tip, so releasing does not also count as a
  // tap and open the garment's sheet.
  const longPressed = useRef(false);

  useEffect(() => {
    if (!tip) return;
    const hide = () => setTip(undefined);
    // A tip anchored to a rect goes stale the moment anything moves.
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [tip]);

  function showTip(element: HTMLElement, materials: Props['snapshot']['garments'][number]['materials']) {
    const rect = element.getBoundingClientRect();
    setTip({
      materials,
      x: rect.left + rect.width / 2,
      top: rect.top,
      bottom: rect.bottom,
    });
  }

  function cancelPress() {
    window.clearTimeout(pressTimer.current);
  }

  /**
   * Cancels a long press only once the finger has actually travelled.
   *
   * Cancelling on any movement at all meant a real finger never held still
   * enough to trigger it -- touch emulation jitters by a pixel or two and the
   * press was killed before the timer ever ran. Ten pixels still lets a genuine
   * scroll cancel immediately.
   */
  function pressMoved(x: number, y: number) {
    return Math.hypot(x - pressOrigin.current.x, y - pressOrigin.current.y) > 10;
  }
  const { garments, wears, outfits } = snapshot;

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

  const byId = new Map(garments.map((garment) => [garment.id, garment]));
  const dirty = garments.filter((garment) => isDirty(garment, wears));

  // A hung garment lives on the rail, not on its shelf, so it appears once.
  const hung = new Set(outfits.flatMap((o) => [o.topId, o.bottomId]));

  // Dirty garments stay on their own shelf, just faded. Moving them into the
  // basket emptied the shelves of everything ever worn, which broke the view's
  // whole job -- you check the t-shirt shelf to decide whether you need another
  // white tee, and it has to show all of them, not just the clean ones.
  const shelves = GARMENT_TYPES.map((type) => {
    const owned = garments.filter((garment) => garment.type === type);
    return {
      type,
      owned: owned.length,
      items: owned.filter((garment) => !hung.has(garment.id)),
    };
  }).filter((shelf) => shelf.owned > 0);

  const canPair =
    garments.some((g) => TOP_TYPES.has(g.type) && g.isIroned && !isDirty(g, wears)) &&
    garments.some((g) => BOTTOM_TYPES.has(g.type) && g.isIroned && !isDirty(g, wears));

  const sprite = (garment: Garment, size?: number) => (
    <button
      type="button"
      className="garment"
      key={garment.id}
      // The label belongs on the button: a name on the inner SVG is not
      // reachable from the control a screen reader lands on.
      aria-label={`${TYPE_LABELS_SINGULAR[garment.type]}, ${describeBlend(
        garment.materials,
      )}${isDirty(garment, wears) ? ', needs washing' : ''}`}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') showTip(event.currentTarget, garment.materials);
      }}
      onPointerLeave={() => {
        cancelPress();
        setTip(undefined);
      }}
      onPointerDown={(event) => {
        if (event.pointerType === 'mouse') return;
        const element = event.currentTarget;
        longPressed.current = false;
        pressOrigin.current = { x: event.clientX, y: event.clientY };
        pressTimer.current = window.setTimeout(() => {
          longPressed.current = true;
          showTip(element, garment.materials);
        }, 450);
      }}
      onPointerUp={cancelPress}
      onPointerCancel={() => {
        cancelPress();
        setTip(undefined);
      }}
      onPointerMove={(event) => {
        if (pressMoved(event.clientX, event.clientY)) cancelPress();
      }}
      // Otherwise a long press raises the platform's own text callout on top.
      onContextMenu={(event) => event.preventDefault()}
      onClick={() => {
        if (longPressed.current) {
          longPressed.current = false;
          setTip(undefined);
          return;
        }
        onSelect(garment);
      }}
    >
      <GarmentSprite garment={garment} size={size} faded={isDirty(garment, wears)} />
    </button>
  );

  async function run(work: () => Promise<void>) {
    setBusy(true);
    try {
      await work();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cabinet">
      {tip && <MaterialTip anchor={tip} />}
      {(outfits.length > 0 || canPair) && (
        <section className="rail-section">
          <h2 className="shelf-label">
            Hanging rail <span>{outfits.length}</span>
            {canPair && (
              <button type="button" className="link" onClick={onPair}>
                Hang an outfit
              </button>
            )}
          </h2>

          {outfits.length === 0 ? (
            <p className="muted small">
              You have ironed things ready to pair up.
            </p>
          ) : (
            <div className="rail">
              {outfits.map((outfit) => {
                const top = byId.get(outfit.topId);
                const bottom = byId.get(outfit.bottomId);
                if (!top || !bottom) return null;
                return (
                  <div className="hanger" key={outfit.id}>
                    <div className="hook" aria-hidden="true" />
                    {sprite(top, 52)}
                    {sprite(bottom, 52)}
                    <button
                      type="button"
                      className="link"
                      disabled={busy}
                      onClick={() => run(() => onUnpair(outfit.id))}
                    >
                      Take down
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {shelves.map((shelf) => (
        <section className="shelf" key={shelf.type}>
          <h2 className="shelf-label">
            {TYPE_LABELS[shelf.type]} <span>{shelf.owned}</span>
            {/* The count is what you own; say where the missing ones went. */}
            {shelf.owned > shelf.items.length && shelf.items.length > 0 && (
              <span className="muted small">
                {shelf.owned - shelf.items.length} on the rail
              </span>
            )}
          </h2>
          <div className="shelf-items">
            {shelf.items.length === 0 ? (
              <p className="muted small shelf-note">All on the rail.</p>
            ) : (
              shelf.items.map((garment) => sprite(garment))
            )}
          </div>
        </section>
      ))}

      {dirty.length > 0 && (
        // A summary bar rather than a second grid: the faded sprites on the
        // shelves above already show which ones, and duplicating them here
        // would show the same garment in two places.
        <section className="laundry-bar">
          <p className="small">
            <strong>{dirty.length}</strong>{' '}
            {dirty.length === 1 ? 'garment needs' : 'garments need'} washing
            <span className="muted"> · faded above</span>
          </p>
          <button
            type="button"
            className="small"
            disabled={busy}
            onClick={() => run(() => onWash(dirty.map((garment) => garment.id)))}
          >
            {busy ? 'Washing…' : 'Wash them'}
          </button>
        </section>
      )}
    </div>
  );
}
