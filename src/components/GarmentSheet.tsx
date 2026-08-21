import { useState } from 'react';
import { formatDate, today } from '../lib/dates';
import {
  SLEEVE_LABELS,
  TYPE_LABELS_SINGULAR,
  UNIRONED_TYPES,
  describeAge,
  describeBlend,
  isDirty,
  outfitOf,
  wearsOf,
  wearsPerMonth,
  type Garment,
  type WardrobeSnapshot,
} from '../lib/types';
import { GarmentSprite } from '../sprites/Garment';

interface Props {
  garment: Garment;
  snapshot: WardrobeSnapshot;
  onDelete(id: string): Promise<void>;
  onWear(id: string, wornOn: string): Promise<void>;
  onWash(id: string): Promise<void>;
  onIron(id: string, ironed: boolean): Promise<void>;
  onClose(): void;
}

export function GarmentSheet({
  garment,
  snapshot,
  onDelete,
  onWear,
  onWash,
  onIron,
  onClose,
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const worn = wearsOf(garment.id, snapshot.wears);
  const dirty = isDirty(garment, snapshot.wears);
  const hanging = outfitOf(garment.id, snapshot.outfits);
  const ironable = !UNIRONED_TYPES.has(garment.type);
  const loggedToday = worn.includes(today());

  async function run(work: () => Promise<void>, thenClose = false) {
    setBusy(true);
    setError(undefined);
    try {
      await work();
      if (thenClose) onClose();
      else setBusy(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That did not work.');
      setBusy(false);
    }
  }

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true">
      <div className="sheet">
        <header className="sheet-head">
          <h2>{TYPE_LABELS_SINGULAR[garment.type]}</h2>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
            &times;
          </button>
        </header>

        <div className="sheet-body">
          <div className="preview-strip">
            <GarmentSprite garment={garment} size={92} faded={dirty} />
            <dl className="facts">
              <dt>Material</dt>
              <dd>{describeBlend(garment.materials)}</dd>
              <dt>Bought</dt>
              <dd>
                {formatDate(garment.purchasedOn)}
                <span className="muted"> · {describeAge(garment.purchasedOn)}</span>
              </dd>
              <dt>Worn</dt>
              <dd>
                {worn.length === 0
                  ? 'never yet'
                  : `${worn.length} ${worn.length === 1 ? 'time' : 'times'} · about ${wearsPerMonth(
                      garment,
                      snapshot.wears,
                    )}× a month`}
              </dd>
              {worn.length > 0 && (
                <>
                  <dt>Last worn</dt>
                  <dd>{formatDate(worn[0])}</dd>
                </>
              )}
              {garment.sleeve !== 'none' && (
                <>
                  <dt>Sleeves</dt>
                  <dd>{SLEEVE_LABELS[garment.sleeve]}</dd>
                </>
              )}
              <dt>State</dt>
              <dd>
                {dirty ? 'Needs washing' : 'Clean'}
                {ironable && (garment.isIroned ? ' · ironed' : ' · not ironed')}
                {hanging && ' · on the rail'}
              </dd>
            </dl>
          </div>

          <div className="actions">
            <button
              type="button"
              className="ghost"
              disabled={busy || loggedToday}
              onClick={() => run(() => onWear(garment.id, today()))}
            >
              {loggedToday ? 'Worn today ✓' : 'Wore it today'}
            </button>

            <button
              type="button"
              className="ghost"
              disabled={busy || !dirty}
              onClick={() => run(() => onWash(garment.id))}
            >
              {dirty ? 'Wash it' : 'Already clean'}
            </button>

            {ironable && (
              <button
                type="button"
                className="ghost"
                disabled={busy || dirty}
                onClick={() => run(() => onIron(garment.id, !garment.isIroned))}
                // Ironing a dirty garment is pointless -- it goes in the wash first.
                title={dirty ? 'Wash it first' : undefined}
              >
                {garment.isIroned ? 'Mark not ironed' : 'Mark ironed'}
              </button>
            )}
          </div>

          {error && <p className="error">{error}</p>}
        </div>

        <footer className="sheet-foot">
          {confirming ? (
            <>
              <p className="muted small grow">Its wear history goes too.</p>
              <button type="button" className="ghost" onClick={() => setConfirming(false)}>
                Keep it
              </button>
              <button
                type="button"
                className="danger"
                disabled={busy}
                onClick={() => run(() => onDelete(garment.id), true)}
              >
                {busy ? 'Removing…' : 'Yes, remove'}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="ghost" onClick={onClose}>
                Close
              </button>
              <button type="button" className="danger" onClick={() => setConfirming(true)}>
                Remove
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
