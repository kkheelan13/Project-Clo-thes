import {
  MATERIALS,
  MATERIAL_LABELS,
  type Material,
  type MaterialPart,
} from '../lib/types';

/** Matches the database constraint, which caps a blend at five components. */
const MAX_PARTS = 5;

interface Props {
  value: MaterialPart[];
  onChange(value: MaterialPart[]): void;
}

function sum(parts: MaterialPart[]): number {
  return parts.reduce((total, part) => total + part.percent, 0);
}

/**
 * Forces the last component to absorb whatever is left over.
 *
 * Keeping this invariant means the editor can only ever emit a blend totalling
 * 100, so the user never does arithmetic and the database constraint can never
 * be the thing that tells them they got it wrong.
 */
function balance(parts: MaterialPart[]): MaterialPart[] {
  if (parts.length === 0) return parts;
  const head = parts.slice(0, -1);
  const used = Math.min(99, sum(head));
  return [...head, { ...parts[parts.length - 1], percent: 100 - used }];
}

export function BlendEditor({ value, onChange }: Props) {
  const lastIndex = value.length - 1;
  const unused = MATERIALS.filter(
    (material) => !value.some((part) => part.material === material),
  );

  function setMaterial(index: number, material: Material) {
    const next = [...value];
    next[index] = { ...next[index], material };
    onChange(balance(next));
  }

  function setPercent(index: number, percent: number) {
    const next = [...value];
    // Leave at least 1% for the trailing component to absorb.
    const others = sum(next.filter((_, i) => i !== index && i !== lastIndex));
    next[index] = {
      ...next[index],
      percent: Math.max(1, Math.min(99 - others, percent)),
    };
    onChange(balance(next));
  }

  function addMaterial() {
    const material = unused[0];
    if (!material || value.length >= MAX_PARTS) return;
    const next = [...value];
    const trailing = next[lastIndex].percent;
    next[lastIndex] = {
      ...next[lastIndex],
      percent: Math.max(1, Math.floor(trailing / 2)),
    };
    onChange(balance([...next, { material, percent: 0 }]));
  }

  function removeAt(index: number) {
    if (value.length === 1) return;
    onChange(balance(value.filter((_, i) => i !== index)));
  }

  return (
    <div className="blend">
      {value.map((part, index) => (
        <div className="blend-row" key={`${part.material}-${index}`}>
          <select
            aria-label="Material"
            value={part.material}
            onChange={(event) =>
              setMaterial(index, event.target.value as Material)
            }
          >
            {[part.material, ...unused].map((material) => (
              <option key={material} value={material}>
                {MATERIAL_LABELS[material]}
              </option>
            ))}
          </select>

          <div className="blend-percent">
            <input
              type="number"
              min={1}
              max={99}
              step={1}
              aria-label={`${MATERIAL_LABELS[part.material]} percentage`}
              value={part.percent}
              disabled={index === lastIndex}
              onChange={(event) =>
                setPercent(index, Number(event.target.value))
              }
            />
            <span aria-hidden="true">%</span>
          </div>

          <button
            type="button"
            className="icon-button"
            aria-label={`Remove ${MATERIAL_LABELS[part.material]}`}
            disabled={value.length === 1}
            onClick={() => removeAt(index)}
          >
            &times;
          </button>
        </div>
      ))}

      {unused.length > 0 && value.length < MAX_PARTS && (
        <button type="button" className="ghost small" onClick={addMaterial}>
          + Add material
        </button>
      )}
    </div>
  );
}
