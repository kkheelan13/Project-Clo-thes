/**
 * SVG pattern definitions, one per material. Ids live in `materials.ts`.
 *
 * Patterns tile in the sprite's own 16-unit coordinate space, so the weave
 * scales with the garment rather than with the screen.
 */
const LIGHT = 'rgba(255,255,255,.34)';
const DARK = 'rgba(0,0,0,.26)';

/**
 * Rendered once near the root. Every sprite references these by id, so the
 * patterns are defined a single time no matter how large the wardrobe grows.
 */
export function SpriteDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
      <defs>
        <pattern id="tex-linen" patternUnits="userSpaceOnUse" width="2" height="2">
          <rect width="2" height="1" fill={LIGHT} />
        </pattern>

        <pattern id="tex-denim" patternUnits="userSpaceOnUse" width="2" height="2">
          <path d="M0 2L2 0" stroke={DARK} strokeWidth=".7" />
        </pattern>

        <pattern id="tex-wool" patternUnits="userSpaceOnUse" width="2" height="2">
          <circle cx=".5" cy=".5" r=".22" fill="rgba(255,255,255,.26)" />
          <circle cx="1.5" cy="1.5" r=".18" fill="rgba(0,0,0,.2)" />
        </pattern>

        <pattern id="tex-polyester" patternUnits="userSpaceOnUse" width="2" height="2">
          <path d="M0 2L2 0" stroke={LIGHT} strokeWidth=".35" />
        </pattern>

        <pattern id="tex-viscose" patternUnits="userSpaceOnUse" width="2" height="2">
          <rect width="2" height=".45" fill={LIGHT} />
        </pattern>

        <pattern id="tex-silk" patternUnits="userSpaceOnUse" width="3" height="3">
          <rect width="3" height="1.2" fill="rgba(255,255,255,.2)" />
        </pattern>

        <pattern id="tex-nylon" patternUnits="userSpaceOnUse" width="2" height="2">
          <rect width=".55" height="2" fill={LIGHT} />
        </pattern>

        <pattern id="tex-elastane" patternUnits="userSpaceOnUse" width="2" height="2">
          <rect width="1" height="1" fill={LIGHT} />
          <rect x="1" y="1" width="1" height="1" fill={DARK} />
        </pattern>
      </defs>
    </svg>
  );
}
