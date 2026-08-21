import { useState } from 'react';
import {
  BOTTOM_TYPES,
  TOP_TYPES,
  TYPE_LABELS_SINGULAR,
  describeBlend,
  isDirty,
  type Garment,
  type WardrobeSnapshot,
} from '../lib/types';
import { GarmentSprite } from '../sprites/Garment';

interface Props {
  snapshot: WardrobeSnapshot;
  onPair(topId: string, bottomId: string): Promise<void>;
  onClose(): void;
}

/** Only a clean, ironed garment is ready to hang. */
function ready(garment: Garment, snapshot: WardrobeSnapshot): boolean {
  return garment.isIroned && !isDirty(garment, snapshot.wears);
}

export function PairOutfit({ snapshot, onPair, onClose }: Props) {
  const [topId, setTopId] = useState<string>();
  const [bottomId, setBottomId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const tops = snapshot.garments.filter(
    (g) => TOP_TYPES.has(g.type) && ready(g, snapshot),
  );
  const bottoms = snapshot.garments.filter(
    (g) => BOTTOM_TYPES.has(g.type) && ready(g, snapshot),
  );

  async function save() {
    if (!topId || !bottomId) return;
    setBusy(true);
    setError(undefined);
    try {
      await onPair(topId, bottomId);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not hang it.');
      setBusy(false);
    }
  }

  function column(
    label: string,
    items: Garment[],
    chosen: string | undefined,
    choose: (id: string) => void,
  ) {
    return (
      <div className="field">
        <span>{label}</span>
        {items.length === 0 ? (
          <p className="muted small">
            Nothing ironed yet. Wash it, iron it, then it can hang here.
          </p>
        ) : (
          <div className="pick-grid">
            {items.map((garment) => (
              <button
                type="button"
                key={garment.id}
                className={garment.id === chosen ? 'pick on' : 'pick'}
                aria-pressed={garment.id === chosen}
                aria-label={`${TYPE_LABELS_SINGULAR[garment.type]}, ${describeBlend(
                  garment.materials,
                )}`}
                onClick={() => choose(garment.id)}
              >
                <GarmentSprite garment={garment} size={40} />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label="Hang an outfit">
      <div className="sheet">
        <header className="sheet-head">
          <h2>Hang an outfit</h2>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
            &times;
          </button>
        </header>

        <div className="sheet-body">
          {column('Top', tops, topId, setTopId)}
          {column('Bottom', bottoms, bottomId, setBottomId)}
          {error && <p className="error">{error}</p>}
        </div>

        <footer className="sheet-foot">
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" disabled={busy || !topId || !bottomId} onClick={save}>
            {busy ? 'Hanging…' : 'Hang it up'}
          </button>
        </footer>
      </div>
    </div>
  );
}
