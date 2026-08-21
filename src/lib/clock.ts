let previous = 0;

/**
 * A timestamp that is strictly greater than every timestamp handed out before
 * it in this session.
 *
 * Cleanliness is decided by whether a wear was recorded after the last wash, so
 * two events must never share a timestamp. `Date.now()` only resolves to the
 * millisecond, and washing then immediately logging a wear lands on the same
 * value -- which read as "not worn since the wash" and left a dirty garment
 * looking clean.
 *
 * Ordering also has to come from one clock. Both the wear and the wash are
 * stamped here, on the client, rather than letting the wash use the browser and
 * the wear use the database default: skew between the two clocks would decide
 * the comparison instead of the actual order of events.
 */
export function stamp(): string {
  const now = Math.max(Date.now(), previous + 1);
  previous = now;
  return new Date(now).toISOString();
}
