import { useState } from 'react';
import { formatDate, today } from '../lib/dates';
import {
  GARMENT_TYPES,
  TYPE_LABELS,
  TYPE_LABELS_SINGULAR,
  describeBlend,
  isDirty,
  wearsOf,
  type WardrobeSnapshot,
} from '../lib/types';
import { GarmentSprite } from '../sprites/Garment';

interface Props {
  snapshot: WardrobeSnapshot;
  onLog(garmentIds: string[], wornOn: string): Promise<void>;
  onClose(): void;
}

/**
 * "What did you wear today" -- the phase 2 logging flow.
 *
 * Multi-select in one pass rather than a garment at a time: an outfit is
 * several items, and logging them one by one is the kind of friction that
 * stops people logging at all.
 */
export function LogWear({ snapshot, onLog, onClose }: Props) {
  const [wornOn, setWornOn] = useState(today);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  function toggle(id: string) {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    if (picked.size === 0) return;
    setBusy(true);
    setError(undefined);
    try {
      await onLog([...picked], wornOn);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save.');
      setBusy(false);
    }
  }

  const shelves = GARMENT_TYPES.map((type) => ({
    type,
    items: snapshot.garments.filter((garment) => garment.type === type),
  })).filter((shelf) => shelf.items.length > 0);

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label="Log what you wore">
      <div className="sheet">
        <header className="sheet-head">
          <h2>What did you wear?</h2>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
            &times;
          </button>
        </header>

        <div className="sheet-body">
          <label className="field">
            <span>Day</span>
            <input
              type="date"
              value={wornOn}
              max={today()}
              onChange={(event) => setWornOn(event.target.value)}
            />
          </label>

          {shelves.map((shelf) => (
            <div className="field" key={shelf.type}>
              <span>{TYPE_LABELS[shelf.type]}</span>
              <div className="pick-grid">
                {shelf.items.map((garment) => {
                  const on = picked.has(garment.id);
                  const alreadyLogged = wearsOf(garment.id, snapshot.wears).includes(wornOn);
                  return (
                    <button
                      type="button"
                      key={garment.id}
                      className={on ? 'pick on' : 'pick'}
                      aria-pressed={on}
                      aria-label={`${TYPE_LABELS_SINGULAR[garment.type]}, ${describeBlend(
                        garment.materials,
                      )}${alreadyLogged ? ', already logged' : ''}`}
                      onClick={() => toggle(garment.id)}
                    >
                      <GarmentSprite
                        garment={garment}
                        size={40}
                        faded={isDirty(garment, snapshot.wears)}
                      />
                      {alreadyLogged && <span className="pick-tick" aria-hidden="true">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {error && <p className="error">{error}</p>}
        </div>

        <footer className="sheet-foot">
          <p className="muted small grow">
            {picked.size === 0
              ? formatDate(wornOn)
              : `${picked.size} selected · ${formatDate(wornOn)}`}
          </p>
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" disabled={busy || picked.size === 0} onClick={save}>
            {busy ? 'Saving…' : 'Log it'}
          </button>
        </footer>
      </div>
    </div>
  );
}
