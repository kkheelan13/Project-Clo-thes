import { useState } from 'react';
import { formatDate } from '../lib/dates';
import {
  SLEEVE_LABELS,
  TYPE_LABELS_SINGULAR,
  describeBlend,
  type Garment,
} from '../lib/types';
import { GarmentSprite } from '../sprites/Garment';

interface Props {
  garment: Garment;
  onDelete(id: string): Promise<void>;
  onClose(): void;
}

export function GarmentSheet({ garment, onDelete, onClose }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function remove() {
    setBusy(true);
    setError(undefined);
    try {
      await onDelete(garment.id);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete.');
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
            <GarmentSprite garment={garment} size={92} />
            <dl className="facts">
              <dt>Material</dt>
              <dd>{describeBlend(garment.materials)}</dd>
              <dt>Bought</dt>
              <dd>{formatDate(garment.purchasedOn)}</dd>
              {garment.sleeve !== 'none' && (
                <>
                  <dt>Sleeves</dt>
                  <dd>{SLEEVE_LABELS[garment.sleeve]}</dd>
                </>
              )}
              <dt>Colour</dt>
              <dd>{garment.colour}</dd>
            </dl>
          </div>

          {error && <p className="error">{error}</p>}
        </div>

        <footer className="sheet-foot">
          {confirming ? (
            <>
              <button type="button" className="ghost" onClick={() => setConfirming(false)}>
                Keep it
              </button>
              <button type="button" className="danger" disabled={busy} onClick={remove}>
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
