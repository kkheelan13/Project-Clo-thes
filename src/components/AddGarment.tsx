import { useRef, useState, type ChangeEvent } from 'react';
import { ColourError, extractColours } from '../lib/colour';
import {
  PatternError,
  extractPattern,
  type Crop,
  type Pattern,
  type Placement,
} from '../lib/pattern';
import { today } from '../lib/dates';
import {
  GARMENT_TYPES,
  SLEEVES,
  SLEEVED_TYPES,
  SLEEVE_LABELS,
  TYPE_LABELS_SINGULAR,
  blendError,
  type GarmentType,
  type MaterialPart,
  type NewGarment,
  type Sleeve,
} from '../lib/types';
import { GarmentSprite } from '../sprites/Garment';
import { BlendEditor } from './BlendEditor';
import { CropPattern } from './CropPattern';

const DEFAULT_COLOUR = '#7F77DD';
const DEFAULT_BLEND: MaterialPart[] = [{ material: 'cotton', percent: 100 }];

interface Props {
  onSave(garment: NewGarment): Promise<void>;
  onClose(): void;
}

export function AddGarment({ onSave, onClose }: Props) {
  const [type, setType] = useState<GarmentType>('tshirt');
  const [sleeve, setSleeve] = useState<Sleeve>('half');
  const [colour, setColour] = useState(DEFAULT_COLOUR);
  const [swatches, setSwatches] = useState<string[]>([]);
  const [pattern, setPattern] = useState<Pattern>();
  // Held only while this sheet is open, so the print can be re-cropped without
  // asking for the photo again. It is dropped the moment the sheet closes.
  const [photo, setPhoto] = useState<File>();
  const [materials, setMaterials] = useState<MaterialPart[]>(DEFAULT_BLEND);
  const [purchasedOn, setPurchasedOn] = useState(today);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);

  const hasSleeves = SLEEVED_TYPES.has(type);
  const blendProblem = blendError(materials);

  async function onPickPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset first, so picking the same file twice still fires a change event.
    event.target.value = '';
    if (!file) return;

    setReading(true);
    setError(undefined);
    try {
      const found = await extractColours(file);
      setSwatches(found);
      if (found[0]) setColour(found[0]);
      setPhoto(file);
    } catch (cause) {
      setError(
        cause instanceof ColourError
          ? cause.message
          : "That photo couldn't be read.",
      );
    } finally {
      setReading(false);
    }
  }

  async function useCrop(crop: Crop, placement: Placement) {
    if (!photo) return;
    setReading(true);
    setError(undefined);
    try {
      setPattern(await extractPattern(photo, crop, placement));
    } catch (cause) {
      setError(
        cause instanceof PatternError ? cause.message : "That print couldn't be read.",
      );
    } finally {
      setReading(false);
    }
  }

  async function save() {
    if (blendProblem) return;
    setBusy(true);
    setError(undefined);
    try {
      await onSave({
        type,
        colour,
        pattern,
        materials,
        sleeve: hasSleeves ? sleeve : 'none',
        purchasedOn,
      });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save.');
      setBusy(false);
    }
  }

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label="Add a garment">
      <div className="sheet">
        <header className="sheet-head">
          <h2>Add a garment</h2>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
            &times;
          </button>
        </header>

        <div className="sheet-body">
          <div className="preview-strip">
            <GarmentSprite
              garment={{
                type,
                colour,
                pattern,
                materials,
                sleeve: hasSleeves ? sleeve : 'none',
              }}
              size={92}
              title="Preview"
            />
            <div>
              <p className="preview-title">{TYPE_LABELS_SINGULAR[type]}</p>
              <p className="muted small">
                This is how it will sit on the shelf. Your photo is read for its
                colour and its print, then discarded &mdash; nothing but these
                settings is saved.
              </p>
            </div>
          </div>

          <label className="field">
            <span>Type</span>
            <div className="chips">
              {GARMENT_TYPES.map((option) => (
                <button
                  type="button"
                  key={option}
                  className={option === type ? 'chip on' : 'chip'}
                  onClick={() => setType(option)}
                >
                  {TYPE_LABELS_SINGULAR[option]}
                </button>
              ))}
            </div>
          </label>

          <label className="field">
            <span>Colour</span>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={onPickPhoto}
            />
            <div className="colour-row">
              <button
                type="button"
                className="ghost"
                disabled={reading}
                onClick={() => fileInput.current?.click()}
              >
                {reading ? 'Reading colour…' : 'Photograph it'}
              </button>

              {swatches.map((option) => (
                <button
                  type="button"
                  key={option}
                  className={option === colour ? 'swatch on' : 'swatch'}
                  style={{ background: option }}
                  aria-label={`Use ${option}`}
                  onClick={() => setColour(option)}
                />
              ))}

              <input
                type="color"
                className="swatch-picker"
                aria-label="Pick a colour by hand"
                value={colour}
                onChange={(event) => setColour(event.target.value.toUpperCase())}
              />
            </div>
            {swatches.length > 0 && (
              <p className="muted small">
                Tap whichever swatch matches the garment, or pick by hand.
              </p>
            )}
          </label>

          {photo && (
            <label className="field">
              <span>Print or pattern</span>
              {pattern ? (
                <>
                  <p className="muted small">
                    {pattern.palette.length} colours,{' '}
                    {pattern.placement === 'chest' ? 'on the chest' : 'all over'}.
                    The preview above shows how it will look.
                  </p>
                  <div className="actions">
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => setPattern(undefined)}
                    >
                      Choose a different area
                    </button>
                  </div>
                </>
              ) : (
                <CropPattern file={photo} busy={reading} onUse={useCrop} />
              )}
            </label>
          )}

          {hasSleeves && (
            <label className="field">
              <span>Sleeves</span>
              <div className="chips">
                {SLEEVES.map((option) => (
                  <button
                    type="button"
                    key={option}
                    className={option === sleeve ? 'chip on' : 'chip'}
                    onClick={() => setSleeve(option)}
                  >
                    {SLEEVE_LABELS[option]}
                  </button>
                ))}
              </div>
            </label>
          )}

          <label className="field">
            <span>Material</span>
            <BlendEditor value={materials} onChange={setMaterials} />
            <p className="muted small">
              {pattern
                ? 'Recorded for reference. The print sets how it looks, not the weave.'
                : 'The largest share sets the texture on the shelf.'}
            </p>
          </label>

          <label className="field">
            <span>Bought on</span>
            <input
              type="date"
              value={purchasedOn}
              max={today()}
              onChange={(event) => setPurchasedOn(event.target.value)}
            />
          </label>

          {(error ?? blendProblem) && (
            <p className="error">{error ?? blendProblem}</p>
          )}
        </div>

        <footer className="sheet-foot">
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" disabled={busy || Boolean(blendProblem)} onClick={save}>
            {busy ? 'Saving…' : 'Add to wardrobe'}
          </button>
        </footer>
      </div>
    </div>
  );
}
