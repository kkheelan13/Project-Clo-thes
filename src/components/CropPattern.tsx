import { useEffect, useRef, useState } from 'react';
import type { Crop, Placement } from '../lib/pattern';

interface Props {
  file: File;
  onCancel(): void;
  onUse(crop: Crop, placement: Placement): void;
}

/**
 * Choose which part of the photo becomes the print.
 *
 * Drag to move, slider to resize, rather than corner handles: handles are
 * fiddly at thumb size, and this is a phone-first flow. Framing it by hand also
 * sidesteps auto-segmentation, which is unreliable on a crumpled shirt against
 * a duvet -- and when it fails you get a sprite made of bedsheet.
 */
export function CropPattern({ file, onCancel, onUse }: Props) {
  // Created once during render rather than in an effect, so the image has a
  // source on the very first paint instead of flashing empty.
  const [url] = useState(() => URL.createObjectURL(file));
  const [size, setSize] = useState(0.6);
  const [centre, setCentre] = useState({ x: 0.5, y: 0.5 });
  const [placement, setPlacement] = useState<Placement>('allover');
  const frame = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // The preview holds the only reference to the decoded photo; revoking it lets
  // the browser drop those pixels as soon as this step is done with.
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  function moveTo(clientX: number, clientY: number) {
    const box = frame.current?.getBoundingClientRect();
    if (!box) return;
    const half = size / 2;
    setCentre({
      x: Math.min(1 - half, Math.max(half, (clientX - box.left) / box.width)),
      y: Math.min(1 - half, Math.max(half, (clientY - box.top) / box.height)),
    });
  }

  const crop: Crop = {
    x: centre.x - size / 2,
    y: centre.y - size / 2,
    w: size,
    h: size,
  };

  return (
    <div className="crop">
      <div
        className="crop-frame"
        ref={frame}
        onPointerDown={(event) => {
          dragging.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          moveTo(event.clientX, event.clientY);
        }}
        onPointerMove={(event) => {
          if (dragging.current) moveTo(event.clientX, event.clientY);
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
      >
        <img src={url} alt="" draggable={false} />
        <div
          className="crop-box"
          style={{
            left: `${crop.x * 100}%`,
            top: `${crop.y * 100}%`,
            width: `${crop.w * 100}%`,
            height: `${crop.h * 100}%`,
          }}
        />
      </div>

      <p className="muted small">
        Drag over the part of the garment you want on the miniature.
      </p>

      <label className="field">
        <span>Crop size</span>
        <input
          type="range"
          min={20}
          max={95}
          step={1}
          value={Math.round(size * 100)}
          onChange={(event) => {
            const next = Number(event.target.value) / 100;
            setSize(next);
            // Keep the box on screen when it grows past the current centre.
            const half = next / 2;
            setCentre((c) => ({
              x: Math.min(1 - half, Math.max(half, c.x)),
              y: Math.min(1 - half, Math.max(half, c.y)),
            }));
          }}
        />
      </label>

      <label className="field">
        <span>Print</span>
        <div className="chips">
          <button
            type="button"
            className={placement === 'allover' ? 'chip on' : 'chip'}
            onClick={() => setPlacement('allover')}
          >
            All over
          </button>
          <button
            type="button"
            className={placement === 'chest' ? 'chip on' : 'chip'}
            onClick={() => setPlacement('chest')}
          >
            Chest print
          </button>
        </div>
        <p className="muted small">
          {placement === 'allover'
            ? 'Stripes and checks — the pattern covers the sleeves too.'
            : 'A single motif on the front. Sleeves take the garment’s own colour.'}
        </p>
      </label>

      <div className="actions">
        <button type="button" className="ghost" onClick={onCancel}>
          Back
        </button>
        <button type="button" onClick={() => onUse(crop, placement)}>
          Use this print
        </button>
      </div>
    </div>
  );
}
