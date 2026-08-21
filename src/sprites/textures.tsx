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
        <pattern id="tex-linen" patternUnits="userSpaceOnUse" width="4" height="4">
          <rect width="4" height="2" fill={LIGHT} />
        </pattern>

        <pattern id="tex-denim" patternUnits="userSpaceOnUse" width="4" height="4">
          <path d="M0 4L4 0" stroke={DARK} strokeWidth="1.4" />
        </pattern>

        <pattern id="tex-wool" patternUnits="userSpaceOnUse" width="4" height="4">
          <circle cx="1" cy="1" r="0.44" fill="rgba(255,255,255,.26)" />
          <circle cx="3" cy="3" r="0.36" fill="rgba(0,0,0,.2)" />
        </pattern>

        <pattern id="tex-polyester" patternUnits="userSpaceOnUse" width="4" height="4">
          <path d="M0 4L4 0" stroke={LIGHT} strokeWidth="0.7" />
        </pattern>

        <pattern id="tex-viscose" patternUnits="userSpaceOnUse" width="4" height="4">
          <rect width="4" height="0.9" fill={LIGHT} />
        </pattern>

        <pattern id="tex-silk" patternUnits="userSpaceOnUse" width="6" height="6">
          <rect width="6" height="2.4" fill="rgba(255,255,255,.2)" />
        </pattern>

        <pattern id="tex-nylon" patternUnits="userSpaceOnUse" width="4" height="4">
          <rect width="1.1" height="4" fill={LIGHT} />
        </pattern>

        <pattern id="tex-elastane" patternUnits="userSpaceOnUse" width="4" height="4">
          <rect width="2" height="2" fill={LIGHT} />
          <rect x="2" y="2" width="2" height="2" fill={DARK} />
        </pattern>
      </defs>
    </svg>
  );
}
