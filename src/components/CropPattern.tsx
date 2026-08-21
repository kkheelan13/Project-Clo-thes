import { useEffect, useRef, useState } from 'react';
import type { Crop, Placement } from '../lib/pattern';

interface Props {
  file: File;
  busy?: boolean;
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
export function CropPattern({ file, busy, onUse }: Props) {
  const [url, setUrl] = useState<string>();
  const [size, setSize] = useState(0.6);
  const [centre, setCentre] = useState({ x: 0.5, y: 0.5 });
  // The photo's shape, so the crop can be a true square. Without it a 0.6
  // fraction of a portrait photo is 0.6 of the width by 0.6 of the height --
  // a rectangle, which the square pattern grid then squashes.
  const [shape, setShape] = useState({ w: 1, h: 1 });
  const [placement, setPlacement] = useState<Placement>('allover');
  const frame = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  /*
   * The URL must be created inside the effect, not once during render.
   *
   * StrictMode mounts, cleans up, and mounts again. A URL created in a lazy
   * useState initialiser is not recreated on that second mount, so the cleanup
   * revokes it and the <img> is left pointing at a dead blob -- it reports
   * complete with naturalWidth 0 and renders nothing at all.
   *
   * The preview holds the only reference to the decoded photo, so revoking on
   * the way out lets the browser drop those pixels immediately.
   */
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  // A square whose side is `size` of the photo's shorter edge, expressed in
  // each axis as a fraction of that axis.
  const shorter = Math.min(shape.w, shape.h);
  const span = { w: (size * shorter) / shape.w, h: (size * shorter) / shape.h };

  function moveTo(clientX: number, clientY: number) {
    const box = frame.current?.getBoundingClientRect();
    if (!box) return;
    const halfW = span.w / 2;
    const halfH = span.h / 2;
    setCentre({
      x: Math.min(1 - halfW, Math.max(halfW, (clientX - box.left) / box.width)),
      y: Math.min(1 - halfH, Math.max(halfH, (clientY - box.top) / box.height)),
    });
  }

  const crop: Crop = {
    x: centre.x - span.w / 2,
    y: centre.y - span.h / 2,
    w: span.w,
    h: span.h,
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
        {url && (
          <img
            src={url}
            alt=""
            draggable={false}
            onLoad={(event) =>
              setShape({
                w: event.currentTarget.naturalWidth,
                h: event.currentTarget.naturalHeight,
              })
            }
          />
        )}
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
        Drag the square over a patterned part of the garment. Skip this if it is
        a plain colour.
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
            // Keep the box on the photo when it grows past the current centre.
            const halfW = (next * shorter) / shape.w / 2;
            const halfH = (next * shorter) / shape.h / 2;
            setCentre((c) => ({
              x: Math.min(1 - halfW, Math.max(halfW, c.x)),
              y: Math.min(1 - halfH, Math.max(halfH, c.y)),
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

      <button
        type="button"
        className="wide"
        disabled={busy}
        onClick={() => onUse(crop, placement)}
      >
        {busy ? 'Reading the print…' : 'Use this as the print'}
      </button>
    </div>
  );
}
